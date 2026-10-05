// Where the agent's records come from: PostgreSQL when DATABASE_URL is set and
// reachable (the full stage 1 export, loaded by
// data-engineering/pipelines/postgres/load_postgres.py), else the verified
// snapshot (data.ts). The tools call this module only; they never see which
// source answered.
//
// Rules every Postgres query follows:
// - parametrized SQL only, never string-built from user input;
// - every read of a card or a transaction is scoped by the session's customer_id;
// - the source tables are read-only: a block is appended to card_status_events
//   and a card's current status is its latest event, else its source status.

import { Pool } from "pg";

import { cards as snapshotCards, customers as snapshotCustomers, demoCustomers as snapshotDemo, FRAUD_SCORE_CUTOFF, transactions as snapshotTransactions } from "./data";
import type { Card, CardStatus, Customer, Transaction } from "./data";
import { store } from "./store";

/** The source failed (connection, timeout). Tools treat it as transient: bounded retries, then a human. */
export class DataUnavailableError extends Error {}

export type StatusChange = { reason: "customer_confirmed_block" | "demo_reset"; actor: string; traceId?: string };

export interface Repository {
  readonly source: "postgres" | "snapshot";
  getCustomer(customerId: string): Promise<Customer | null>;
  /** The customer's serviceable cards (closed cards are left out), with their current status. */
  listCards(customerId: string): Promise<Card[]>;
  getCard(customerId: string, cardId: string): Promise<Card | null>;
  findCardByLastFour(customerId: string, lastFour: string): Promise<Card | null>;
  recentTransactions(customerId: string, cardId: string, limit: number): Promise<Transaction[]>;
  setCardStatus(cardId: string, status: CardStatus, change: StatusChange): Promise<void>;
  /** Restores every card to its source status (demo and evaluation runs). */
  reset(): Promise<void>;
  demoCustomers(): Promise<Customer[]>;
}

function normalizeAnswer(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "").trim();
}

// ---- Snapshot (fallback) ----------------------------------------------------------

const withStatus = (card: Card): Card => ({ ...card, status: store().cardStatus.get(card.card_id) ?? card.status });

export const snapshotRepository: Repository = {
  source: "snapshot",
  async getCustomer(customerId) {
    return snapshotCustomers().find((c) => c.customer_id === customerId) ?? null;
  },
  async listCards(customerId) {
    return snapshotCards().filter((c) => c.customer_id === customerId).map(withStatus);
  },
  async getCard(customerId, cardId) {
    const card = snapshotCards().find((c) => c.card_id === cardId && c.customer_id === customerId);
    return card ? withStatus(card) : null;
  },
  async findCardByLastFour(customerId, lastFour) {
    const card = snapshotCards().find((c) => c.last_four === lastFour && c.customer_id === customerId);
    return card ? withStatus(card) : null;
  },
  async recentTransactions(customerId, cardId, limit) {
    const owned = snapshotCards().some((c) => c.card_id === cardId && c.customer_id === customerId);
    if (!owned) return [];
    return snapshotTransactions()
      .filter((t) => t.card_id === cardId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  },
  async setCardStatus(cardId, status) {
    store().cardStatus.set(cardId, status);
  },
  async reset() {
    store().cardStatus = new Map(snapshotCards().map((card) => [card.card_id, card.status]));
  },
  async demoCustomers() {
    return snapshotDemo();
  },
};

// ---- PostgreSQL --------------------------------------------------------------------

export type LoadRun = {
  load_run_id: number;
  finished_at: string;
  source_exported_at: string;
  rows: Record<string, { dataset: number; test_fixture: number }>;
};

const SERVICEABLE = "('Active', 'Blocked', 'Suspended')";

// Current status: the latest event appended by the agent, else the source status.
const CARD_SELECT = `
  SELECT k.product_id AS card_id, k.customer_id,
         CASE k.product_category WHEN 'credit_card' THEN 'credit' ELSE 'debit' END AS type,
         k.card_last4 AS last_four,
         COALESCE((SELECT e.status FROM card_status_events e WHERE e.product_id = k.product_id
                   ORDER BY e.event_id DESC LIMIT 1), lower(k.product_status)) AS status,
         to_char(k.expiration_date, 'YYYY-MM') AS expiration,
         k.currency, NULLIF(k.dq_flags, '') AS dq_flags,
         (k.test_hook = 'block_failure') AS simulate_block_failure
    FROM cards k
   WHERE k.product_status IN ${SERVICEABLE}`;

type CardRow = Omit<Card, "simulate_block_failure"> & { simulate_block_failure: boolean | null };
const toCard = (row: CardRow): Card => {
  const { simulate_block_failure, ...card } = row;
  return simulate_block_failure ? { ...card, simulate_block_failure: true } : card;
};

/**
 * pg does not accept libpq-only options such as channel_binding (Neon adds it to its URLs).
 * sslmode=require is pinned to verify-full: certificate and host are checked, today and after
 * pg 9 gives "require" its weaker libpq meaning.
 */
function connectionString(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("channel_binding");
    if (parsed.searchParams.get("sslmode") === "require") parsed.searchParams.set("sslmode", "verify-full");
    return parsed.toString();
  } catch {
    return url;
  }
}

export class PostgresRepository implements Repository {
  readonly source = "postgres" as const;
  private pool: Pool;
  private demo?: Promise<Customer[]>;

  constructor(url: string) {
    this.pool = new Pool({
      connectionString: connectionString(url),
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000, // Neon may be waking from scale-to-zero
      statement_timeout: 8_000,
      query_timeout: 10_000,
      application_name: "contraponto-agent",
    });
    this.pool.on("error", () => {}); // an idle client dropped by the server must not crash the process
  }

  private async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    try {
      const result = await this.pool.query(sql, params);
      return result.rows as T[];
    } catch (error) {
      markDown(error);
      throw new DataUnavailableError(error instanceof Error ? error.message : String(error));
    }
  }

  async latestLoadRun(): Promise<LoadRun | null> {
    const rows = await this.query<LoadRun>(
      `SELECT load_run_id::int AS load_run_id, finished_at, source_exported_at, rows_loaded AS rows
         FROM load_runs ORDER BY load_run_id DESC LIMIT 1`,
    );
    return rows[0] ?? null;
  }

  async getCustomer(customerId: string): Promise<Customer | null> {
    const rows = await this.query<{
      customer_id: string; country: string; segment: string | null; source: string;
      display_name: string | null; security_answer: string | null; n_cards: number;
    }>(
      `SELECT c.customer_id, c.country, c.segment, c.source, c.display_name, c.security_answer,
              (SELECT count(*)::int FROM cards k WHERE k.customer_id = c.customer_id
                  AND k.product_status IN ${SERVICEABLE}) AS n_cards
         FROM customers c WHERE c.customer_id = $1`,
      [customerId],
    );
    const c = rows[0];
    if (!c) return null;
    return {
      customer_id: c.customer_id,
      country: c.country,
      segment: c.segment,
      source: c.source === "test_fixture" ? "test_fixture" : "dataset_sample",
      display_name: c.display_name ?? `${c.country} · ${c.segment ?? "—"} · ${c.n_cards} tarjeta(s)`,
      // Simulated step-up (not MFA): the fixture's city, or the dataset's country.
      security_answer: normalizeAnswer(c.security_answer ?? c.country),
      security_question: c.security_answer ? "city" : "country",
    };
  }

  async listCards(customerId: string): Promise<Card[]> {
    const rows = await this.query<CardRow>(`${CARD_SELECT} AND k.customer_id = $1 ORDER BY k.product_id`, [customerId]);
    return rows.map(toCard);
  }

  async getCard(customerId: string, cardId: string): Promise<Card | null> {
    const rows = await this.query<CardRow>(`${CARD_SELECT} AND k.customer_id = $1 AND k.product_id = $2`, [customerId, cardId]);
    return rows[0] ? toCard(rows[0]) : null;
  }

  async findCardByLastFour(customerId: string, lastFour: string): Promise<Card | null> {
    const rows = await this.query<CardRow>(
      `${CARD_SELECT} AND k.customer_id = $1 AND k.card_last4 = $2 ORDER BY k.product_id LIMIT 1`,
      [customerId, lastFour],
    );
    return rows[0] ? toCard(rows[0]) : null;
  }

  async recentTransactions(customerId: string, cardId: string, limit: number): Promise<Transaction[]> {
    // Dataset dates are exported without a time zone and are returned as such; the fixture's
    // relative times (hours_ago) are resolved now, in UTC.
    return this.query<Transaction>(
      `SELECT t.transaction_id, t.product_id AS card_id,
              CASE WHEN t.transaction_date IS NOT NULL
                   THEN to_char(t.transaction_date, 'YYYY-MM-DD"T"HH24:MI:SS')
                   ELSE to_char((now() AT TIME ZONE 'UTC') - t.hours_ago * interval '1 hour', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
              END AS date,
              NULLIF(t.merchant_name, '') AS merchant, NULLIF(t.transaction_city, '') AS city,
              t.amount::float8 AS amount, t.currency, t.transaction_status AS status,
              round(t.fraud_score::numeric, 2)::float8 AS fraud_score, NULLIF(t.dq_flags, '') AS dq_flags
         FROM transactions t
        WHERE t.customer_id = $1 AND t.product_id = $2
        ORDER BY COALESCE(t.transaction_date, (now() AT TIME ZONE 'UTC') - t.hours_ago * interval '1 hour') DESC,
                 t.transaction_id DESC
        LIMIT $3`,
      [customerId, cardId, limit],
    );
  }

  async setCardStatus(cardId: string, status: CardStatus, change: StatusChange): Promise<void> {
    await this.query(
      `INSERT INTO card_status_events (product_id, status, reason, actor, trace_id) VALUES ($1, $2, $3, $4, $5)`,
      [cardId, status, change.reason, change.actor, change.traceId ?? null],
    );
  }

  async reset(): Promise<void> {
    // Append-only: a reset is one more event per changed card, back to its source status.
    await this.query(
      `INSERT INTO card_status_events (product_id, status, reason, actor)
       SELECT k.product_id, lower(k.product_status), 'demo_reset', 'demo_reset'
         FROM (SELECT DISTINCT ON (product_id) product_id, status
                 FROM card_status_events ORDER BY product_id, event_id DESC) latest
         JOIN cards k ON k.product_id = latest.product_id
        WHERE k.product_status IN ${SERVICEABLE} AND latest.status <> lower(k.product_status)`,
    );
  }

  /** The fixture, then one dataset customer per case the demo shows, chosen by query (stable per load). */
  demoCustomers(): Promise<Customer[]> {
    this.demo ??= (async () => {
      const ids = await this.query<{ customer_id: string; hint: string | null }>(
        `WITH serviceable AS (
           SELECT customer_id, count(*) AS n, bool_and(product_status = 'Active') AS all_active,
                  bool_or(product_status = 'Blocked') AS any_blocked
             FROM cards WHERE product_status IN ${SERVICEABLE} AND source = 'dataset' GROUP BY customer_id),
         flagged AS (
           SELECT DISTINCT t.customer_id FROM transactions t JOIN cards k ON k.product_id = t.product_id
            WHERE t.fraud_score >= $1 AND k.product_status IN ${SERVICEABLE})
         (SELECT customer_id, NULL AS hint, 0 AS ord FROM customers WHERE source = 'test_fixture')
         UNION ALL
         (SELECT s.customer_id, 'fraud_score ≥ 35', 1 FROM serviceable s JOIN flagged f USING (customer_id)
           WHERE s.all_active ORDER BY s.customer_id LIMIT 1)
         UNION ALL
         (SELECT customer_id, 'bloqueada', 2 FROM serviceable WHERE any_blocked ORDER BY customer_id LIMIT 1)
         UNION ALL
         (SELECT s.customer_id, 'varias tarjetas', 3 FROM serviceable s
           WHERE s.n >= 3 AND NOT EXISTS (SELECT 1 FROM flagged f WHERE f.customer_id = s.customer_id)
           ORDER BY s.customer_id LIMIT 1)
         ORDER BY ord, customer_id`,
        [FRAUD_SCORE_CUTOFF],
      );
      const out: Customer[] = [];
      for (const { customer_id, hint } of ids) {
        const customer = await this.getCustomer(customer_id);
        if (customer) out.push(hint ? { ...customer, display_name: `${customer.display_name} · ${hint}` } : customer);
      }
      return out;
    })().catch((error) => {
      this.demo = undefined; // retry on the next request
      throw error;
    });
    return this.demo;
  }
}

// ---- Which source is live ----------------------------------------------------------

const REPROBE_MS = 60_000; // after a failure, Postgres is tried again at most once a minute
const REFRESH_MS = 10 * 60_000; // while up, the last load_run is re-read at most every 10 minutes

type SourceState = {
  pg?: PostgresRepository;
  state: "unknown" | "up" | "down";
  checkedAt: number;
  lastLoadRun?: LoadRun | null;
  error?: string;
  probing?: Promise<void>;
};

const g = globalThis as unknown as { __cardSupportSource?: SourceState };

function sourceState(): SourceState {
  g.__cardSupportSource ??= { state: "unknown", checkedAt: 0 };
  return g.__cardSupportSource;
}

function markDown(error: unknown) {
  const s = sourceState();
  s.state = "down";
  s.checkedAt = Date.now();
  s.error = error instanceof Error ? error.message : String(error);
}

async function probe(s: SourceState): Promise<void> {
  try {
    const run = await s.pg!.latestLoadRun();
    if (!run) throw new Error("no load_run: the database has not been loaded");
    s.lastLoadRun = run;
    s.state = "up";
    s.error = undefined;
  } catch (error) {
    markDown(error instanceof DataUnavailableError ? new Error(error.message) : error);
  }
  s.checkedAt = Date.now();
}

/** The repository for this request: Postgres when configured and up, else the snapshot. */
export async function repository(): Promise<Repository> {
  const url = process.env.DATABASE_URL;
  if (!url) return snapshotRepository;
  const s = sourceState();
  s.pg ??= new PostgresRepository(url);
  const age = Date.now() - s.checkedAt;
  if (s.state === "unknown") await probe(s);
  // Later checks run in the background: no request waits on a database that is down.
  else if (!s.probing && ((s.state === "down" && age > REPROBE_MS) || (s.state === "up" && age > REFRESH_MS))) {
    s.probing = probe(s).finally(() => (s.probing = undefined));
  }
  return s.state === "up" ? s.pg : snapshotRepository;
}

/** Runs fn on the live repository; if Postgres fails mid-call, runs it once more on the fallback. */
export async function withRepository<T>(fn: (repo: Repository) => Promise<T>): Promise<T> {
  try {
    return await fn(await repository());
  } catch (error) {
    if (!(error instanceof DataUnavailableError)) throw error;
    return fn(await repository());
  }
}

/** For /api/health: reports the last known state without waking the database on every check. */
export async function sourceStatus() {
  const configured = Boolean(process.env.DATABASE_URL);
  if (configured && sourceState().state === "unknown") await repository();
  const s = sourceState();
  return {
    live: configured && s.state === "up" ? "postgres" : "snapshot",
    postgres: configured
      ? { state: s.state, checked_at: s.checkedAt ? new Date(s.checkedAt).toISOString() : null, last_load_run: s.lastLoadRun ?? null, error: s.error ?? null }
      : { state: "not_configured" },
  };
}

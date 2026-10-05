// The agent's records: the snapshot built from the stage 1 Parquet export.
//
//   Snowflake CLEAN.agent_* -> export.py (Parquet + manifest, SHA-256)
//   -> data-engineering/pipelines/snapshot/build_snapshot.py (checks checksums
//      and contracts, samples card holders, merges the labeled test fixture)
//   -> snapshot/snapshot.json + snapshot/snapshot.manifest.json -> this module.
//
// On start the server re-checks the snapshot's SHA-256 against its manifest.
// A mismatch means the file changed outside the pipeline: the agent refuses
// to serve it (fail closed) and /api/health reports it.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type CardType = "credit" | "debit";
export type CardStatus = "active" | "blocked" | "suspended";

export type Card = {
  card_id: string;
  customer_id: string;
  type: CardType;
  last_four: string;
  status: CardStatus;
  expiration: string | null; // YYYY-MM
  currency: string;
  dq_flags: string | null;
  /** Test fixture hook: the block tool fails on this card. */
  simulate_block_failure?: boolean;
};

export type Transaction = {
  transaction_id: string;
  card_id: string;
  date: string; // ISO 8601
  merchant: string | null; // nulls are gaps in the data ("not recorded"), never imputed
  city: string | null;
  amount: number;
  currency: string;
  status: string;
  fraud_score: number | null;
  dq_flags: string | null;
};

export type Customer = {
  customer_id: string;
  country: string;
  segment: string | null;
  source: "dataset_sample" | "test_fixture";
  display_name: string;
  /** Simulated step-up verification (not MFA): the fixture's city, or the dataset's country. */
  security_answer: string;
  security_question: "city" | "country";
};

export const FRAUD_SCORE_CUTOFF = 35; // Q07: is_fraud = fraud_score >= ~35

type RawTransaction = Omit<Transaction, "date"> & { date?: string; hours_ago?: number };
type RawCustomer = { customer_id: string; country: string; segment: string | null; source: Customer["source"]; display_name?: string; security_answer?: string };
type Snapshot = { customers: RawCustomer[]; cards: Card[]; transactions: RawTransaction[] };
export type SnapshotManifest = {
  version: string;
  sha256: string;
  built_at: string;
  source: { exported_at: string };
  rows: Record<string, number>;
};

const DATA_DIR = join(process.cwd(), "app", "_lib", "server", "snapshot");

function normalizeAnswer(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "").trim();
}

function load() {
  const raw = readFileSync(join(DATA_DIR, "snapshot.json"));
  const manifest = JSON.parse(readFileSync(join(DATA_DIR, "snapshot.manifest.json"), "utf-8")) as SnapshotManifest;
  const actual = createHash("sha256").update(raw).digest("hex");
  if (actual !== manifest.sha256) {
    throw new Error(`snapshot checksum mismatch: manifest ${manifest.sha256.slice(0, 12)}, file ${actual.slice(0, 12)}`);
  }
  const snapshot = JSON.parse(raw.toString("utf-8")) as Snapshot;
  const now = Date.now();
  const cards = snapshot.cards;
  const cardCount = new Map<string, number>();
  for (const card of cards) cardCount.set(card.customer_id, (cardCount.get(card.customer_id) ?? 0) + 1);
  const customers: Customer[] = snapshot.customers.map((c) => ({
    customer_id: c.customer_id,
    country: c.country,
    segment: c.segment,
    source: c.source,
    display_name:
      c.display_name ?? `${c.country} · ${c.segment ?? "—"} · ${cardCount.get(c.customer_id) ?? 0} tarjeta(s)`,
    security_answer: normalizeAnswer(c.security_answer ?? c.country),
    security_question: c.security_answer ? "city" : "country",
  }));
  const transactions: Transaction[] = snapshot.transactions.map((t) => ({
    ...t,
    date: t.date ?? new Date(now - (t.hours_ago ?? 0) * 3_600_000).toISOString(),
  }));
  return { customers, cards, transactions, manifest };
}

type Loaded = ReturnType<typeof load>;
const g = globalThis as unknown as { __cardSupportData?: Loaded | Error };

function data(): Loaded {
  if (!g.__cardSupportData) {
    try {
      g.__cardSupportData = load();
    } catch (error) {
      g.__cardSupportData = error instanceof Error ? error : new Error(String(error));
    }
  }
  if (g.__cardSupportData instanceof Error) throw g.__cardSupportData;
  return g.__cardSupportData;
}

export function dataStatus(): { ok: true; manifest: SnapshotManifest } | { ok: false; error: string } {
  try {
    return { ok: true, manifest: data().manifest };
  } catch (error) {
    return { ok: false, error: String(error instanceof Error ? error.message : error) };
  }
}

export const customers = () => data().customers;
export const cards = () => data().cards;
export const transactions = () => data().transactions;

/** Test sessions offered in the demo picker: the fixture, then a few dataset customers that show each case. */
export function demoCustomers(): Customer[] {
  const all = customers();
  const fixture = all.filter((c) => c.source === "test_fixture");
  const sample = all.filter((c) => c.source === "dataset_sample");
  const cardsOf = (id: string) => cards().filter((k) => k.customer_id === id);
  const flagged = new Set(
    transactions()
      .filter((t) => t.fraud_score !== null && t.fraud_score >= FRAUD_SCORE_CUTOFF)
      .map((t) => cards().find((k) => k.card_id === t.card_id)?.customer_id),
  );
  const pick = (pred: (c: Customer) => boolean) => sample.find(pred);
  const chosen: [Customer | undefined, string][] = [
    [pick((c) => flagged.has(c.customer_id) && cardsOf(c.customer_id).every((k) => k.status === "active")), "fraud_score ≥ 35"],
    [pick((c) => cardsOf(c.customer_id).some((k) => k.status === "blocked")), "bloqueada"],
    [pick((c) => cardsOf(c.customer_id).length >= 3 && !flagged.has(c.customer_id)), "varias tarjetas"],
  ];
  return [
    ...fixture,
    ...chosen.filter(([c]) => c).map(([c, hint]) => ({ ...c!, display_name: `${c!.display_name} · ${hint}` })),
  ];
}

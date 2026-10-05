// Deterministic banking tools. Every precondition is enforced here, in code:
// ownership of the card, step-up verification, a valid confirmation. The
// conversation layer can ask for an action; it cannot authorize one.

import type { TransactionSummary } from "../api/contracts";
import { FRAUD_SCORE_CUTOFF } from "./data";
import type { Card, CardStatus } from "./data";
import { DataUnavailableError, withRepository } from "./repository";
import type { ToolCall } from "./store";

export class ToolError extends Error {
  constructor(
    public code: "not_owner" | "not_verified" | "not_confirmed" | "unavailable",
    message: string,
  ) {
    super(message);
  }
}

export type Trace = { tools: ToolCall[]; policy: string[] };

const RECENT_LIMIT = 6; // most recent movements shown to the customer
const MAX_ATTEMPTS = 3; // bounded retries for transient failures
const BACKOFF_MS = 120;

async function run<T>(trace: Trace, tool: string, fn: () => T | Promise<T>, retry = false): Promise<T> {
  const started = Date.now();
  let attempts = 0;
  for (;;) {
    attempts += 1;
    try {
      const result = await fn();
      trace.tools.push({ tool, ok: true, attempts, ms: Date.now() - started });
      return result;
    } catch (caught) {
      let error = caught;
      if (error instanceof DataUnavailableError) error = new ToolError("unavailable", "data source unavailable");
      const transient = error instanceof ToolError && error.code === "unavailable";
      if (retry && transient && attempts < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS * 2 ** (attempts - 1)));
        continue;
      }
      const detail = error instanceof ToolError ? error.code : "error";
      trace.tools.push({ tool, ok: false, attempts, ms: Date.now() - started, detail });
      throw error;
    }
  }
}

export type CardView = { card_id: string; type: Card["type"]; last_four: string; status: CardStatus; expiration: string | null };

function view(card: Card): CardView {
  return { card_id: card.card_id, type: card.type, last_four: card.last_four, status: card.status, expiration: card.expiration };
}

/** Ownership is checked in the query itself: a card of another customer is never read. */
async function ownedCard(customerId: string, cardId: string): Promise<Card> {
  const card = await withRepository((r) => r.getCard(customerId, cardId));
  if (!card) throw new ToolError("not_owner", "card does not belong to the session's customer");
  return card;
}

export function listCards(trace: Trace, customerId: string): Promise<CardView[]> {
  return run(trace, "list_cards", async () => (await withRepository((r) => r.listCards(customerId))).map(view));
}

/** Resolves "4821" to a card only among the customer's own cards. */
export function findOwnCardByLastFour(trace: Trace, customerId: string, lastFour: string): Promise<CardView | null> {
  return run(trace, "find_card", async () => {
    const card = await withRepository((r) => r.findCardByLastFour(customerId, lastFour));
    return card ? view(card) : null;
  });
}

export function getCardStatus(trace: Trace, customerId: string, cardId: string): Promise<CardView> {
  return run(trace, "get_card_status", async () => view(await ownedCard(customerId, cardId)));
}

export type ReviewedTransaction = TransactionSummary & { suspicious: boolean; fraud_score: number | null };

export function getRecentTransactions(
  trace: Trace,
  customerId: string,
  cardId: string,
  verified: boolean,
): Promise<ReviewedTransaction[]> {
  return run(trace, "get_recent_transactions", async () => {
    if (!verified) throw new ToolError("not_verified", "step-up verification required");
    await ownedCard(customerId, cardId);
    const recent = await withRepository((r) => r.recentTransactions(customerId, cardId, RECENT_LIMIT));
    return recent.map((t) => ({
        transaction_id: t.transaction_id,
        date: t.date,
        merchant: t.merchant ?? "—",
        city: t.city,
        amount: t.amount,
        currency: t.currency,
        fraud_score: t.fraud_score,
        suspicious: t.fraud_score !== null && t.fraud_score >= FRAUD_SCORE_CUTOFF,
      }));
  });
}

export async function blockCard(
  trace: Trace,
  customerId: string,
  cardId: string,
  preconditions: { verified: boolean; confirmed: boolean },
  traceId?: string,
): Promise<void> {
  await run(
    trace,
    "block_card",
    async () => {
      if (!preconditions.verified) throw new ToolError("not_verified", "step-up verification required");
      if (!preconditions.confirmed) throw new ToolError("not_confirmed", "explicit confirmation required");
      const card = await ownedCard(customerId, cardId);
      if (card.simulate_block_failure) throw new ToolError("unavailable", "card processor timeout (test hook)");
      await withRepository((r) => r.setCardStatus(cardId, "blocked", { reason: "customer_confirmed_block", actor: "agent", traceId }));
    },
    true,
  );
}

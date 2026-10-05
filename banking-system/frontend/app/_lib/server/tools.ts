// Deterministic banking tools. Every precondition is enforced here, in code:
// ownership of the card, step-up verification, a valid confirmation. The
// conversation layer can ask for an action; it cannot authorize one.

import type { TransactionSummary } from "../api/contracts";
import { cards, FRAUD_SCORE_CUTOFF, transactions } from "./data";
import type { Card, CardStatus } from "./data";
import { store } from "./store";
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
    } catch (error) {
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
  return {
    card_id: card.card_id,
    type: card.type,
    last_four: card.last_four,
    status: store().cardStatus.get(card.card_id) ?? card.status,
    expiration: card.expiration,
  };
}

function ownedCard(customerId: string, cardId: string): Card {
  const card = cards().find((c) => c.card_id === cardId);
  if (!card || card.customer_id !== customerId) {
    throw new ToolError("not_owner", "card does not belong to the session's customer");
  }
  return card;
}

export function listCards(trace: Trace, customerId: string): Promise<CardView[]> {
  return run(trace, "list_cards", () => cards().filter((c) => c.customer_id === customerId).map(view));
}

/** Resolves "4821" to a card only among the customer's own cards. */
export function findOwnCardByLastFour(trace: Trace, customerId: string, lastFour: string): Promise<CardView | null> {
  return run(trace, "find_card", () => {
    const card = cards().find((c) => c.last_four === lastFour && c.customer_id === customerId);
    return card ? view(card) : null;
  });
}

export function getCardStatus(trace: Trace, customerId: string, cardId: string): Promise<CardView> {
  return run(trace, "get_card_status", () => view(ownedCard(customerId, cardId)));
}

export type ReviewedTransaction = TransactionSummary & { suspicious: boolean; fraud_score: number | null };

export function getRecentTransactions(
  trace: Trace,
  customerId: string,
  cardId: string,
  verified: boolean,
): Promise<ReviewedTransaction[]> {
  return run(trace, "get_recent_transactions", () => {
    if (!verified) throw new ToolError("not_verified", "step-up verification required");
    ownedCard(customerId, cardId);
    return transactions()
      .filter((t) => t.card_id === cardId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, RECENT_LIMIT)
      .map((t) => ({
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
): Promise<void> {
  await run(
    trace,
    "block_card",
    () => {
      if (!preconditions.verified) throw new ToolError("not_verified", "step-up verification required");
      if (!preconditions.confirmed) throw new ToolError("not_confirmed", "explicit confirmation required");
      const card = ownedCard(customerId, cardId);
      if (card.simulate_block_failure) throw new ToolError("unavailable", "card processor timeout (test hook)");
      store().cardStatus.set(cardId, "blocked");
    },
    true,
  );
}

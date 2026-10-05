// In-memory state for the prototype: card status, conversations, handoffs and
// execution records. One Node process holds it (see README: capacity limits).
// Card status lives here only in snapshot mode; with Postgres it is the
// append-only card_status_events table (see repository.ts).
// In production this is DynamoDB, as in the original team architecture.

import type { HandoffCase, TransactionSummary } from "../api/contracts";
import type { Locale } from "../i18n";
import { cards } from "./data";
import type { CardStatus } from "./data";
import type { Intent } from "./intent";

export type Stage =
  | "idle"
  | "awaiting_card_choice"
  | "awaiting_verification"
  | "awaiting_review"
  | "awaiting_confirmation"
  | "closed";

export type Conversation = {
  session_id: string;
  customer_id: string;
  locale: Locale;
  stage: Stage;
  intent?: Intent;
  card_id?: string;
  verified: boolean;
  verification_attempts: number;
  challenge_id?: string;
  confirmation_id?: string;
  case_id?: string;
  actions_taken: string[];
  suspicious: TransactionSummary[]; // flagged by fraud_score, for the handoff
  disputed: boolean; // the customer said they do not recognize a purchase
  last_activity: number;
};

export type ToolCall = { tool: string; ok: boolean; attempts: number; ms: number; detail?: string };

export type ExecutionRecord = {
  trace_id: string;
  at: string;
  endpoint: string;
  session_id: string;
  customer_id: string | null;
  stage_before: string;
  stage_after: string;
  intent?: string;
  confidence?: number;
  model?: string;
  tools: ToolCall[];
  policy: string[]; // rules that fired: why the system acted, asked or abstained
  outcome: string;
  latency_ms: number;
};

type Store = {
  cardStatus: Map<string, CardStatus>;
  conversations: Map<string, Conversation>;
  handoffs: HandoffCase[];
  records: ExecutionRecord[];
};

const g = globalThis as unknown as { __cardSupportStore?: Store };

export function store(): Store {
  if (!g.__cardSupportStore) {
    g.__cardSupportStore = {
      cardStatus: new Map(cards().map((card) => [card.card_id, card.status])),
      conversations: new Map(),
      handoffs: [],
      records: [],
    };
  }
  return g.__cardSupportStore;
}

const MAX_RECORDS = 1000;

export function saveRecord(record: ExecutionRecord): void {
  const records = store().records;
  records.unshift(record);
  if (records.length > MAX_RECORDS) records.length = MAX_RECORDS;
  // One JSON line per turn: the platform's log stream is the audit trail.
  console.log(JSON.stringify({ type: "execution_record", ...record }));
}

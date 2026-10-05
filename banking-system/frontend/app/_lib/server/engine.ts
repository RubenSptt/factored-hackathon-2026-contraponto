// Conversation engine: Understand -> Decide -> Act -> Verify -> Escalate.
//
// The classifier only proposes what the customer wants. Every decision about
// acting is a rule in this file or a precondition in tools.ts, and every rule
// that fires is written to the execution record (trace.policy).

import { randomUUID } from "node:crypto";

import type {
  ChatResponse,
  HandoffPriority,
  HumanHandoff,
  TransactionSummary,
  UiAction,
} from "../api/contracts";
import type { Locale } from "../i18n";
import { customers } from "./data";
import { looksLikeInjection, containsFullCardNumber, mentionedCardType, mentionedLastFour, yesNo } from "./guards";
import { classify, INTENT_THRESHOLD, normalize } from "./intent";
import type { Intent, IntentPrediction } from "./intent";
import { cardLabel, handoffText, M, securityQuestion, statusLabel } from "./messages";
import { store } from "./store";
import type { Conversation } from "./store";
import {
  blockCard,
  findOwnCardByLastFour,
  getCardStatus,
  getRecentTransactions,
  listCards,
  ToolError,
} from "./tools";
import type { CardView, Trace } from "./tools";

export type EngineTrace = Trace & { prediction?: IntentPrediction; outcome: string };

const CONVERSATION_IDLE_LIMIT_MS = 10 * 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 2;
const NEEDS_STEP_UP: Intent[] = ["recent_transactions", "lost_stolen_card", "unrecognized_charge", "block_card"];

function reply(text: string, ui_actions: UiAction[] = []): ChatResponse {
  return { reply: text, ui_actions };
}

function newId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

// ---- Conversations ------------------------------------------------------------

export function getConversation(sessionId: string, customerId: string, locale: Locale): Conversation | "forbidden" {
  const conversations = store().conversations;
  const existing = conversations.get(sessionId);
  if (existing && existing.customer_id !== customerId) return "forbidden";
  if (existing && Date.now() - existing.last_activity < CONVERSATION_IDLE_LIMIT_MS) {
    existing.locale = locale;
    existing.last_activity = Date.now();
    return existing;
  }
  const created: Conversation = {
    session_id: sessionId,
    customer_id: customerId,
    locale,
    stage: "idle",
    verified: false,
    verification_attempts: 0,
    actions_taken: [],
    suspicious: [],
    disputed: false,
    last_activity: Date.now(),
  };
  conversations.set(sessionId, created);
  return created;
}

function questionKind(conv: Conversation): "city" | "country" {
  return customers().find((c) => c.customer_id === conv.customer_id)?.security_question ?? "city";
}

// ---- Handoff -------------------------------------------------------------------

/** Backend rule: unverified identity, or suspected fraud on an unblocked card, is urgent. */
export function priorityFor(handoff: HumanHandoff): HandoffPriority {
  const fraudSuspected = handoff.suspicious_transactions.length > 0 || handoff.intent === "suspicious_transaction";
  if (!handoff.customer_verified) return "urgent";
  if (fraudSuspected && !handoff.card_blocked) return "urgent";
  if (handoff.card_blocked) return "high";
  return "normal";
}

const HANDOFF_INTENT: Record<Intent, string> = {
  lost_stolen_card: "stolen_card",
  unrecognized_charge: "suspicious_transaction",
  card_status: "card_status",
  recent_transactions: "recent_transactions",
  block_card: "block_card",
  unblock_card: "unblock_card",
  human_agent: "human_request",
  out_of_scope: "out_of_scope",
  greeting: "other",
};

export async function createHandoff(
  conv: Conversation,
  trace: EngineTrace,
  fields: { risk: string[]; questions: string[]; card?: CardView; blocked?: boolean; urgent?: boolean },
): Promise<UiAction> {
  const caseId = `CS-${Math.floor(100000 + Math.random() * 900000)}`;
  const handoff: HumanHandoff = {
    case_id: caseId,
    customer_verified: conv.verified,
    intent: HANDOFF_INTENT[conv.intent ?? "greeting"],
    card_last_four: fields.card?.last_four ?? null,
    card_blocked: fields.blocked ?? false,
    suspicious_transactions: conv.suspicious,
    actions_taken: [...conv.actions_taken],
    risk_reason: fields.risk.join(" "),
    unresolved_questions: fields.questions,
  };
  let priority = priorityFor(handoff);
  if (fields.urgent) priority = "urgent";
  store().handoffs.unshift({
    handoff,
    created_at: new Date().toISOString(),
    priority,
    status: "open",
    customer_locale: conv.locale,
  });
  conv.case_id = caseId;
  conv.stage = "closed";
  trace.policy.push(`handoff_created:${priority}`);
  trace.outcome = "handoff";
  return { type: "handoff_created", handoff };
}

// ---- Card resolution ------------------------------------------------------------

type CardChoice = { card: CardView } | { response: ChatResponse };

async function resolveCard(conv: Conversation, text: string, trace: EngineTrace): Promise<CardChoice> {
  const m = M[conv.locale];
  const lastFour = mentionedLastFour(text, conv.stage === "awaiting_card_choice");
  if (lastFour) {
    const card = await findOwnCardByLastFour(trace, conv.customer_id, lastFour);
    if (!card) {
      trace.policy.push("ownership_denied");
      trace.outcome = "refused_not_owner";
      conv.stage = "idle";
      return { response: reply(m.notOwned(lastFour)) };
    }
    return { card };
  }
  const cards = await listCards(trace, conv.customer_id);
  const type = mentionedCardType(text);
  const candidates = type ? cards.filter((c) => c.type === type) : cards;
  if (candidates.length === 1) return { card: candidates[0] };
  if (cards.length === 0) {
    const action = await createHandoff(conv, trace, { risk: [handoffText[conv.locale].toolRisk], questions: [handoffText[conv.locale].whatNeeded] });
    return { response: reply(m.noCards, [action]) };
  }
  trace.policy.push("ambiguous_card_clarify");
  trace.outcome = "clarify";
  conv.stage = "awaiting_card_choice";
  const list = cards.map((c) => cardLabel(conv.locale, c)).join(conv.locale === "es" ? " y " : " e ");
  return { response: reply(m.chooseCard(list, new Set(cards.map((c) => c.type)).size > 1)) };
}

// ---- Steps -----------------------------------------------------------------------

async function proceedWithCard(conv: Conversation, card: CardView, trace: EngineTrace): Promise<ChatResponse> {
  const m = M[conv.locale];
  conv.card_id = card.card_id;
  const label = cardLabel(conv.locale, card);
  const intent = conv.intent!;

  if (intent === "card_status") {
    const fresh = await getCardStatus(trace, conv.customer_id, card.card_id);
    conv.stage = "idle";
    trace.outcome = "resolved";
    const hint = fresh.status === "blocked" ? m.statusBlockedHint : "";
    return reply(m.status(label, statusLabel(conv.locale, fresh.status), fresh.expiration) + hint);
  }

  if ((intent === "block_card" || intent === "lost_stolen_card") && card.status === "blocked") {
    trace.policy.push("already_blocked_no_action");
    conv.stage = "idle";
    trace.outcome = "resolved";
    return reply(m.alreadyBlocked(label));
  }

  if (NEEDS_STEP_UP.includes(intent) && !conv.verified) {
    trace.policy.push("step_up_required");
    conv.stage = "awaiting_verification";
    conv.challenge_id = newId("chal");
    trace.outcome = "verification_requested";
    return reply(m.askVerification(label), [
      { type: "step_up_verification", challenge_id: conv.challenge_id, question: securityQuestion(conv.locale, questionKind(conv)) },
    ]);
  }
  return afterVerification(conv, card, trace);
}

async function afterVerification(conv: Conversation, card: CardView, trace: EngineTrace): Promise<ChatResponse> {
  const m = M[conv.locale];
  const label = cardLabel(conv.locale, card);
  if (conv.intent === "block_card") return proposeBlock(conv, card, trace);

  const transactions = await getRecentTransactions(trace, conv.customer_id, card.card_id, conv.verified);
  conv.actions_taken.push("transactions_reviewed");
  const flagged = transactions.filter((t) => t.suspicious);
  conv.suspicious = flagged.map(stripScore);
  if (flagged.length) trace.policy.push(`fraud_score_flagged:${flagged.length}`);
  const review: UiAction = { type: "transaction_review", card_last_four: card.last_four, transactions: transactions.map(stripScore) };

  if (conv.intent === "recent_transactions") {
    conv.stage = "idle";
    trace.outcome = "resolved";
    return reply(m.reviewOnly(label), [review]);
  }
  conv.stage = "awaiting_review";
  trace.outcome = "review_requested";
  return reply(m.review(label, flagged.length), [review]);
}

function stripScore(t: TransactionSummary & { suspicious?: boolean; fraud_score?: number | null }): TransactionSummary {
  return { transaction_id: t.transaction_id, date: t.date, merchant: t.merchant, city: t.city, amount: t.amount, currency: t.currency };
}

function proposeBlock(conv: Conversation, card: CardView, trace: EngineTrace): ChatResponse {
  conv.stage = "awaiting_confirmation";
  conv.confirmation_id = newId("conf");
  trace.policy.push("confirmation_required");
  trace.outcome = "confirmation_requested";
  return reply(M[conv.locale].proposeBlock(cardLabel(conv.locale, card)), [
    { type: "confirm_action", confirmation_id: conv.confirmation_id, action: "block_card", card_last_four: card.last_four },
  ]);
}

async function currentCard(conv: Conversation, trace: EngineTrace): Promise<CardView> {
  return getCardStatus(trace, conv.customer_id, conv.card_id!);
}

// ---- Public handlers ---------------------------------------------------------------

export async function handleMessage(conv: Conversation, text: string, trace: EngineTrace): Promise<ChatResponse> {
  const m = M[conv.locale];
  const t = handoffText[conv.locale];

  if (containsFullCardNumber(text)) {
    trace.policy.push("full_card_number_rejected");
    trace.outcome = "refused_card_number";
    return reply(m.cardNumber);
  }
  if (looksLikeInjection(text)) {
    trace.policy.push("injection_refused");
    trace.outcome = "refused_injection";
    return reply(m.injection);
  }

  switch (conv.stage) {
    case "closed":
      trace.outcome = "closed";
      return reply(m.closed(conv.case_id ?? ""));
    case "awaiting_verification":
      trace.outcome = "waiting";
      return reply(m.verificationPending);
    case "awaiting_confirmation":
      trace.outcome = "waiting";
      return reply(m.confirmationPending);
    case "awaiting_card_choice": {
      const choice = await resolveCard(conv, text, trace);
      if ("response" in choice) return choice.response;
      return proceedWithCard(conv, choice.card, trace);
    }
    case "awaiting_review": {
      const answer = yesNo(text);
      const card = await currentCard(conv, trace);
      if (answer === null) {
        trace.outcome = "clarify";
        return reply(m.reviewPending);
      }
      if (answer === "yes" && conv.intent === "unrecognized_charge") {
        conv.stage = "idle";
        trace.outcome = "resolved";
        return reply(m.allRecognized);
      }
      if (answer === "no") conv.disputed = true;
      return proposeBlock(conv, card, trace);
    }
    case "idle":
      break;
  }

  const prediction = classify(text);
  trace.prediction = prediction;
  if (prediction.confidence < INTENT_THRESHOLD) {
    trace.policy.push("low_confidence_clarify");
    trace.outcome = "clarify";
    return reply(m.clarify);
  }
  conv.intent = prediction.intent;

  switch (prediction.intent) {
    case "greeting":
      trace.outcome = "clarify";
      return reply(m.greeting);
    case "out_of_scope":
      trace.policy.push("out_of_scope_abstain");
      trace.outcome = "abstained";
      return reply(m.outOfScope);
    case "human_agent": {
      conv.actions_taken.push("human_requested");
      const action = await createHandoff(conv, trace, { risk: [t.humanRisk], questions: [t.whatNeeded] });
      return reply(m.human, [action]);
    }
    case "unblock_card": {
      trace.policy.push("unblock_not_automated");
      conv.actions_taken.push("unblock_requested");
      const lastFour = mentionedLastFour(text);
      const card = lastFour ? await findOwnCardByLastFour(trace, conv.customer_id, lastFour) : null;
      const action = await createHandoff(conv, trace, {
        risk: [t.unblockRisk],
        questions: [t.verifyIdentity, t.decideUnblock],
        card: card ?? undefined,
        blocked: card?.status === "blocked",
      });
      return reply(m.unblock, [action]);
    }
    default: {
      const choice = await resolveCard(conv, text, trace);
      if ("response" in choice) return choice.response;
      return proceedWithCard(conv, choice.card, trace);
    }
  }
}

export async function handleVerification(
  conv: Conversation,
  challengeId: string,
  answer: string,
  trace: EngineTrace,
): Promise<ChatResponse> {
  const m = M[conv.locale];
  const t = handoffText[conv.locale];
  if (conv.stage !== "awaiting_verification" || conv.challenge_id !== challengeId) {
    trace.policy.push("stale_challenge");
    trace.outcome = "expired_request";
    return reply(m.expired);
  }
  const customer = customers().find((c) => c.customer_id === conv.customer_id)!;
  conv.verification_attempts += 1;
  if (normalize(answer) === customer.security_answer) {
    conv.verified = true;
    conv.actions_taken.push("identity_verified");
    trace.policy.push("step_up_passed");
    const card = await currentCard(conv, trace);
    return afterVerification(conv, card, trace);
  }
  trace.policy.push("step_up_failed");
  if (conv.verification_attempts < MAX_VERIFICATION_ATTEMPTS) {
    conv.challenge_id = newId("chal");
    trace.outcome = "verification_retry";
    return reply(m.verificationRetry, [
      { type: "step_up_verification", challenge_id: conv.challenge_id, question: securityQuestion(conv.locale, questionKind(conv)) },
    ]);
  }
  conv.actions_taken.push("identity_verification_failed");
  const action = await createHandoff(conv, trace, {
    risk: [t.failedRisk],
    questions: [t.verifyIdentity, t.decideBlock],
    urgent: true,
  });
  return reply(m.verificationFailed, [action]);
}

export async function handleConfirmation(
  conv: Conversation,
  confirmationId: string,
  decision: "confirm" | "cancel",
  trace: EngineTrace,
): Promise<ChatResponse> {
  const m = M[conv.locale];
  const t = handoffText[conv.locale];
  if (conv.stage !== "awaiting_confirmation" || conv.confirmation_id !== confirmationId) {
    trace.policy.push("stale_confirmation");
    trace.outcome = "expired_request";
    return reply(m.expired);
  }
  conv.confirmation_id = undefined; // single use
  const card = await currentCard(conv, trace);
  const label = cardLabel(conv.locale, card);
  const reportedProblem = conv.disputed || conv.intent === "unrecognized_charge" || conv.suspicious.length > 0;
  const risk = [conv.intent === "unrecognized_charge" ? t.chargeRisk : t.stolenRisk];
  if (conv.suspicious.length) risk.push(t.flaggedRisk(conv.suspicious.length));

  if (decision === "cancel") {
    conv.actions_taken.push("block_declined_by_customer");
    trace.policy.push("customer_declined_action");
    if (reportedProblem) {
      const action = await createHandoff(conv, trace, { risk, questions: [t.whichTransactions, t.declined], card });
      return reply(m.cancelled, [action]);
    }
    conv.stage = "idle";
    trace.outcome = "resolved_no_action";
    return reply(m.cancelledNoCase);
  }

  try {
    await blockCard(trace, conv.customer_id, card.card_id, { verified: conv.verified, confirmed: true });
  } catch (error) {
    if (!(error instanceof ToolError) || error.code !== "unavailable") throw error;
    conv.actions_taken.push("block_attempt_failed");
    trace.policy.push("bounded_retries_exhausted");
    const action = await createHandoff(conv, trace, {
      risk: [...risk, t.blockFailedRisk],
      questions: [t.blockManually, t.whichTransactions],
      card,
      urgent: true,
    });
    return reply(m.blockFailed(label), [
      { type: "action_result", action: "block_card", card_last_four: card.last_four, verified: false },
      action,
    ]);
  }
  conv.actions_taken.push("card_blocked");

  // Verify: re-read the status instead of trusting the write.
  const after = await getCardStatus(trace, conv.customer_id, card.card_id);
  const verified = after.status === "blocked";
  const result: UiAction = { type: "action_result", action: "block_card", card_last_four: card.last_four, verified };
  if (!verified) {
    trace.policy.push("post_action_check_failed");
    const action = await createHandoff(conv, trace, { risk: [...risk, t.blockFailedRisk], questions: [t.blockManually], card, urgent: true });
    return reply(m.blockUnverified(label), [result, action]);
  }
  conv.actions_taken.push("card_status_verified");
  trace.policy.push("post_action_check_passed");

  if (reportedProblem) {
    const action = await createHandoff(conv, trace, { risk, questions: [t.whichTransactions], card: after, blocked: true });
    return reply(m.blockedHandoff(label), [result, action]);
  }
  conv.stage = "idle";
  trace.outcome = "resolved";
  return reply(m.blockedResolved(label), [result]);
}

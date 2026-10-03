// Wire contract between the frontend and the FastAPI backend.
//
// Field names are snake_case so that they match the backend's Pydantic models
// and the handoff JSON in PRODUCT.md without a translation layer.
// Status: proposed by the frontend; pending confirmation by the backend owner.
//
// Security rules encoded here:
// - No request carries customer_id. Identity comes from the trusted session.
// - The frontend never decides whether an action is allowed. It renders what
//   the backend asks for and sends the customer's answer back.

import type { Locale } from "../i18n";

// ---- Requests --------------------------------------------------------------

/** POST /chat/messages */
export type ChatRequest = {
  session_id: string;
  message: string;
  locale: Locale;
};

/** POST /chat/verification — answer to a step-up identity question. */
export type VerificationAnswerRequest = {
  session_id: string;
  challenge_id: string;
  answer: string;
  locale: Locale;
};

/** POST /chat/confirmations — the customer's decision on a sensitive action. */
export type ConfirmActionRequest = {
  session_id: string;
  confirmation_id: string;
  decision: "confirm" | "cancel";
  locale: Locale;
};

// ---- Responses -------------------------------------------------------------

/** Every endpoint answers with the agent's text plus structured UI actions. */
export type ChatResponse = {
  reply: string;
  ui_actions: UiAction[];
};

export type SensitiveAction = "block_card";

export type TransactionSummary = {
  transaction_id: string;
  date: string; // ISO 8601
  merchant: string;
  city: string | null; // null when the record has no city ("not recorded")
  amount: number;
  currency: string; // ISO 4217
};

/** Same fields as the handoff example in PRODUCT.md. */
export type HumanHandoff = {
  case_id: string;
  customer_verified: boolean;
  intent: string;
  card_last_four: string | null;
  card_blocked: boolean;
  suspicious_transactions: TransactionSummary[];
  actions_taken: string[];
  risk_reason: string;
  unresolved_questions: string[];
};

export type UiAction =
  | {
      type: "step_up_verification";
      challenge_id: string;
      question: string;
    }
  | {
      type: "transaction_review";
      card_last_four: string;
      transactions: TransactionSummary[];
    }
  | {
      type: "confirm_action";
      confirmation_id: string;
      action: SensitiveAction;
      card_last_four: string;
    }
  | {
      type: "action_result";
      action: SensitiveAction;
      card_last_four: string;
      verified: boolean; // true only when the backend re-read the card status
    }
  | {
      type: "handoff_created";
      handoff: HumanHandoff;
    };

// ---- Client ----------------------------------------------------------------

export interface CardSupportApi {
  sendMessage(request: ChatRequest): Promise<ChatResponse>;
  answerVerification(request: VerificationAnswerRequest): Promise<ChatResponse>;
  confirmAction(request: ConfirmActionRequest): Promise<ChatResponse>;
}

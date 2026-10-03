// Mock store for escalated cases, shared by the customer chat mock and the
// agent desk mock. It keeps a few fictional seed cases plus the cases created
// during the demo, saved in this browser's localStorage so the agent view can
// be opened in another tab. Nothing here comes from the hackathon dataset.

import type { Locale } from "../i18n";
import type { HandoffCase, HandoffPriority, HumanHandoff } from "./contracts";

const STORAGE_KEY = "card-support-demo-handoffs";

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

/**
 * Mirrors the backend rule the team proposes: unverified identity or an
 * unblocked card with suspected fraud is urgent; a blocked card is high.
 */
export function priorityFor(handoff: HumanHandoff): HandoffPriority {
  const fraudSuspected =
    handoff.suspicious_transactions.length > 0 ||
    handoff.intent === "stolen_card" ||
    handoff.intent === "suspicious_transaction";
  if (!handoff.customer_verified) return "urgent";
  if (fraudSuspected && !handoff.card_blocked) return "urgent";
  if (handoff.card_blocked) return "high";
  return "normal";
}

function seedCases(): HandoffCase[] {
  const seeds: Array<Omit<HandoffCase, "priority">> = [
    {
      created_at: minutesAgo(8),
      status: "open",
      customer_locale: "es",
      handoff: {
        case_id: "CS-219004",
        customer_verified: false,
        intent: "stolen_card",
        card_last_four: null,
        card_blocked: false,
        suspicious_transactions: [],
        actions_taken: ["identity_verification_failed"],
        risk_reason:
          "La verificación de identidad falló mientras el cliente reportaba el robo de su tarjeta. No se ejecutó ninguna acción.",
        unresolved_questions: [
          "Verificar la identidad del cliente por un canal aprobado.",
          "Decidir si se bloquea la tarjeta una vez confirmada la identidad.",
        ],
      },
    },
    {
      created_at: minutesAgo(26),
      status: "open",
      customer_locale: "pt",
      handoff: {
        case_id: "CS-482913",
        customer_verified: true,
        intent: "suspicious_transaction",
        card_last_four: "7310",
        card_blocked: true,
        suspicious_transactions: [
          {
            transaction_id: "tx-seed-118",
            date: minutesAgo(95),
            merchant: "Loja Online Prime",
            city: null,
            amount: 1890,
            currency: "USD",
          },
        ],
        actions_taken: [
          "identity_verified",
          "transactions_reviewed",
          "card_blocked",
          "card_status_verified",
        ],
        risk_reason:
          "O cliente não reconhece uma compra online de alto valor sem cidade registrada.",
        unresolved_questions: ["Abrir a disputa da cobrança e confirmar o endereço para o novo cartão."],
      },
    },
    {
      created_at: minutesAgo(190),
      status: "in_progress",
      customer_locale: "es",
      handoff: {
        case_id: "CS-905117",
        customer_verified: true,
        intent: "lost_card",
        card_last_four: "2206",
        card_blocked: false,
        suspicious_transactions: [],
        actions_taken: ["identity_verified", "transactions_reviewed", "block_declined_by_customer"],
        risk_reason:
          "El cliente cree que dejó la tarjeta en casa y prefirió no bloquearla. No reconoce movimientos extraños.",
        unresolved_questions: ["Confirmar con el cliente si encontró la tarjeta."],
      },
    },
  ];
  return seeds.map((seed) => ({ ...seed, priority: priorityFor(seed.handoff) }));
}

function readSaved(): HandoffCase[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HandoffCase[]) : [];
  } catch {
    return [];
  }
}

export function saveHandoff(handoff: HumanHandoff, customerLocale: Locale): void {
  const created: HandoffCase = {
    handoff,
    created_at: new Date().toISOString(),
    priority: priorityFor(handoff),
    status: "open",
    customer_locale: customerLocale,
  };
  try {
    const saved = readSaved().filter((item) => item.handoff.case_id !== handoff.case_id);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([created, ...saved].slice(0, 20)));
  } catch {
    // Storage can be unavailable (private mode); the demo still works in-page.
  }
}

export function allHandoffs(): HandoffCase[] {
  return [...readSaved(), ...seedCases()].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
}

// In-memory mock of the backend, used until the FastAPI endpoints exist.
//
// It walks through the primary demo scenario in PRODUCT.md:
// incident -> step-up verification -> transaction review -> explicit
// confirmation -> block -> verified result -> structured human handoff.
// A failed verification skips every action and goes straight to a human.
//
// Everything here is fictional demo data. Nothing is read from the dataset,
// and none of these rules are the real authorization logic: that belongs to
// the backend tools.

import type { Locale } from "../i18n";
import type {
  CardSupportApi,
  ChatRequest,
  ChatResponse,
  ConfirmActionRequest,
  HumanHandoff,
  TransactionSummary,
  VerificationAnswerRequest,
} from "./contracts";

type Stage =
  | "idle"
  | "awaiting_verification"
  | "awaiting_review"
  | "awaiting_confirmation"
  | "closed";

type Session = {
  stage: Stage;
  challengeId?: string;
  confirmationId?: string;
  caseId?: string;
};

const CARD_LAST_FOUR = "4821";
const SIMULATED_LATENCY_MS = 650;
const sessions = new Map<string, Session>();

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function recentTransactions(): TransactionSummary[] {
  return [
    {
      transaction_id: "tx-demo-003",
      date: hoursAgo(2),
      merchant: "Electrónica Express",
      city: "Guadalajara",
      amount: 12499,
      currency: "MXN",
    },
    {
      transaction_id: "tx-demo-002",
      date: hoursAgo(30),
      merchant: "Movilidad Urbana",
      city: "Ciudad de México",
      amount: 132,
      currency: "MXN",
    },
    {
      transaction_id: "tx-demo-001",
      date: hoursAgo(75),
      merchant: "Supermercado Central",
      city: null,
      amount: 845.5,
      currency: "MXN",
    },
  ];
}

const replies = {
  es: {
    clarify:
      "Puedo ayudarte si perdiste tu tarjeta o te la robaron, si ves una compra que no reconoces o si quieres saber el estado de tu tarjeta. ¿Qué pasó?",
    status: `Tu tarjeta de crédito •••• ${CARD_LAST_FOUR} está activa. Si la perdiste o ves un movimiento extraño, dímelo y te ayudo a protegerla.`,
    askVerification:
      "Siento lo que pasó. Antes de revisar tu tarjeta necesito confirmar que eres tú. Responde la pregunta de seguridad.",
    verificationPending: "Primero responde la pregunta de seguridad en la tarjeta de arriba.",
    verificationFailed:
      "No pude verificar tu identidad, así que no voy a hacer cambios en tu tarjeta. Pasé tu caso a un agente humano con prioridad; te contactará por tus canales registrados.",
    review: `Gracias, verifiqué tu identidad. Estos son los últimos movimientos de tu tarjeta •••• ${CARD_LAST_FOUR}. ¿Reconoces todas estas compras?`,
    proposeBlock: `Por lo que me cuentas, te recomiendo bloquear ahora la tarjeta •••• ${CARD_LAST_FOUR} para evitar nuevos cargos. El bloqueo es inmediato y no se puede deshacer desde este chat. ¿Confirmas?`,
    confirmationPending: "Usa los botones de la tarjeta de arriba para confirmar o cancelar el bloqueo.",
    blocked:
      "Listo: bloqueé la tarjeta y comprobé en el sistema que quedó bloqueada. Como mencionaste una compra que no hiciste, abrí un caso con un agente humano para revisar el cargo.",
    cancelled:
      "Entendido, no bloqueé la tarjeta. Como reportaste una compra que no reconoces, de todas formas pasé tu caso a un agente humano para que lo revise.",
    closed: (caseId: string) =>
      `Tu caso ${caseId} ya está con un agente humano, que te contactará pronto. Si hay algo nuevo, cuéntamelo y lo agrego al caso.`,
    expired: "Esa solicitud ya no está vigente. Cuéntame de nuevo qué necesitas.",
  },
  pt: {
    clarify:
      "Posso ajudar se você perdeu o cartão ou ele foi roubado, se vê uma compra que não reconhece ou se quer saber o status do seu cartão. O que aconteceu?",
    status: `Seu cartão de crédito •••• ${CARD_LAST_FOUR} está ativo. Se você o perdeu ou vê uma movimentação estranha, me avise e eu ajudo a protegê-lo.`,
    askVerification:
      "Sinto muito pelo que aconteceu. Antes de revisar seu cartão, preciso confirmar que é você. Responda à pergunta de segurança.",
    verificationPending: "Primeiro responda à pergunta de segurança no cartão acima.",
    verificationFailed:
      "Não consegui verificar sua identidade, então não vou fazer alterações no seu cartão. Encaminhei seu caso com prioridade para um atendente humano, que entrará em contato pelos seus canais cadastrados.",
    review: `Obrigado, verifiquei sua identidade. Estas são as últimas movimentações do seu cartão •••• ${CARD_LAST_FOUR}. Você reconhece todas essas compras?`,
    proposeBlock: `Pelo que você contou, recomendo bloquear agora o cartão •••• ${CARD_LAST_FOUR} para evitar novas cobranças. O bloqueio é imediato e não pode ser desfeito por este chat. Você confirma?`,
    confirmationPending: "Use os botões do cartão acima para confirmar ou cancelar o bloqueio.",
    blocked:
      "Pronto: bloqueei o cartão e confirmei no sistema que ele está bloqueado. Como você mencionou uma compra que não fez, abri um caso com um atendente humano para revisar a cobrança.",
    cancelled:
      "Entendido, não bloqueei o cartão. Como você relatou uma compra que não reconhece, encaminhei mesmo assim seu caso para um atendente humano revisar.",
    closed: (caseId: string) =>
      `Seu caso ${caseId} já está com um atendente humano, que entrará em contato em breve. Se houver algo novo, me conte e eu adiciono ao caso.`,
    expired: "Essa solicitação não está mais válida. Conte de novo do que você precisa.",
  },
} satisfies Record<Locale, Record<string, string | ((caseId: string) => string)>>;

const securityQuestion: Record<Locale, string> = {
  es: "¿En qué ciudad abriste tu cuenta con el banco?",
  pt: "Em qual cidade você abriu sua conta no banco?",
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

const INCIDENT_PATTERN =
  /robar|robaron|robo|hurt|perd|extravi|no hice|no reconozco|fraude|roub|nao fiz|nao reconheco|golpe|\bbloquear\b/;
const STATUS_PATTERN = /estado|status|activa|ativo|bloquead/;
const UNKNOWN_ANSWER_PATTERN = /^(no se|no lo se|no recuerdo|nao sei|nao lembro|ni idea)\b/;

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function newCaseId(): string {
  return `CS-${Math.floor(100000 + Math.random() * 900000)}`;
}

function getSession(sessionId: string): Session {
  const existing = sessions.get(sessionId);
  if (existing) return existing;
  const created: Session = { stage: "idle" };
  sessions.set(sessionId, created);
  return created;
}

function buildHandoff(session: Session, overrides: Partial<HumanHandoff>): HumanHandoff {
  const caseId = newCaseId();
  session.caseId = caseId;
  session.stage = "closed";
  return {
    case_id: caseId,
    customer_verified: true,
    intent: "stolen_card",
    card_last_four: CARD_LAST_FOUR,
    card_blocked: false,
    suspicious_transactions: [],
    actions_taken: [],
    risk_reason: "Customer reports a stolen wallet and a purchase they did not make.",
    unresolved_questions: ["Which of the listed transactions does the customer not recognize?"],
    ...overrides,
  };
}

async function simulateLatency(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));
}

export const mockCardSupportApi: CardSupportApi = {
  async sendMessage({ session_id, message, locale }: ChatRequest): Promise<ChatResponse> {
    await simulateLatency();
    const session = getSession(session_id);
    const text = normalize(message);
    const r = replies[locale];

    switch (session.stage) {
      case "awaiting_verification":
        return { reply: r.verificationPending, ui_actions: [] };
      case "awaiting_confirmation":
        return { reply: r.confirmationPending, ui_actions: [] };
      case "awaiting_review": {
        session.stage = "awaiting_confirmation";
        session.confirmationId = newId("conf");
        return {
          reply: r.proposeBlock,
          ui_actions: [
            {
              type: "confirm_action",
              confirmation_id: session.confirmationId,
              action: "block_card",
              card_last_four: CARD_LAST_FOUR,
            },
          ],
        };
      }
      case "closed":
        return { reply: r.closed(session.caseId ?? ""), ui_actions: [] };
      case "idle":
        break;
    }

    if (INCIDENT_PATTERN.test(text)) {
      session.stage = "awaiting_verification";
      session.challengeId = newId("chal");
      return {
        reply: r.askVerification,
        ui_actions: [
          {
            type: "step_up_verification",
            challenge_id: session.challengeId,
            question: securityQuestion[locale],
          },
        ],
      };
    }

    if (STATUS_PATTERN.test(text)) {
      return { reply: r.status, ui_actions: [] };
    }

    return { reply: r.clarify, ui_actions: [] };
  },

  async answerVerification({
    session_id,
    challenge_id,
    answer,
    locale,
  }: VerificationAnswerRequest): Promise<ChatResponse> {
    await simulateLatency();
    const session = getSession(session_id);
    const r = replies[locale];

    if (session.stage !== "awaiting_verification" || session.challengeId !== challenge_id) {
      return { reply: r.expired, ui_actions: [] };
    }

    const normalized = normalize(answer).trim();
    if (normalized.length < 2 || UNKNOWN_ANSWER_PATTERN.test(normalized)) {
      const handoff = buildHandoff(session, {
        customer_verified: false,
        card_last_four: null,
        risk_reason:
          "Step-up verification failed while the customer reported a stolen card. No action was taken.",
        actions_taken: ["identity_verification_failed"],
        unresolved_questions: [
          "Verify the customer's identity through an approved channel.",
          "Decide whether to block the card once identity is confirmed.",
        ],
      });
      return {
        reply: r.verificationFailed,
        ui_actions: [{ type: "handoff_created", handoff }],
      };
    }

    session.stage = "awaiting_review";
    return {
      reply: r.review,
      ui_actions: [
        {
          type: "transaction_review",
          card_last_four: CARD_LAST_FOUR,
          transactions: recentTransactions(),
        },
      ],
    };
  },

  async confirmAction({
    session_id,
    confirmation_id,
    decision,
    locale,
  }: ConfirmActionRequest): Promise<ChatResponse> {
    await simulateLatency();
    const session = getSession(session_id);
    const r = replies[locale];

    if (session.stage !== "awaiting_confirmation" || session.confirmationId !== confirmation_id) {
      return { reply: r.expired, ui_actions: [] };
    }

    if (decision === "cancel") {
      const handoff = buildHandoff(session, {
        actions_taken: ["identity_verified", "transactions_reviewed", "block_declined_by_customer"],
        unresolved_questions: [
          "Which of the listed transactions does the customer not recognize?",
          "The customer declined the preventive block: confirm whether the card is still in their possession.",
        ],
      });
      return { reply: r.cancelled, ui_actions: [{ type: "handoff_created", handoff }] };
    }

    const handoff = buildHandoff(session, {
      card_blocked: true,
      actions_taken: [
        "identity_verified",
        "transactions_reviewed",
        "card_blocked",
        "card_status_verified",
      ],
    });
    return {
      reply: r.blocked,
      ui_actions: [
        {
          type: "action_result",
          action: "block_card",
          card_last_four: CARD_LAST_FOUR,
          verified: true,
        },
        { type: "handoff_created", handoff },
      ],
    };
  },
};

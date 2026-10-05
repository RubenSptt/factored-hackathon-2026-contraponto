// UI strings for the customer-facing assistant.
// The agent answers in the user's language on its own; these strings only
// cover the interface around the conversation.

export const LOCALES = ["es", "pt"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "es";

export type Dictionary = {
  localeName: string;
  languageLabel: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  greeting: string;
  suggestionsLabel: string;
  suggestions: readonly string[];
  inputLabel: string;
  inputPlaceholder: string;
  inputHint: string;
  send: string;
  sending: string;
  youLabel: string;
  assistantLabel: string;
  typing: string;
  sendError: string;
  cardNumberWarning: string;
  disclaimer: string;
  newConversation: string;
  yes: string;
  no: string;
  verification: {
    title: string;
    answerLabel: string;
    submit: string;
    answered: string;
    note: string;
  };
  transactions: {
    title: (lastFour: string) => string;
    date: string;
    merchant: string;
    city: string;
    amount: string;
    notRecorded: string;
  };
  confirmBlock: {
    title: string;
    body: (lastFour: string) => string;
    confirm: string;
    cancel: string;
    confirmed: string;
    cancelled: string;
  };
  blockResult: {
    verified: (lastFour: string) => string;
    verifiedNote: string;
    unverified: (lastFour: string) => string;
    unverifiedNote: string;
  };
  handoff: {
    title: string;
    caseLabel: string;
    identityVerified: string;
    cardBlocked: string;
    actionsTaken: string;
    nextStep: string;
    actions: Record<string, string>;
  };
  nav: {
    brand: string;
    customer: string;
    agent: string;
  };
  agentDesk: {
    title: string;
    subtitle: string;
    demoNote: string;
    dataSource: {
      label: string;
      postgres: string;
      snapshot: string;
      exported: string;
      sample: string;
      loaded: string;
      customers: string;
      cards: string;
      transactions: string;
    };
    loading: string;
    empty: string;
    loadError: string;
    columns: {
      caseId: string;
      priority: string;
      reason: string;
      identity: string;
      card: string;
      opened: string;
      status: string;
    };
    priority: Record<"urgent" | "high" | "normal", string>;
    status: Record<"open" | "in_progress" | "resolved", string>;
    intents: Record<string, string>;
    verified: string;
    notVerified: string;
    blocked: string;
    notBlocked: string;
    noCard: string;
    minutesAgo: (minutes: number) => string;
    hoursAgo: (hours: number) => string;
    back: string;
    notFound: (caseId: string) => string;
    facts: string;
    customerLanguage: string;
    riskReason: string;
    actionsTaken: string;
    flaggedTransactions: string;
    noFlaggedTransactions: string;
    openQuestions: string;
    noTranscript: string;
    rawJson: string;
  };
};

export const dictionaries: Record<Locale, Dictionary> = {
  es: {
    localeName: "Español",
    languageLabel: "Idioma",
    eyebrow: "Soporte con IA",
    title: "Emergencias con tu tarjeta",
    subtitle:
      "Pérdida o robo, compras que no reconoces y bloqueo preventivo. Si hace falta, te pasamos con una persona.",
    greeting:
      "Hola, soy el asistente de emergencias de tarjetas. ¿Qué pasó con tu tarjeta?",
    suggestionsLabel: "Sugerencias",
    suggestions: [
      "Me robaron la billetera y veo una compra que no hice",
      "Perdí mi tarjeta",
      "¿Cuál es el estado de mi tarjeta?",
    ],
    inputLabel: "Tu mensaje",
    inputPlaceholder: "Escribe tu mensaje…",
    inputHint: "Enter para enviar · Shift + Enter para nueva línea",
    send: "Enviar",
    sending: "Enviando…",
    youLabel: "Tú",
    assistantLabel: "Asistente",
    typing: "El asistente está escribiendo…",
    sendError: "No pudimos enviar tu mensaje. Inténtalo de nuevo.",
    cardNumberWarning:
      "Parece que escribiste un número de tarjeta completo. Por tu seguridad no lo enviamos: usa solo los últimos 4 dígitos.",
    disclaimer:
      "Prototipo con datos simulados. Nunca compartas el número completo de tu tarjeta, tu PIN ni tu CVV.",
    newConversation: "Nueva conversación",
    yes: "Sí",
    no: "No",
    verification: {
      title: "Verificación de identidad",
      answerLabel: "Tu respuesta",
      submit: "Verificar",
      answered: "Respuesta enviada",
      note: "Verificación simulada para el prototipo; no reemplaza una autenticación real.",
    },
    transactions: {
      title: (lastFour) => `Movimientos recientes · •••• ${lastFour}`,
      date: "Fecha",
      merchant: "Comercio",
      city: "Ciudad",
      amount: "Monto",
      notRecorded: "Sin registro",
    },
    confirmBlock: {
      title: "Confirmar bloqueo",
      body: (lastFour) =>
        `Vas a bloquear la tarjeta •••• ${lastFour}. No podrás usarla hasta que el banco emita una nueva.`,
      confirm: "Sí, bloquear",
      cancel: "No bloquear",
      confirmed: "Confirmaste el bloqueo",
      cancelled: "Decidiste no bloquear",
    },
    blockResult: {
      verified: (lastFour) => `Tarjeta •••• ${lastFour} bloqueada`,
      verifiedNote: "Comprobado en el sistema del banco después del bloqueo.",
      unverified: (lastFour) => `No pudimos confirmar el bloqueo de la tarjeta •••• ${lastFour}`,
      unverifiedNote: "Un agente humano lo revisará de inmediato.",
    },
    handoff: {
      title: "Caso enviado a un agente humano",
      caseLabel: "Número de caso",
      identityVerified: "Identidad verificada",
      cardBlocked: "Tarjeta bloqueada",
      actionsTaken: "Acciones realizadas",
      nextStep: "Un agente te contactará por tus canales registrados.",
      actions: {
        identity_verified: "Identidad verificada",
        identity_verification_failed: "Verificación de identidad fallida",
        transactions_reviewed: "Movimientos revisados",
        card_blocked: "Tarjeta bloqueada",
        card_status_verified: "Bloqueo comprobado en el sistema",
        block_declined_by_customer: "Bloqueo rechazado por el cliente",
        block_attempt_failed: "Intento de bloqueo fallido",
        unblock_requested: "Pidió reactivar la tarjeta",
        human_requested: "Pidió un agente humano",
      },
    },
    nav: {
      brand: "Card Emergency Support",
      customer: "Cliente",
      agent: "Agente humano",
    },
    agentDesk: {
      title: "Casos escalados",
      subtitle:
        "Traspasos del asistente a agentes humanos: hechos verificados y preguntas abiertas, sin transcripciones.",
      demoNote:
        "Casos creados en el chat durante la demo. Viven en la memoria del servidor y se borran al reiniciarlo.",
      dataSource: {
        label: "Datos",
        postgres: "PostgreSQL (Neon)",
        snapshot: "Snapshot verificado (respaldo)",
        exported: "export completo de Snowflake del",
        sample: "muestra del export de Snowflake del",
        loaded: "carga n.º",
        customers: "clientes",
        cards: "tarjetas",
        transactions: "transacciones",
      },
      loading: "Cargando casos…",
      empty: "No hay casos escalados.",
      loadError: "No pudimos cargar los casos. Inténtalo de nuevo.",
      columns: {
        caseId: "Caso",
        priority: "Prioridad",
        reason: "Motivo",
        identity: "Identidad",
        card: "Tarjeta",
        opened: "Abierto",
        status: "Estado",
      },
      priority: { urgent: "Urgente", high: "Alta", normal: "Normal" },
      status: { open: "Abierto", in_progress: "En curso", resolved: "Resuelto" },
      intents: {
        stolen_card: "Tarjeta robada",
        lost_card: "Tarjeta perdida",
        suspicious_transaction: "Movimiento sospechoso",
        block_card: "Bloqueo de tarjeta",
        unblock_card: "Reactivar tarjeta",
        human_request: "Pidió un humano",
        recent_transactions: "Movimientos",
        card_status: "Estado de tarjeta",
      },
      verified: "Verificada",
      notVerified: "No verificada",
      blocked: "Bloqueada",
      notBlocked: "Sin bloquear",
      noCard: "Sin identificar",
      minutesAgo: (minutes) => (minutes < 1 ? "Ahora" : `Hace ${minutes} min`),
      hoursAgo: (hours) => `Hace ${hours} h`,
      back: "← Volver a la cola",
      notFound: (caseId) => `No encontramos el caso ${caseId}.`,
      facts: "Hechos verificados",
      customerLanguage: "Idioma del cliente",
      riskReason: "Motivo del riesgo",
      actionsTaken: "Acciones realizadas",
      flaggedTransactions: "Movimientos señalados",
      noFlaggedTransactions: "El cliente todavía no señaló movimientos concretos.",
      openQuestions: "Preguntas abiertas",
      noTranscript:
        "El caso no incluye la transcripción de la conversación: el agente trabaja con hechos verificados.",
      rawJson: "Ver el traspaso en JSON",
    },
  },
  pt: {
    localeName: "Português",
    languageLabel: "Idioma",
    eyebrow: "Suporte com IA",
    title: "Emergências com seu cartão",
    subtitle:
      "Perda ou roubo, compras que você não reconhece e bloqueio preventivo. Se necessário, transferimos você para uma pessoa.",
    greeting:
      "Olá, sou o assistente de emergências de cartões. O que aconteceu com o seu cartão?",
    suggestionsLabel: "Sugestões",
    suggestions: [
      "Roubaram minha carteira e vejo uma compra que não fiz",
      "Perdi meu cartão",
      "Qual é o status do meu cartão?",
    ],
    inputLabel: "Sua mensagem",
    inputPlaceholder: "Digite sua mensagem…",
    inputHint: "Enter para enviar · Shift + Enter para nova linha",
    send: "Enviar",
    sending: "Enviando…",
    youLabel: "Você",
    assistantLabel: "Assistente",
    typing: "O assistente está digitando…",
    sendError: "Não conseguimos enviar sua mensagem. Tente novamente.",
    cardNumberWarning:
      "Parece que você digitou um número de cartão completo. Para sua segurança, ele não foi enviado: use apenas os últimos 4 dígitos.",
    disclaimer:
      "Protótipo com dados simulados. Nunca compartilhe o número completo do seu cartão, seu PIN ou seu CVV.",
    newConversation: "Nova conversa",
    yes: "Sim",
    no: "Não",
    verification: {
      title: "Verificação de identidade",
      answerLabel: "Sua resposta",
      submit: "Verificar",
      answered: "Resposta enviada",
      note: "Verificação simulada para o protótipo; não substitui uma autenticação real.",
    },
    transactions: {
      title: (lastFour) => `Movimentações recentes · •••• ${lastFour}`,
      date: "Data",
      merchant: "Estabelecimento",
      city: "Cidade",
      amount: "Valor",
      notRecorded: "Sem registro",
    },
    confirmBlock: {
      title: "Confirmar bloqueio",
      body: (lastFour) =>
        `Você vai bloquear o cartão •••• ${lastFour}. Não poderá usá-lo até que o banco emita um novo.`,
      confirm: "Sim, bloquear",
      cancel: "Não bloquear",
      confirmed: "Você confirmou o bloqueio",
      cancelled: "Você decidiu não bloquear",
    },
    blockResult: {
      verified: (lastFour) => `Cartão •••• ${lastFour} bloqueado`,
      verifiedNote: "Confirmado no sistema do banco após o bloqueio.",
      unverified: (lastFour) => `Não conseguimos confirmar o bloqueio do cartão •••• ${lastFour}`,
      unverifiedNote: "Um atendente humano vai revisar imediatamente.",
    },
    handoff: {
      title: "Caso encaminhado a um atendente humano",
      caseLabel: "Número do caso",
      identityVerified: "Identidade verificada",
      cardBlocked: "Cartão bloqueado",
      actionsTaken: "Ações realizadas",
      nextStep: "Um atendente entrará em contato pelos seus canais cadastrados.",
      actions: {
        identity_verified: "Identidade verificada",
        identity_verification_failed: "Falha na verificação de identidade",
        transactions_reviewed: "Movimentações revisadas",
        card_blocked: "Cartão bloqueado",
        card_status_verified: "Bloqueio confirmado no sistema",
        block_declined_by_customer: "Bloqueio recusado pelo cliente",
        block_attempt_failed: "Tentativa de bloqueio falhou",
        unblock_requested: "Pediu para reativar o cartão",
        human_requested: "Pediu um atendente humano",
      },
    },
    nav: {
      brand: "Card Emergency Support",
      customer: "Cliente",
      agent: "Atendente humano",
    },
    agentDesk: {
      title: "Casos escalados",
      subtitle:
        "Encaminhamentos do assistente para atendentes humanos: fatos verificados e perguntas em aberto, sem transcrições.",
      demoNote:
        "Casos criados no chat durante a demo. Ficam na memória do servidor e são apagados ao reiniciá-lo.",
      dataSource: {
        label: "Dados",
        postgres: "PostgreSQL (Neon)",
        snapshot: "Snapshot verificado (contingência)",
        exported: "exportação completa do Snowflake de",
        sample: "amostra da exportação do Snowflake de",
        loaded: "carga n.º",
        customers: "clientes",
        cards: "cartões",
        transactions: "transações",
      },
      loading: "Carregando casos…",
      empty: "Não há casos escalados.",
      loadError: "Não conseguimos carregar os casos. Tente novamente.",
      columns: {
        caseId: "Caso",
        priority: "Prioridade",
        reason: "Motivo",
        identity: "Identidade",
        card: "Cartão",
        opened: "Aberto",
        status: "Status",
      },
      priority: { urgent: "Urgente", high: "Alta", normal: "Normal" },
      status: { open: "Aberto", in_progress: "Em andamento", resolved: "Resolvido" },
      intents: {
        stolen_card: "Cartão roubado",
        lost_card: "Cartão perdido",
        suspicious_transaction: "Movimentação suspeita",
        block_card: "Bloqueio de cartão",
        unblock_card: "Reativar cartão",
        human_request: "Pediu um humano",
        recent_transactions: "Movimentações",
        card_status: "Status do cartão",
      },
      verified: "Verificada",
      notVerified: "Não verificada",
      blocked: "Bloqueado",
      notBlocked: "Sem bloqueio",
      noCard: "Não identificado",
      minutesAgo: (minutes) => (minutes < 1 ? "Agora" : `Há ${minutes} min`),
      hoursAgo: (hours) => `Há ${hours} h`,
      back: "← Voltar para a fila",
      notFound: (caseId) => `Não encontramos o caso ${caseId}.`,
      facts: "Fatos verificados",
      customerLanguage: "Idioma do cliente",
      riskReason: "Motivo do risco",
      actionsTaken: "Ações realizadas",
      flaggedTransactions: "Movimentações sinalizadas",
      noFlaggedTransactions: "O cliente ainda não sinalizou movimentações específicas.",
      openQuestions: "Perguntas em aberto",
      noTranscript:
        "O caso não inclui a transcrição da conversa: o atendente trabalha com fatos verificados.",
      rawJson: "Ver o encaminhamento em JSON",
    },
  },
};

/** BCP 47 tags used for the page language and number/date formatting. */
export const LOCALE_TAGS: Record<Locale, string> = {
  es: "es-MX",
  pt: "pt-BR",
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

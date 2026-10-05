// Every customer-facing sentence, in Spanish and Portuguese. Replies are
// templates filled with verified tool results: no free text is generated, so
// the agent cannot state a fact the tools did not return.

import type { Locale } from "../i18n";

type CardRef = { type: "credit" | "debit"; last_four: string };

const typeName = {
  es: { credit: "de crédito", debit: "débito" },
  pt: { credit: "de crédito", debit: "de débito" },
};

const statusName = {
  es: { active: "activa", blocked: "bloqueada", suspended: "suspendida" },
  pt: { active: "ativo", blocked: "bloqueado", suspended: "suspenso" },
};

export function cardLabel(locale: Locale, card: CardRef): string {
  return locale === "es"
    ? `tarjeta ${typeName.es[card.type]} •••• ${card.last_four}`
    : `cartão ${typeName.pt[card.type]} •••• ${card.last_four}`;
}

export const securityQuestion: Record<Locale, string> = {
  es: "¿En qué ciudad abriste tu cuenta con el banco?",
  pt: "Em qual cidade você abriu sua conta no banco?",
};

export const M = {
  es: {
    greeting:
      "Hola. Puedo ayudarte si perdiste tu tarjeta o te la robaron, si ves una compra que no reconoces, para bloquear una tarjeta o para consultar su estado. ¿Qué pasó?",
    clarify:
      "No estoy seguro de haber entendido. ¿Perdiste la tarjeta, ves un cargo que no reconoces, quieres bloquearla o consultar su estado?",
    outOfScope:
      "Eso está fuera de lo que puedo hacer aquí: solo atiendo temas de tarjetas (pérdida o robo, cargos no reconocidos, bloqueo y estado). Para otros productos usa los canales del banco.",
    injection:
      "No puedo hacer eso. Solo trabajo con las tarjetas de la persona que inició sesión y siempre sigo los pasos de seguridad.",
    cardNumber:
      "Por seguridad no escribas el número completo de la tarjeta. Basta con los últimos 4 dígitos.",
    chooseCard: (cards: string) => `¿Sobre cuál tarjeta? Tienes ${cards}. Dime los últimos 4 dígitos o si es la de crédito o la débito.`,
    notOwned: (lastFour: string) => `No encuentro una tarjeta terminada en ${lastFour} en tu perfil. Solo puedo ver las tarjetas a tu nombre.`,
    noCards: "No encuentro tarjetas activas a tu nombre. Te paso con un agente humano.",
    status: (card: string, status: string, exp: string) => `Tu ${card} está ${status}. Vence en ${exp}.`,
    statusBlockedHint: " Si quieres reactivarla, eso lo hace un agente humano tras verificar tu identidad.",
    askVerification: (card: string) => `Antes de revisar tu ${card} necesito confirmar que eres tú. Responde la pregunta de seguridad.`,
    verificationPending: "Primero responde la pregunta de seguridad de arriba.",
    verificationRetry: "Esa respuesta no coincide. Tienes un intento más.",
    verificationFailed:
      "No pude verificar tu identidad, así que no voy a hacer cambios en tu tarjeta. Pasé tu caso a un agente humano con prioridad; te contactará por tus canales registrados.",
    review: (card: string, flagged: number) =>
      flagged > 0
        ? `Identidad verificada. Estos son los últimos movimientos de tu ${card}; marqué ${flagged} como sospechoso por su puntaje de riesgo. ¿Reconoces todas estas compras?`
        : `Identidad verificada. Estos son los últimos movimientos de tu ${card}. ¿Reconoces todas estas compras?`,
    reviewOnly: (card: string) => `Identidad verificada. Estos son los últimos movimientos de tu ${card}.`,
    reviewPending: "¿Reconoces todas las compras de la lista? Responde sí o no.",
    allRecognized:
      "Perfecto, si reconoces todas las compras no hace falta bloquear la tarjeta. Si ves algo raro más adelante, escríbeme.",
    proposeBlock: (card: string) =>
      `Te recomiendo bloquear ahora tu ${card} para evitar nuevos cargos. El bloqueo es inmediato y no se puede deshacer desde este chat. ¿Confirmas?`,
    confirmationPending: "Usa los botones de arriba para confirmar o cancelar el bloqueo.",
    alreadyBlocked: (card: string) => `Tu ${card} ya está bloqueada, así que no puede recibir nuevos cargos.`,
    blockedResolved: (card: string) =>
      `Listo: bloqueé tu ${card} y comprobé en el sistema que quedó bloqueada. Para una reposición, un agente puede ayudarte por los canales del banco.`,
    blockedHandoff: (card: string) =>
      `Listo: bloqueé tu ${card} y comprobé en el sistema que quedó bloqueada. Como hay una compra que no reconoces, abrí un caso con un agente humano para revisar el cargo.`,
    blockFailed: (card: string) =>
      `No pude completar el bloqueo de tu ${card}: el sistema no respondió tras varios intentos, así que tu tarjeta NO está confirmada como bloqueada. Pasé tu caso con prioridad urgente a un agente humano.`,
    blockUnverified: (card: string) =>
      `Envié el bloqueo de tu ${card}, pero al revisar el sistema no aparece bloqueada, así que no puedo confirmarlo. Pasé tu caso con prioridad urgente a un agente humano.`,
    cancelled: "Entendido, no bloqueé la tarjeta. Como reportaste algo que no reconoces, pasé tu caso a un agente humano para que lo revise.",
    cancelledNoCase: "Entendido, no bloqueé la tarjeta. Si cambias de opinión, escríbeme.",
    unblock:
      "Reactivar una tarjeta bloqueada no lo hago de forma automática: puede haber fraude de por medio. Pasé tu solicitud a un agente humano, que verificará tu identidad y decidirá.",
    human: "Claro. Pasé tu caso a un agente humano con lo que hablamos hasta ahora; te contactará pronto.",
    closed: (caseId: string) => `Tu caso ${caseId} ya está con un agente humano. Si quieres algo más, inicia una conversación nueva.`,
    expired: "Esa solicitud ya no está vigente. Cuéntame de nuevo qué necesitas.",
    sessionExpired: "Tu sesión expiró por seguridad. Vuelve a iniciar sesión para continuar; no hice ningún cambio.",
    unauthorized: "No tienes permiso para esa conversación. No hice ningún cambio.",
    toolDown: "Tengo un problema técnico para consultar tu información. Pasé tu caso a un agente humano; no hice ningún cambio.",
  },
  pt: {
    greeting:
      "Olá. Posso ajudar se você perdeu o cartão ou ele foi roubado, se vê uma compra que não reconhece, para bloquear um cartão ou consultar o status. O que aconteceu?",
    clarify:
      "Não tenho certeza se entendi. Você perdeu o cartão, vê uma cobrança que não reconhece, quer bloqueá-lo ou consultar o status?",
    outOfScope:
      "Isso está fora do que posso fazer aqui: só atendo assuntos de cartões (perda ou roubo, cobranças não reconhecidas, bloqueio e status). Para outros produtos, use os canais do banco.",
    injection:
      "Não posso fazer isso. Só trabalho com os cartões da pessoa que fez login e sempre sigo as etapas de segurança.",
    cardNumber: "Por segurança, não escreva o número completo do cartão. Bastam os últimos 4 dígitos.",
    chooseCard: (cards: string) => `Sobre qual cartão? Você tem ${cards}. Me diga os últimos 4 dígitos ou se é o de crédito ou o de débito.`,
    notOwned: (lastFour: string) => `Não encontro um cartão com final ${lastFour} no seu perfil. Só posso ver os cartões em seu nome.`,
    noCards: "Não encontro cartões ativos em seu nome. Vou passar para um atendente humano.",
    status: (card: string, status: string, exp: string) => `Seu ${card} está ${status}. Vence em ${exp}.`,
    statusBlockedHint: " Para reativá-lo, um atendente humano faz isso depois de verificar sua identidade.",
    askVerification: (card: string) => `Antes de revisar seu ${card}, preciso confirmar que é você. Responda à pergunta de segurança.`,
    verificationPending: "Primeiro responda à pergunta de segurança acima.",
    verificationRetry: "Essa resposta não confere. Você tem mais uma tentativa.",
    verificationFailed:
      "Não consegui verificar sua identidade, então não vou fazer alterações no seu cartão. Encaminhei seu caso com prioridade para um atendente humano, que entrará em contato pelos seus canais cadastrados.",
    review: (card: string, flagged: number) =>
      flagged > 0
        ? `Identidade verificada. Estas são as últimas movimentações do seu ${card}; marquei ${flagged} como suspeita pelo score de risco. Você reconhece todas essas compras?`
        : `Identidade verificada. Estas são as últimas movimentações do seu ${card}. Você reconhece todas essas compras?`,
    reviewOnly: (card: string) => `Identidade verificada. Estas são as últimas movimentações do seu ${card}.`,
    reviewPending: "Você reconhece todas as compras da lista? Responda sim ou não.",
    allRecognized:
      "Perfeito, se você reconhece todas as compras não é preciso bloquear o cartão. Se notar algo estranho depois, me escreva.",
    proposeBlock: (card: string) =>
      `Recomendo bloquear agora seu ${card} para evitar novas cobranças. O bloqueio é imediato e não pode ser desfeito por este chat. Você confirma?`,
    confirmationPending: "Use os botões acima para confirmar ou cancelar o bloqueio.",
    alreadyBlocked: (card: string) => `Seu ${card} já está bloqueado, então não pode receber novas cobranças.`,
    blockedResolved: (card: string) =>
      `Pronto: bloqueei seu ${card} e confirmei no sistema que ele está bloqueado. Para uma segunda via, um atendente pode ajudar pelos canais do banco.`,
    blockedHandoff: (card: string) =>
      `Pronto: bloqueei seu ${card} e confirmei no sistema que ele está bloqueado. Como há uma compra que você não reconhece, abri um caso com um atendente humano para revisar a cobrança.`,
    blockFailed: (card: string) =>
      `Não consegui concluir o bloqueio do seu ${card}: o sistema não respondeu após várias tentativas, então seu cartão NÃO está confirmado como bloqueado. Encaminhei seu caso com prioridade urgente para um atendente humano.`,
    blockUnverified: (card: string) =>
      `Enviei o bloqueio do seu ${card}, mas ao conferir o sistema ele não aparece bloqueado, então não posso confirmar. Encaminhei seu caso com prioridade urgente para um atendente humano.`,
    cancelled: "Entendido, não bloqueei o cartão. Como você relatou algo que não reconhece, encaminhei seu caso para um atendente humano revisar.",
    cancelledNoCase: "Entendido, não bloqueei o cartão. Se mudar de ideia, me escreva.",
    unblock:
      "Reativar um cartão bloqueado eu não faço automaticamente: pode haver fraude envolvida. Encaminhei seu pedido para um atendente humano, que vai verificar sua identidade e decidir.",
    human: "Claro. Encaminhei seu caso para um atendente humano com o que conversamos até agora; ele entrará em contato em breve.",
    closed: (caseId: string) => `Seu caso ${caseId} já está com um atendente humano. Se precisar de algo mais, inicie uma nova conversa.`,
    expired: "Essa solicitação não está mais válida. Conte de novo do que você precisa.",
    sessionExpired: "Sua sessão expirou por segurança. Faça login de novo para continuar; não fiz nenhuma alteração.",
    unauthorized: "Você não tem permissão para essa conversa. Não fiz nenhuma alteração.",
    toolDown: "Estou com um problema técnico para consultar suas informações. Encaminhei seu caso para um atendente humano; não fiz nenhuma alteração.",
  },
};

export function statusLabel(locale: Locale, status: "active" | "blocked" | "suspended"): string {
  return statusName[locale][status];
}

export const handoffText = {
  es: {
    stolenRisk: "El cliente reporta pérdida o robo de la tarjeta.",
    chargeRisk: "El cliente reporta una compra que no reconoce.",
    flaggedRisk: (n: number) => `${n} movimiento(s) con puntaje de fraude ≥ 35.`,
    failedRisk: "La verificación de identidad falló durante un reporte de tarjeta. No se ejecutó ninguna acción.",
    blockFailedRisk: "El bloqueo falló tras reintentos acotados; la tarjeta NO está confirmada como bloqueada.",
    unblockRisk: "El cliente pide reactivar una tarjeta bloqueada; requiere verificación humana.",
    humanRisk: "El cliente pidió hablar con una persona.",
    toolRisk: "Falla técnica al consultar herramientas; no se ejecutó ninguna acción.",
    whichTransactions: "¿Cuáles movimientos no reconoce el cliente y desde cuándo?",
    verifyIdentity: "Verificar la identidad del cliente por un canal aprobado.",
    decideBlock: "Decidir si se bloquea la tarjeta una vez confirmada la identidad.",
    blockManually: "Bloquear la tarjeta manualmente y confirmar el estado con el procesador.",
    declined: "El cliente rechazó el bloqueo preventivo: confirmar si todavía tiene la tarjeta.",
    whatNeeded: "Preguntar al cliente qué necesita.",
    decideUnblock: "Decidir si se reactiva la tarjeta tras verificar identidad y revisar fraude.",
  },
  pt: {
    stolenRisk: "O cliente relata perda ou roubo do cartão.",
    chargeRisk: "O cliente relata uma compra que não reconhece.",
    flaggedRisk: (n: number) => `${n} movimentação(ões) com score de fraude ≥ 35.`,
    failedRisk: "A verificação de identidade falhou durante um relato de cartão. Nenhuma ação foi executada.",
    blockFailedRisk: "O bloqueio falhou após tentativas limitadas; o cartão NÃO está confirmado como bloqueado.",
    unblockRisk: "O cliente pede para reativar um cartão bloqueado; requer verificação humana.",
    humanRisk: "O cliente pediu para falar com uma pessoa.",
    toolRisk: "Falha técnica ao consultar ferramentas; nenhuma ação foi executada.",
    whichTransactions: "Quais movimentações o cliente não reconhece e desde quando?",
    verifyIdentity: "Verificar a identidade do cliente por um canal aprovado.",
    decideBlock: "Decidir se o cartão deve ser bloqueado após confirmar a identidade.",
    blockManually: "Bloquear o cartão manualmente e confirmar o status com o processador.",
    declined: "O cliente recusou o bloqueio preventivo: confirmar se ainda está com o cartão.",
    whatNeeded: "Perguntar ao cliente do que precisa.",
    decideUnblock: "Decidir se o cartão deve ser reativado após verificar a identidade e revisar fraude.",
  },
};

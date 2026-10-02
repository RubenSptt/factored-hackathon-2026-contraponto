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
  },
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

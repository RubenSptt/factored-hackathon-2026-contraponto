// Temporary transport between the chat UI and the backend.
//
// The FastAPI chat endpoint does not exist yet, and its request/response
// contract is pending team review. Until then this placeholder answers
// honestly that banking systems are not connected, which mirrors what the
// deployed agent says today. When the contract is agreed, replace this file
// with the typed API client; the UI only depends on `sendChatMessage`.

import type { Locale } from "./i18n";

export type AgentReply = {
  text: string;
};

const NOT_CONNECTED_REPLY: Record<Locale, string> = {
  es: "Todavía no estoy conectado a los sistemas del banco, así que no puedo consultar tus tarjetas ni bloquearlas. Esta es una vista previa de la interfaz.",
  pt: "Ainda não estou conectado aos sistemas do banco, então não posso consultar nem bloquear seus cartões. Esta é uma prévia da interface.",
};

const SIMULATED_LATENCY_MS = 700;

export async function sendChatMessage(
  _message: string,
  locale: Locale,
): Promise<AgentReply> {
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));
  return { text: NOT_CONNECTED_REPLY[locale] };
}

// Input guards that run before any intent is classified.

import { containsFullCardNumber } from "../card-number-guard";
import { normalize } from "./intent";

export { containsFullCardNumber };

// Instruction-override and data-exfiltration attempts. The agent has no LLM
// that could obey them, but they are detected, refused and recorded so they
// show up in the evaluation and the audit trail.
const INJECTION_PATTERNS = [
  /ignor\w* (las |todas |as |todas as |all |previous |the )?(instruc|regla|regra|rule)/,
  /\b(system|sistema) ?prompt\b/,
  /\b(eres|voce e|you are) (ahora|agora|now)\b/,
  /modo (desarrollador|desenvolvedor|admin)|developer mode|jailbreak/,
  /(otro|outro|otros|outros|todos los|todos os) clientes?/,
  /customer ?id|cliente c ?\d{4}/,
  /(sin|sem) (verificar|verificacao|verificacion|confirmacion|confirmacao)/,
];

export function looksLikeInjection(text: string): boolean {
  const norm = normalize(text);
  return INJECTION_PATTERNS.some((pattern) => pattern.test(norm));
}

/**
 * A last-four the customer typed: "la terminada en 4821", "final 7310", "*4821",
 * or the four digits alone. A bare amount like "1500" in a sentence is not a card.
 */
export function mentionedLastFour(text: string, answeringCardQuestion = false): string | null {
  const norm = normalize(text);
  const cue = norm.match(/(?:terminad\w*|termina|final|acaba\w*|ultimos? \w* ?digitos?|tarjeta|cartao)\s*(?:en|em|de|com|con)?\s*(\d{4})\b/);
  if (cue) return cue[1];
  const masked = text.match(/(?:\*|•|x|X){2,}\s?(\d{4})\b/);
  if (masked) return masked[1];
  const alone = norm.match(/^(?:la |a |el |o )?(\d{4})$/);
  if (alone) return alone[1];
  if (answeringCardQuestion) {
    const any = norm.match(/\b(\d{4})\b/);
    if (any) return any[1];
  }
  return null;
}

export function mentionedCardType(text: string): "credit" | "debit" | null {
  const norm = normalize(text);
  if (/credito/.test(norm)) return "credit";
  if (/debito/.test(norm)) return "debit";
  return null;
}

const YES = /^(si|sim|claro|correcto|correto|todas|reconozco|reconheco|son mias|sao minhas|yes|s)\b/;
const NO = /\b(no|nao|ninguna|nenhuma|not)\b/;

export function yesNo(text: string): "yes" | "no" | null {
  const norm = normalize(text);
  if (NO.test(norm)) return "no";
  if (YES.test(norm)) return "yes";
  return null;
}

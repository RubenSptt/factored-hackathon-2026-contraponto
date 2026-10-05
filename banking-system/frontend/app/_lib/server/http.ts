// Shared plumbing for the route handlers: session check, conversation
// ownership, execution record, latency, and a safe fallback on any failure.

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { ChatResponse } from "../api/contracts";
import { LOCALES } from "../i18n";
import type { Locale } from "../i18n";
import { createHandoff, getConversation } from "./engine";
import type { EngineTrace } from "./engine";
import { M, handoffText } from "./messages";
import { saveRecord } from "./store";
import type { Conversation } from "./store";
import { AGENT_COOKIE, CUSTOMER_COOKIE, verifyToken } from "./session";

type Body = { session_id?: unknown; locale?: unknown; [key: string]: unknown };

function localeOf(value: unknown): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : "es";
}

export async function customerTurn(
  endpoint: string,
  request: Request,
  handler: (conv: Conversation, body: Body, trace: EngineTrace) => Promise<ChatResponse>,
): Promise<NextResponse> {
  const started = Date.now();
  const traceId = randomUUID();
  const trace: EngineTrace = { tools: [], policy: [], outcome: "unknown" };
  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const locale = localeOf(body.locale);
  const sessionId = typeof body.session_id === "string" ? body.session_id.slice(0, 64) : "";
  const m = M[locale];

  const finish = (status: number, response: ChatResponse, conv: Conversation | null, stageBefore: string) => {
    saveRecord({
      trace_id: traceId,
      at: new Date().toISOString(),
      endpoint,
      session_id: sessionId,
      customer_id: conv?.customer_id ?? null,
      stage_before: stageBefore,
      stage_after: conv?.stage ?? "none",
      intent: trace.prediction?.intent,
      confidence: trace.prediction ? Math.round(trace.prediction.confidence * 1000) / 1000 : undefined,
      model: trace.prediction?.model,
      tools: trace.tools,
      policy: trace.policy,
      outcome: trace.outcome,
      latency_ms: Date.now() - started,
    });
    return NextResponse.json(response, { status, headers: { "x-trace-id": traceId } });
  };

  const session = verifyToken((await cookies()).get(CUSTOMER_COOKIE)?.value, "customer");
  if (!session.ok) {
    trace.policy.push(`session_${session.reason}`);
    trace.outcome = "refused_session";
    return finish(401, { reply: m.sessionExpired, ui_actions: [] }, null, "none");
  }
  if (!sessionId) return NextResponse.json({ error: "missing_session_id" }, { status: 400 });

  const conv = getConversation(sessionId, session.claims.sub, locale);
  if (conv === "forbidden") {
    trace.policy.push("conversation_owner_mismatch");
    trace.outcome = "refused_unauthorized";
    return finish(403, { reply: m.unauthorized, ui_actions: [] }, null, "none");
  }
  const stageBefore = conv.stage;
  try {
    const response = await handler(conv, body, trace);
    return finish(200, response, conv, stageBefore);
  } catch (error) {
    // Safe fallback: never claim an action, hand the case to a human.
    console.error(JSON.stringify({ type: "tool_failure", trace_id: traceId, error: String(error) }));
    trace.policy.push("safe_fallback");
    trace.outcome = "fallback_handoff";
    const t = handoffText[locale];
    const action = await createHandoff(conv, trace, { risk: [t.toolRisk], questions: [t.whatNeeded], urgent: true });
    trace.outcome = "fallback_handoff";
    return finish(200, { reply: m.toolDown, ui_actions: [action] }, conv, stageBefore);
  }
}

export async function requireAgent(): Promise<NextResponse | null> {
  const session = verifyToken((await cookies()).get(AGENT_COOKIE)?.value, "agent");
  if (session.ok) return null;
  return NextResponse.json({ error: `agent_session_${session.reason}` }, { status: session.reason === "expired" ? 401 : 403 });
}

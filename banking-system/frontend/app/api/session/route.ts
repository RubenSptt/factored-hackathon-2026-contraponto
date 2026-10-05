// Trusted test sessions for the demo (in production: Cognito).
// POST {"role":"customer","demo_customer":"C-1001"} or {"role":"agent"}.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { withRepository } from "../../_lib/server/repository";
import { AGENT_COOKIE, CUSTOMER_COOKIE, issueToken, SESSION_TTL_SECONDS, verifyToken } from "../../_lib/server/session";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

/** The demo identities a tester can sign in as. Only display data. */
export async function GET() {
  const jar = await cookies();
  const customer = verifyToken(jar.get(CUSTOMER_COOKIE)?.value, "customer");
  return NextResponse.json({
    demo_customers: (await withRepository((r) => r.demoCustomers())).map((c) => ({ id: c.customer_id, name: c.display_name, source: c.source })),
    signed_in_as: customer.ok ? customer.claims.sub : null,
    expires_at: customer.ok ? new Date(customer.claims.exp * 1000).toISOString() : null,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { role?: string; demo_customer?: string; ttl_seconds?: number };
  const jar = await cookies();
  // Test hook for the evaluation: a session that expires almost at once.
  const ttl = typeof body.ttl_seconds === "number" && body.ttl_seconds > 0 && body.ttl_seconds < SESSION_TTL_SECONDS
    ? Math.floor(body.ttl_seconds)
    : SESSION_TTL_SECONDS;
  if (body.role === "agent") {
    jar.set(AGENT_COOKIE, issueToken("agent-demo", "agent", ttl), { ...cookieOptions, maxAge: ttl });
    return NextResponse.json({ role: "agent" });
  }
  const customer = typeof body.demo_customer === "string"
    ? await withRepository((r) => r.getCustomer((body.demo_customer as string).slice(0, 64)))
    : null;
  if (!customer) return NextResponse.json({ error: "unknown_demo_customer" }, { status: 400 });
  jar.set(CUSTOMER_COOKIE, issueToken(customer.customer_id, "customer", ttl), { ...cookieOptions, maxAge: SESSION_TTL_SECONDS });
  return NextResponse.json({ role: "customer", customer_id: customer.customer_id });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(CUSTOMER_COOKIE);
  jar.delete(AGENT_COOKIE);
  return NextResponse.json({ signed_out: true });
}

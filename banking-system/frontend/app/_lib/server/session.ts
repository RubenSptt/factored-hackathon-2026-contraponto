// Trusted test sessions: signed, short-lived, httpOnly cookies.
//
// The identity comes from this token, never from a request body: no endpoint
// accepts a customer_id. In production this is Cognito (original team design).

import { createHmac, timingSafeEqual } from "node:crypto";

export type Role = "customer" | "agent";
export type SessionClaims = { sub: string; role: Role; exp: number };

export const CUSTOMER_COOKIE = "cs_customer";
export const AGENT_COOKIE = "cs_agent";
export const SESSION_TTL_SECONDS = 15 * 60;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 16) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set (16+ characters) in production");
  }
  return "local-development-secret-only";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function issueToken(sub: string, role: Role, ttlSeconds = SESSION_TTL_SECONDS): string {
  const claims: SessionClaims = { sub, role, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export type TokenCheck =
  | { ok: true; claims: SessionClaims }
  | { ok: false; reason: "missing" | "invalid" | "expired" };

export function verifyToken(token: string | undefined, role: Role): TokenCheck {
  if (!token) return { ok: false, reason: "missing" };
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return { ok: false, reason: "invalid" };
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, reason: "invalid" };
  }
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionClaims;
  if (claims.role !== role) return { ok: false, reason: "invalid" };
  if (claims.exp < Date.now() / 1000) return { ok: false, reason: "expired" };
  return { ok: true, claims };
}

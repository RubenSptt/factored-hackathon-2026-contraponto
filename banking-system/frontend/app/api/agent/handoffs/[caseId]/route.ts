import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireAgent } from "../../../../_lib/server/http";
import { store } from "../../../../_lib/server/store";

/** GET /api/agent/handoffs/{case_id}: 404 when the case does not exist. */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ caseId: string }> }) {
  const denied = await requireAgent();
  if (denied) return denied;
  const { caseId } = await ctx.params;
  const found = store().handoffs.find((item) => item.handoff.case_id === caseId);
  return found ? NextResponse.json(found) : NextResponse.json({ error: "not_found" }, { status: 404 });
}

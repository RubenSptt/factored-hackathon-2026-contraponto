import { NextResponse } from "next/server";

import { requireAgent } from "../../../_lib/server/http";
import { withRepository } from "../../../_lib/server/repository";
import { store } from "../../../_lib/server/store";

/** POST /api/demo/reset: restores the test fixture between demo or evaluation runs. Agent role only. */
export async function POST() {
  const denied = await requireAgent();
  if (denied) return denied;
  const s = store();
  await withRepository((r) => r.reset());
  s.conversations.clear();
  s.handoffs.length = 0;
  return NextResponse.json({ reset: true });
}

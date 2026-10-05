import { NextResponse } from "next/server";

import { requireAgent } from "../../../_lib/server/http";
import { store } from "../../../_lib/server/store";

/** GET /api/agent/records: the latest execution records (audit trail). Agent role only. */
export async function GET() {
  const denied = await requireAgent();
  if (denied) return denied;
  return NextResponse.json(store().records.slice(0, 200));
}

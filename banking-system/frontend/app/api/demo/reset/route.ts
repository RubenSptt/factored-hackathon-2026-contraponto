import { NextResponse } from "next/server";

import { requireAgent } from "../../../_lib/server/http";
import { cards } from "../../../_lib/server/data";
import { store } from "../../../_lib/server/store";

/** POST /api/demo/reset: restores the test fixture between demo or evaluation runs. Agent role only. */
export async function POST() {
  const denied = await requireAgent();
  if (denied) return denied;
  const s = store();
  s.cardStatus = new Map(cards().map((card) => [card.card_id, card.status]));
  s.conversations.clear();
  s.handoffs.length = 0;
  return NextResponse.json({ reset: true });
}

import { NextResponse } from "next/server";

import { requireAgent } from "../../../_lib/server/http";
import { CARDS } from "../../../_lib/server/fixture";
import { store } from "../../../_lib/server/store";

/** POST /api/demo/reset: restores the test fixture between demo or evaluation runs. Agent role only. */
export async function POST() {
  const denied = await requireAgent();
  if (denied) return denied;
  const s = store();
  s.cardStatus = new Map(CARDS.map((card) => [card.card_id, card.status]));
  s.conversations.clear();
  s.handoffs.length = 0;
  return NextResponse.json({ reset: true });
}

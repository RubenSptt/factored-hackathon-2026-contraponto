import { NextResponse } from "next/server";

import { INTENT_MODEL_VERSION } from "../../_lib/server/intent";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    intent_model: process.env.INTENT_MODEL === "keywords" ? "keyword-rules" : INTENT_MODEL_VERSION,
  });
}

import { NextResponse } from "next/server";

import { dataStatus } from "../../_lib/server/data";
import { INTENT_MODEL_VERSION } from "../../_lib/server/intent";

export async function GET() {
  const data = dataStatus();
  return NextResponse.json({
    status: data.ok ? "ok" : "degraded",
    data: data.ok
      ? { snapshot: data.manifest.version, built_at: data.manifest.built_at, source_exported_at: data.manifest.source.exported_at, rows: data.manifest.rows, checksum: "verified" }
      : { error: data.error },
    intent_model: process.env.INTENT_MODEL === "keywords" ? "keyword-rules" : INTENT_MODEL_VERSION,
  });
}

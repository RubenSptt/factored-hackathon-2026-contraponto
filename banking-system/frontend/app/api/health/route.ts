import { NextResponse } from "next/server";

import { dataStatus } from "../../_lib/server/data";
import { INTENT_MODEL_VERSION } from "../../_lib/server/intent";
import { sourceStatus } from "../../_lib/server/repository";

export async function GET() {
  const data = dataStatus();
  const source = await sourceStatus();
  return NextResponse.json({
    status: data.ok ? "ok" : "degraded",
    // Which store answers the agent's tools: postgres (full export) or the snapshot fallback.
    data_source: source.live,
    postgres: source.postgres,
    data: data.ok
      ? { snapshot: data.manifest.version, built_at: data.manifest.built_at, source_exported_at: data.manifest.source.exported_at, rows: data.manifest.rows, checksum: "verified" }
      : { error: data.error },
    intent_model: process.env.INTENT_MODEL === "keywords" ? "keyword-rules" : INTENT_MODEL_VERSION,
  });
}

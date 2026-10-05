import { handleMessage } from "../../../_lib/server/engine";
import { customerTurn } from "../../../_lib/server/http";

export async function POST(request: Request) {
  return customerTurn("POST /api/chat/messages", request, (conv, body, trace) =>
    handleMessage(conv, String(body.message ?? "").slice(0, 1000), trace),
  );
}

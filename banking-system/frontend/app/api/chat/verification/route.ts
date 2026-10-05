import { handleVerification } from "../../../_lib/server/engine";
import { customerTurn } from "../../../_lib/server/http";

export async function POST(request: Request) {
  return customerTurn("POST /api/chat/verification", request, (conv, body, trace) =>
    handleVerification(conv, String(body.challenge_id ?? ""), String(body.answer ?? "").slice(0, 200), trace),
  );
}

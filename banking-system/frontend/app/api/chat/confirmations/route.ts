import { handleConfirmation } from "../../../_lib/server/engine";
import { customerTurn } from "../../../_lib/server/http";

export async function POST(request: Request) {
  return customerTurn("POST /api/chat/confirmations", request, (conv, body, trace) =>
    handleConfirmation(conv, String(body.confirmation_id ?? ""), body.decision === "confirm" ? "confirm" : "cancel", trace),
  );
}

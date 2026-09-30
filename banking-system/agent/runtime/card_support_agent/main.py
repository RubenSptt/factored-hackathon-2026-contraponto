import os
from typing import Any

from bedrock_agentcore import BedrockAgentCoreApp

app = BedrockAgentCoreApp()


def _extract_text(response: dict[str, Any]) -> str:
    message = response.get("output", {}).get("message", {})
    content = message.get("content", [])
    text_parts = [part["text"] for part in content if isinstance(part.get("text"), str)]
    return "".join(text_parts)


@app.entrypoint
async def handler(request: dict[str, Any]) -> dict[str, str]:
    prompt = request.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        raise ValueError("prompt must be a non-empty string")

    model_id = os.environ["BEDROCK_MODEL_ID"]
    import boto3

    bedrock_runtime = boto3.client("bedrock-runtime")
    response = bedrock_runtime.converse(
        modelId=model_id,
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        system=[
            {
                "text": (
                    "You are the first deployed smoke-test agent for a banking "
                    "Card Emergency Support system. Do not invent account, card, "
                    "balance, transaction, identity, or policy facts. Explain that "
                    "banking tools are not connected yet when asked for customer data."
                )
            }
        ],
    )
    return {"response": _extract_text(response)}


app.run()

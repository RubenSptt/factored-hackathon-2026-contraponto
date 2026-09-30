# Banking System

Production-oriented implementation of the AI-first Card Emergency Support system.

## Current Agent Direction

The AgentCore agent is implemented with Strands SDK and managed through the
official AgentCore CLI during early development. This gives us the supported
workflow for:

- `npx agentcore dev`
- `npx agentcore deploy`
- `npx agentcore invoke`
- `npx agentcore logs`
- `npx agentcore traces`

CDK remains the standard for general AWS infrastructure. The temporary
CDK-created AgentCore runtime should be removed after the AgentCore CLI Strands
runtime is validated.

## Phase 0 Status

Phase 0 establishes the local repository foundation only:

- backend Python project managed with `uv`
- Ruff and pytest configuration
- frontend Next.js project managed with `npm`
- TypeScript strict mode
- local development commands
- runtime configuration and secrets conventions

AWS infrastructure, AgentCore, Cognito, API Gateway, Lambda deployment, and
banking workflows are introduced in later phases.

## Agent Development

The Strands agent lives under `agent/` and is managed with the AgentCore CLI
installed as a local npm development dependency. Do not use a global
`npm install -g @aws/agentcore` for this repo.

Install and verify the local CLI:

```powershell
cd D:\hackathon-factored\banking-system\agent
npm install
npx agentcore --version
```

The current Strands scaffold was created with:

```powershell
npx agentcore create --project-name card-support-strands --name CardSupportAgent --language Python --framework Strands --model-provider Bedrock --memory none --build CodeZip
```

It generated:

```text
banking-system/agent/CardSupportStrands
```

Run the local development UI:

```powershell
cd D:\hackathon-factored\banking-system\agent\CardSupportStrands
npx agentcore dev
```

The UI runs at:

```text
http://localhost:8081
```

The first agent must use Bedrock as the model provider and Strands SDK as the
agent framework. Until banking tools are connected, it must not invent account,
card, balance, transaction, identity, verification, action, or policy facts.

Current status: local `npx agentcore dev` works, but the generated agent still
responds as a generic assistant. Do not run `npx agentcore deploy` until the
Strands prompt and tool configuration are updated for banking Card Emergency
Support behavior.

## Local Backend Development

From the backend directory:

```bash
cd banking-system/backend
uv sync
uv run pytest
uv run ruff check .
uv run ruff format --check .
```

## Local Frontend Development

From the frontend directory:

```bash
cd banking-system/frontend
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
```

## Phase 0 Verification

Backend:

```bash
cd banking-system/backend
uv run pytest
uv run ruff check .
uv run ruff format --check .
```

Frontend:

```bash
cd banking-system/frontend
npm run lint
npm run typecheck
npm run build
```

## Runtime Configuration

Do not store secrets in `.env` files or source control.

Production and AWS development secrets should be stored in AWS Secrets Manager.
Non-sensitive runtime configuration should be provided through CDK configuration,
safe defaults, or documented local configuration when needed.

During local development, use only non-sensitive defaults unless a later phase
documents a specific AWS-backed configuration flow.

If a service requires sensitive values, add the required secret to AWS Secrets
Manager through CDK or a documented reproducible script. Do not hardcode secrets
in application code, CDK code, tests, or local config files.

## Repository Areas

- `backend/`: FastAPI backend and banking service code.
- `frontend/`: Next.js frontend.
- `agent/`: Agent instructions and AgentCore integration assets.
- `lambdas/`: AWS Lambda tool handlers.
- `rag/`: Banking policy documents and retrieval assets.
- `infrastructure/`: AWS CDK infrastructure.
- `evaluation/`: Agent and workflow evaluation assets.

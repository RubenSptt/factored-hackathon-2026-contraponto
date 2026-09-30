# Agent

The production agent is a Strands SDK agent deployed to Amazon Bedrock
AgentCore Runtime with the official AgentCore CLI during early development.

Use the AgentCore CLI workflow here instead of adding new AgentCore Runtime
resources to the CDK app while the agent loop is being validated.

## Local CLI Setup

`@aws/agentcore` is installed as a local npm development dependency in this
directory. Do not use a global install for this repository.

Install dependencies:

```powershell
cd D:\hackathon-factored\banking-system\agent
npm install
```

Verify the local CLI:

```powershell
npx agentcore --version
```

Why `npx`: it runs the version pinned by `package-lock.json` from this
directory instead of relying on a machine-wide `npm install -g`.

## Scaffolded Strands Agent

The Strands scaffold was created with:

```powershell
cd D:\hackathon-factored\banking-system\agent
npx agentcore create --project-name card-support-strands --name CardSupportAgent --language Python --framework Strands --model-provider Bedrock --memory none --build CodeZip
```

In this workspace, the generated project is:

```text
D:\hackathon-factored\banking-system\agent\CardSupportStrands
```

If the CLI runs interactively, choose:

- code-based agent
- Python
- Strands
- Bedrock
- no memory
- CodeZip

## Run Locally

Start the local AgentCore development server from the generated project:

```powershell
cd D:\hackathon-factored\banking-system\agent\CardSupportStrands
npx agentcore dev
```

The local chat UI opens at:

```text
http://localhost:8081
```

Development logs are written under:

```text
agentcore\.cli\logs\dev\
```

Example log tail command:

```powershell
Get-Content .\agentcore\.cli\logs\dev\<log-file>.log -Tail 100
```

## Current Status

- Local `@aws/agentcore` installation works through `npx`.
- `npx agentcore dev` works in `CardSupportStrands`.
- The local UI starts on `localhost:8081`.
- The generated agent currently responds like a generic assistant.
- The next implementation step is to update the Strands agent prompt and tools
  so it behaves as a banking Card Emergency Support agent.

Do not deploy yet:

```powershell
npx agentcore deploy
```

Wait until the local behavior is correct before deploying or invoking the AWS
runtime with AgentCore CLI.

## Agent Rules

- Use Strands SDK.
- Use Amazon Bedrock as the model provider.
- Do not invent banking facts.
- Do not authorize sensitive operations in the LLM.
- Use tools for account, card, transaction, verification, action, escalation,
  and policy facts once those tools are available.
- Support Spanish and Portuguese.
- Until banking tools are connected, clearly state that real banking data and
  banking actions are not available yet.

## Temporary CDK Runtime

`runtime/card_support_agent/` is the temporary CDK runtime smoke-test asset.
Do not continue feature work there. After the AgentCore CLI Strands runtime is
validated with `npx agentcore invoke`, destroy the temporary CDK runtime stack:

```powershell
cd D:\hackathon-factored\banking-system\infrastructure
npx aws-cdk@latest destroy banking-system-dev-agent --profile bedrock-dev-user
```

Keep the CDK foundation stack unless a later phase explicitly replaces it.

# Infrastructure

AWS CDK infrastructure for the banking system.

Phase 1 starts with a minimal CDK foundation. The primary AgentCore Runtime is
now developed and deployed with the official AgentCore CLI using Strands SDK.
The existing CDK-created AgentCore Runtime is temporary and should be destroyed
after the AgentCore CLI Strands runtime is validated. CDK does not deploy
Secrets Manager, DynamoDB, API Gateway, Cognito, Lambda banking tools, or
Amplify yet.

## AWS Profile

Use PowerShell as the standard shell for project AWS commands.

Configure the development profile if it does not already exist:

```powershell
aws configure --profile bedrock-dev-user
```

Verify the profile and selected account:

```powershell
aws sts get-caller-identity --profile bedrock-dev-user
```

Set the default region for the current PowerShell session:

```powershell
$env:AWS_PROFILE = "bedrock-dev-user"
$env:CDK_DEFAULT_REGION = "us-east-1"
```

## Local Development

Install dependencies:

```powershell
cd banking-system/infrastructure
uv sync
```

Run local checks:

```powershell
uv run pytest
uv run ruff check .
uv run ruff format --check .
```

Synthesize the CDK app:

```powershell
npx aws-cdk@latest synth --profile bedrock-dev-user
```

The CDK app uses non-sensitive context from `cdk.json`. Secrets must not be
stored in CDK code, context, local files, or source control.

Do not add new AgentCore runtime changes here while the Strands agent is being
validated through AgentCore CLI.

## Deployment

Use an explicit profile for development deployment of CDK-managed
infrastructure:

```powershell
npx aws-cdk@latest deploy --profile bedrock-dev-user
```

AgentCore runtime deployment is handled by `agentcore deploy` under
`banking-system/agent` during early Strands development.

## Runtime Configuration

- Development AWS region: `us-east-1`
- Development AWS profile: `bedrock-dev-user`
- Default Bedrock model for the Strands agent: `amazon.nova-micro-v1:0`
- Sensitive values: AWS Secrets Manager, introduced in a later Phase 1 block
- Non-sensitive values: CDK context, safe defaults, or documented local config

## Temporary CDK Runtime Cleanup

After the AgentCore CLI Strands runtime is deployed and successfully invoked,
destroy the temporary CDK-created runtime stack to avoid duplicate runtimes and
confusing logs:

```powershell
npx aws-cdk@latest destroy banking-system-dev-agent --profile bedrock-dev-user
```

Keep `banking-system-dev-foundation` unless a later phase explicitly replaces
or removes the CDK foundation.

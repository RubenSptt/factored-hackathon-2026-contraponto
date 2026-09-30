# AGENTS.md

## Project

This repository implements an AI-first banking Card Emergency Support system
for the Factored AI & Data Hackathon 2026.

The system must behave as a banking service, not merely as a chatbot.

Core behavior:

Understand → Decide → Act → Verify → Escalate

The primary workflow is emergency card support, including:

- card information and balance inquiries
- banking policy questions through RAG
- lost or stolen card assistance
- recent transaction review
- step-up identity verification
- preventive card blocking
- verification that the blocking action succeeded
- escalation for suspected fraud or identity impersonation
- structured handoff to a human agent

The system must support Spanish and Portuguese.

---

## Architecture Principles

Prefer managed, serverless, and usage-based infrastructure when practical.

Current target architecture:

- Frontend: Next.js + TypeScript
- Hosting: AWS Amplify
- Authentication: Amazon Cognito
- Public API: Amazon API Gateway
- Backend: Python + FastAPI running on AWS Lambda
- Agent runtime: Amazon Bedrock AgentCore Runtime
- Agent framework: Strands SDK
- Models: Amazon Bedrock
- Agent tools: AgentCore Gateway + AWS Lambda
- Agent memory: AgentCore Memory
- Operational storage: Amazon DynamoDB
- Raw data: Amazon S3
- Analytics: Snowflake
- RAG: Amazon Bedrock Knowledge Bases
- Secrets: AWS Secrets Manager
- Observability: CloudWatch + AgentCore observability
- Infrastructure as Code: AWS CDK

Do not introduce additional services unless there is a concrete architectural
reason.

Optimize for:

1. security
2. correctness
3. maintainability
4. low operating cost
5. scalability
6. hackathon delivery speed

---

## Development Strategy

Use a hybrid local/AWS development model.

During early development, run locally:

- Next.js frontend
- FastAPI backend
- unit and integration tests
- EDA / DuckDB tooling

Deploy to AWS early:

- Bedrock AgentCore Runtime
- Bedrock models
- Secrets Manager
- AgentCore Gateway when needed
- Lambda tools when needed by the deployed agent
- minimal DynamoDB development data when needed
- Bedrock Knowledge Base when RAG development begins

Do not emulate AgentCore locally.

Test the real AgentCore integration early.

Delay deployment of:

- Amplify
- Cognito
- API Gateway for the application backend
- FastAPI Lambda

until the core workflows are validated from localhost.

Develop features as vertical slices instead of building every infrastructure
layer independently.

Business logic must remain independent from AWS infrastructure whenever
practical.

---

## Infrastructure as Code

AWS infrastructure MUST be defined with AWS CDK whenever reasonably
supported.

Infrastructure code lives under:

`banking-system/infrastructure/`

Use AWS CDK with Python for infrastructure code.

Exception for the early AgentCore agent runtime: use the official AgentCore CLI
to scaffold, develop, deploy, and invoke the Strands-based agent while the core
agent loop is being validated. This is a reproducible managed workflow, not a
manual console configuration. General AWS infrastructure remains CDK-managed,
and the AgentCore runtime can be migrated back to CDK after the Strands runtime
contract is proven.

The CDK app under `banking-system/infrastructure/` should use Python 3.13
and `uv` unless a specific CDK limitation requires otherwise.

Avoid manually creating resources through the AWS Console when they can
reasonably be managed through CDK.

Create infrastructure incrementally. Do not create stacks or resources for
hypothetical future requirements.

Suggested stack boundaries when needed:

- FoundationStack
- AgentStack
- DataStack
- RagStack
- ApiStack

If a required AWS capability cannot reasonably be managed through CDK,
prefer a documented reproducible script over manual configuration.

Never hardcode secrets in CDK.

Use Secrets Manager for sensitive configuration and environment variables or
CDK configuration for non-sensitive values.

---

## Critical Security Rules

Never let the LLM make authorization decisions.

LLM reasoning and authorization are separate concerns.

Sensitive operations such as card blocking MUST be validated
deterministically by the service/tool layer.

A card block requires at minimum:

- authenticated trusted session
- customer identity obtained from the trusted session
- card belongs to authenticated customer
- step-up verification passed
- card is in a blockable state
- explicit user confirmation

In production-like deployment, authentication uses Cognito.

During local development, a trusted mock identity may be used.

Never trust a customer_id supplied directly by the frontend as proof of
identity.

Never use national ID, customer number, date of birth, or similar knowledge
alone as proof of authentication.

Security questions are simulated step-up verification for the prototype,
not production-grade MFA.

If identity verification fails or suspicious behavior is detected:

- do not perform the sensitive operation
- create/escalate the case
- preserve verified facts and attempted actions

Never expose:

- full card numbers
- credentials
- secrets
- internal authorization data

Mask sensitive values in responses and logs.

---

## Agent Rules

Implement the agent with Strands SDK running on Amazon Bedrock AgentCore
Runtime.

The agent may reason about what should happen next.

The agent MUST use tools for banking facts and banking actions.

Never invent:

- balances
- transactions
- card status
- customer information
- policy information
- verification results
- action results

Policy answers must be grounded in RAG.

Banking information must come from trusted tools.

After performing an action, verify its result using the appropriate tool.

When information is ambiguous, ask for clarification.

When the system cannot safely continue, escalate.

AgentCore Memory may be used for conversational context, but MUST NOT be
treated as the source of truth for authentication, authorization, card
ownership, balances, card status, or identity verification.

---

## Tool Design

Prefer small tools with explicit contracts.

Examples:

- get_customer_cards
- get_card_details
- get_recent_transactions
- get_balance
- verify_identity
- block_card
- verify_card_status
- create_support_ticket

Read operations and write operations should remain clearly separated.

Tools must return structured JSON.

Business and authorization rules belong in services/tools, not prompts.

Sensitive tools must independently validate their preconditions.

---

## Backend Rules

Use FastAPI for the conventional application API.

Keep routes thin.

Preferred layering:

API route
    ↓
service
    ↓
repository / AWS client

Do not put business logic directly in FastAPI routes or Lambda handlers.

Use Pydantic models for request/response contracts.

Use dependency injection where useful.

Use typed Python.

---

## Data Rules

Use each data technology for its intended responsibility:

- DuckDB: local EDA
- S3: raw hackathon data
- Snowflake: data engineering, analytics, baselines and evaluation metrics
- DynamoDB: operational banking simulation

Do not use Snowflake as the transactional datastore for agent actions.

Do not copy the entire analytical dataset into DynamoDB.

Only create the operational data required by the application.

---

## Code Quality

Python:

- Python 3.13
- AWS Lambda runtime: `python3.13`
- type hints required
- Pydantic for contracts
- pytest for tests
- Ruff for linting/formatting

TypeScript:

- strict mode
- avoid `any`
- define API contracts explicitly

Prefer simple implementations over unnecessary abstractions.

Do not create placeholder abstractions for hypothetical future requirements.

---

## Testing

Critical banking actions require unit tests.

At minimum test:

- successful card blocking
- card does not belong to authenticated customer
- failed identity verification
- already blocked card
- missing explicit confirmation
- unauthorized request
- tool failure
- action verification failure
- escalation creation

Agent evaluation must include:

- normal requests
- ambiguous requests
- unsupported requests
- prompt injection attempts
- incorrect/missing data
- tool failures
- Spanish
- Portuguese
- cases requiring human intervention

Never optimize evaluation using held-out test cases.

---

## Development Behavior

Before implementing a feature:

1. inspect existing code
2. read the relevant documentation
3. identify the correct module/layer
4. propose the smallest coherent change
5. implement it
6. add/update tests
7. run relevant checks

Do not rewrite unrelated files.

Do not silently change architecture.

Do not silently introduce new infrastructure.

If a requested change conflicts with `ARCHITECTURE.md`, explain the conflict
before implementing it.

---

## Repository Structure

This repository contains two major areas:

### EDA/

Existing exploratory data analysis workspace.

It contains:

- DuckDB database used for local analysis
- dataset validation
- exploratory analysis
- contact reason analysis
- customer journey analysis

Do not move, rewrite, or duplicate the EDA implementation unless explicitly
requested.

### banking-system/

Production-oriented implementation of the AI-first Card Emergency Support
system.

Application code should be implemented here.

Expected structure:

banking-system/
├── frontend/
├── backend/
├── agent/
├── lambdas/
├── rag/
├── infrastructure/
└── evaluation/

---

## Documentation

Use these documents for detailed context:

- `PRODUCT.md`: product scope and expected behavior
- `docs/ARCHITECTURE.md`: architecture and component responsibilities
- `docs/TASKS.md`: implementation plan and current phases

Do not duplicate detailed architecture or implementation plans in
`AGENTS.md`.

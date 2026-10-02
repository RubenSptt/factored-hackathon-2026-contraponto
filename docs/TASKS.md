# Implementation Plan

## Phase 0 — Repository Foundation

- [x] Create monorepo structure
- [x] Configure Python 3.13 environment
- [x] Configure frontend
- [x] Configure Ruff
- [x] Configure pytest
- [x] Configure TypeScript strict mode
- [x] Add environment configuration
- [x] Add local development instructions

## Phase 1 — AWS Development Foundation

- [x] Initialize AWS CDK Python project
- [x] Define `dev` environment configuration
- [x] Create initial Foundation stack
- [x] Install and verify AgentCore CLI as a local npm dev dependency under `banking-system/agent`
- [x] Scaffold Strands agent with AgentCore CLI
- [x] Configure Bedrock model for the Strands agent
- [x] Run local AgentCore development flow with `npx agentcore dev`
- [x] Deploy Strands agent runtime with `npx agentcore deploy`
- [x] Invoke deployed agent with `npx agentcore invoke`
- [x] Verify AgentCore logs and traces with CLI commands
- [x] Remove the temporary CDK-created AgentCore runtime after the CLI runtime is validated
- [ ] Create required Secrets Manager resources when concrete secrets are known
- [ ] Define initial IAM roles and least-privilege policies when required by the next vertical slice

Milestone: local development can successfully invoke the deployed Strands agent
on AgentCore Runtime using AgentCore CLI.

## Phase 2 — Data Exploration and Preparation

- [ ] Continue existing DuckDB EDA
- [ ] Profile card-related products
- [ ] Profile transactions
- [ ] Profile complaints
- [ ] Profile call-center interactions
- [ ] Identify useful card-support scenarios
- [ ] Document relevant data quality issues
- [ ] Define Snowflake analytical/curated models
- [ ] Define operational data subset required by the application

## Phase 3 — Operational Banking Simulation

- [ ] Define Customer model
- [ ] Define Card model
- [ ] Define Transaction model
- [ ] Define SecurityFact model
- [ ] Define SupportTicket model
- [ ] Create synthetic security facts
- [ ] Create development fixtures
- [ ] Create DynamoDB operational tables when required
- [ ] Seed required operational data

## Phase 4 — First Vertical Slice: Card Information

- [ ] Implement `get_customer_cards`
- [ ] Implement `get_card_details`
- [ ] Implement `get_balance`
- [ ] Add unit tests
- [ ] Expose required tools to AgentCore
- [ ] Connect local FastAPI to AgentCore
- [ ] Create minimal local frontend integration

Milestone: a user can query trusted card information from localhost through
the deployed AgentCore agent.

## Phase 5 — Secure Card Blocking

- [ ] Implement step-up identity verification
- [ ] Implement `verify_identity`
- [ ] Implement deterministic authorization rules
- [ ] Implement `block_card`
- [ ] Implement `verify_card_status`
- [ ] Require explicit confirmation
- [ ] Add tests for failed verification and unauthorized actions
- [ ] Connect action tools to AgentCore
- [ ] Verify action results before confirming success

Milestone: card blocking works end-to-end with deterministic security controls.

## Phase 6 — Suspicious Transactions and Human Escalation

- [ ] Implement `get_recent_transactions`
- [ ] Implement suspicious-transaction workflow
- [ ] Implement `create_support_ticket`
- [ ] Define structured human handoff
- [ ] Implement urgent escalation behavior
- [ ] Create ticket queue/detail experience

## Phase 7 — RAG

- [ ] Create banking policy documents
- [ ] Create required S3 storage
- [ ] Create Bedrock Knowledge Base
- [ ] Ingest policies
- [ ] Connect retrieval to AgentCore
- [ ] Return policy sources when applicable
- [ ] Evaluate retrieval quality

## Phase 8 — Frontend Experience

- [ ] Banking dashboard
- [ ] Card list
- [ ] Card details
- [ ] AI assistant
- [ ] Confirmation UI for sensitive actions
- [ ] Human escalation status
- [ ] Human agent ticket view

Frontend remains local during this phase.

## Phase 9 — Evaluation and Security Testing

- [ ] Define baseline
- [ ] Create evaluation dataset
- [ ] Separate development and held-out cases
- [ ] Spanish scenarios
- [ ] Portuguese scenarios
- [ ] Ambiguous and unsupported requests
- [ ] Authentication/verification failures
- [ ] Prompt injection attempts
- [ ] Tool failures
- [ ] Missing/incorrect data
- [ ] Human escalation cases

Measure:

- safe automated resolution rate
- unsafe outcome rate
- escalation quality
- p50 / p95 latency
- cost per attempted resolution
- cost per successful resolution

## Phase 10 — Production-like Deployment

- [ ] Configure Cognito
- [ ] Implement JWT validation
- [ ] Derive customer identity from trusted session
- [ ] Deploy FastAPI to Lambda
- [ ] Configure API Gateway
- [ ] Deploy frontend with Amplify
- [ ] Replace development identity with Cognito
- [ ] Review IAM least privilege
- [ ] Validate end-to-end deployed workflow

All AWS resources should be managed through CDK when reasonably supported.

## Phase 11 — Demo and Hardening

- [ ] Happy path
- [ ] Lost/stolen card
- [ ] Suspicious transaction
- [ ] Failed identity verification
- [ ] Human escalation
- [ ] Portuguese interaction
- [ ] RAG policy question
- [ ] Observability/tracing
- [ ] Evaluation results
- [ ] Architecture and cost review

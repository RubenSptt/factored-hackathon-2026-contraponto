# Workflow selection: why Card Support

**Decision (2026-09-28):** the team builds the agent for **Card Support**, and
focuses its business case on **unrecognized charges**. The choice came from
exploring the dataset first, not from picking a workflow up front. Every figure
below links to the SQL that produced it; the queries live in
[`data-engineering/analysis/`](../data-engineering/analysis/) and were
cross-checked against the Snowflake Query History, where each carries its
execution time and `query_id`.

## Method

The kickoff offered four workflows: Account/Payment Inquiries, Card Support,
Transaction Disputes, and Credit-Product Info & Eligibility. Each was scored on
two independent axes:

| Axis | What it measures | Why it matters |
| --- | --- | --- |
| Data backing | Useful records, coverage, cleanliness | Whether the agent can answer from verified records |
| Conversational complexity | Duration, follow-up, resolution at first contact | Long interactions accumulate users, add latency and create bottlenecks at peak demand |

**Thesis:** the workflow with the most records is not automatically the best
choice. A workflow that needs long, multi-step conversations optimizes data
volume at the expense of throughput. A flow where the customer asks, gets a
verified answer or action, and leaves scales better from 10 to 2,000 users.

## Evidence

### Complexity by contact category (Q02, Q06)

`call_center_interactions`, 686K rows loaded. The category is the only variable
that moves these rates: channel, wait time and sentiment do not.

| Category | Interactions | Mean duration (s) | Escalated | Needs follow-up | Resolved at first contact |
| --- | --- | --- | --- | --- | --- |
| Transactional | 240,056 | 220.8 | 9.9% | 22.1% | 91.5% |
| Product | 150,863 | 266.4 | 10.0% | 23.8% | ~90% |
| Complaint | 117,021 | 434.6 | 10.0% | 63.0% | 43.6% |
| Technical | 102,899 | 360.5 | 10.1% | 40.6% | ~70% |
| Commercial | 54,879 | 539.9 | 9.8% | 44.5% | |
| Retention | 20,578 | 479.2 | 9.9% | 49.1% | |

High volume and low complexity go together in Transactional and Product.
Complaint leaves 63% of cases open, a bottleneck risk for any workflow built on
it. Escalation is ~10% everywhere: it is a random label, not a signal.

### Satisfaction follows resolution (Q09)

212,759 surveys joined to their interactions.

| Category | CSAT | NPS |
| --- | --- | --- |
| Transactional | 2.91 | 5.74 |
| Product | 2.90 | 5.69 |
| Technical | 2.70 | 5.14 |
| Complaint | 2.43 | 4.33 |

### What the labels and text can and cannot support (Q04–Q07)

- **Text is template text.** Every transcript says one of two balance phrases,
  whatever the call category. The dataset's conversations cannot train or
  evaluate the agent ([Gap 2](data_gaps.md)).
- **No column separates the four workflows** ([Gap 3](data_gaps.md)). The
  category → workflow mapping is an explicit team assumption.
- **`is_fraud` is a cutoff on `fraud_score`:** 0.03% fraud below 30, 100% from
  40, flat across channel, type, status, country and amount. A model using the
  score would only learn the cutoff (label leakage). The score is useful as a
  deterministic tool, not as a training target ([Gap 7](data_gaps.md)).
- **Consequence:** there is no supervised model to train on the dataset's
  labels. The architecture is a pre-trained LLM, deterministic tools over the
  structured tables, and explicit escalation rules.

### What each workflow can answer from structured data

| Workflow | Answerable with real records | Missing | Backing |
| --- | --- | --- | --- |
| Account/Payment Inquiries | Balance, credit limit, days past due, transactions, declined or pending transactions | Nothing critical | Strong |
| Card Support | Card type, status (blocked, suspended), expiration, linked app | Real actions (block, replace) must be simulated | Medium-strong |
| Transaction Disputes | Fraud score and label, reversals, claimed amount, SLA, compensation | `complaints` has no `transaction_id` | Medium, high complexity |
| Credit-Product Info & Eligibility | Customer profile, existing product rates | No product catalog or eligibility rules; fairness risk (gender, marital status) | Weak |

### Finalists

| Criterion | Account/Payment Inquiries | Card Support |
| --- | --- | --- |
| Proxy category (assumption) | Transactional | Technical + part of Product |
| Resolved at first contact | 91.5% | ~70% (Technical) to ~90% (Product) |
| CSAT | 2.91 | 2.70 to 2.90 |
| Data backing | 4.43M transactions, balances, limits, arrears | 140,040 cards; 9,904 blocked or suspended (Q08) |
| Act → Verify (kickoff) | Almost read-only | Block, activate or replace, then verify the change in `product_status` |
| When not to act, human handoff | Few natural cases | Confirm before blocking; suspected fraud → human |

Account/Payment wins on complexity and data backing. **Card Support wins on what
the kickoff asks of the system:** understand, decide, act, verify and escalate.
A read-only workflow cannot show safe actions, verification or a reasoned
handoff. The team chose Card Support.

## Business problem: unrecognized charges

"Cargo no reconocido" is the clearest pain in the data (Q03): **12,297
complaints, 15.4 days mean resolution, 20.4% SLA breach**; 7,620 of them come
from customers who hold a card.

The stage 1 profile made the case stronger: **no complaint in the dataset is
linked to the right card.** All 44,570 complaints that name a product name
another customer's product, and the other 22,525 name none (Q10,
[`profile_core.md`](../data-engineering/docs/profile_core.md),
[Gap 10](data_gaps.md)).

What the agent changes, and what it does not:

- It **contains the risk in the first conversation:** it identifies the card,
  verifies identity, asks for explicit confirmation, blocks, and re-reads the
  card status to confirm the block happened.
- It **hands the case to a human with verified facts**, linked to the exact card
  and transaction. Today that happens in 0% of cases.
- It does **not** promise to cut the 15.4 days: the dispute itself stays a
  human process.

| Metric | Baseline in the data |
| --- | --- |
| Cases handed off with card and transaction linked | 0% |
| Time from report to verified block | Not recorded today; measured by the prototype |
| Blocks executed without explicit confirmation | Must be 0 |

The data sizes the problem; it does not prove that unrecognized charges are
card-related (the linked product type follows the portfolio mix at random). The
problem is chosen on business logic and sized with data, and the team says so.

## Design consequences

- `fraud_score` is a deterministic tool; `is_fraud` is never a model target.
- Human escalation is a set of explicit rules, not a learned label.
- `affected_product_id` is never exported to the agent.
- Least data: no identity document, birth date, contact data, income, credit
  score or full card number leaves Snowflake. Cards are identified by their
  last four digits.
- Missing is not zero: gaps travel in `dq_flags` and the agent says "not
  recorded".

## Reproduce

1. Exploration: [`data-engineering/analysis/`](../data-engineering/analysis/),
   run order in its README.
2. Cleaning and the agent subset:
   [`data-engineering/pipelines/snowflake/`](../data-engineering/pipelines/snowflake/).
3. Gaps that limit these conclusions: [`data_gaps.md`](data_gaps.md).

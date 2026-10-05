# Project report: how Contraponto was decided and built

**In one paragraph:** the team explored the dataset before choosing anything.
The data engineer's thesis was that the workflow with the most records is not
automatically the best one: a workflow should be judged on two independent
axes, data backing and conversational complexity. That matrix produced two
finalists, and Card Support won on what the kickoff asks of a system (act,
verify, escalate). Unrecognized charges became the business problem because
they are the clearest pain in the data and because no complaint in the dataset
reaches a human linked to the right card. The data then decided the
architecture: the text and the labels carry no learnable signal, so the agent
is a learned intent classifier plus deterministic rules and tools that read a
verified snapshot of the cleaned data, measured on held-out conversations.

Each section links to the evidence; nothing here is a new claim.

## 1. Thesis and decision matrix

Every candidate workflow was scored on two axes
([`workflow_selection.md`](workflow_selection.md)):

| Axis | Question it answers | Measured with |
| --- | --- | --- |
| Data backing | Can the agent answer from verified records? | Useful records, coverage and cleanliness per workflow (Q01, Q05, Q08) |
| Conversational complexity | Will conversations stay short and resolvable? | Duration, follow-up and first-contact resolution by category (Q02, Q06, Q09) |

The thesis: a workflow that needs long, multi-step conversations buys data
volume at the cost of throughput. A flow where the customer asks, gets a
verified answer or action and leaves scales better from 10 to 2,000 users.

Result: Account/Payment Inquiries won on both axes, but it is almost
read-only. Card Support won on what the kickoff asks: understand, decide, act,
verify and escalate. Only a workflow with real actions (block a card, verify
the change, hand off a dispute) can show controlled automation.

## 2. Which data, and why

The data engineer's criterion: **load only what a tool needs, and never let a
field the data cannot support reach the agent.**

| Table | Role | Why |
| --- | --- | --- |
| `products`, `transactions`, `customers` | Core: the agent's records | Cards, their status, recent movements and `fraud_score` are what the tools read and change |
| `complaints` | Core: the business problem | Sizes unrecognized charges: 12,297 complaints, 15.4 days, 20.4% SLA breach (Q03) |
| `daily_exchange_rates` | Reference | USD amounts; the source actually uses a fixed rate per currency (Gap 8) |
| `call_center_interactions`, `satisfaction_surveys` | Context: analysis only | Demand by category, handling time and CSAT for the decision and the business case (Q02, Q09, Q12) |
| `call_transcripts` | Not used | Two template phrases across 171,321 rows, unrelated to the call category (Gap 2) |
| `digital_events`, `campaign_sends`, `marketing_campaigns`, `service_agents` | Not used | Outside Card Support |

Decisions that follow from the profile
([`profile_core.md`](../data-engineering/docs/profile_core.md)):

- `affected_product_id` is never exported: every complaint that names a
  product names **another customer's** (Gap 10).
- `is_fraud` is never a model target: it is a cutoff on `fraud_score` at ~35
  (Q07). The score is used as a deterministic rule instead.
- Least data: no identity document, birth date, contact data, income, credit
  score or full card number leaves Snowflake. Cards are referred to by their
  last four digits.
- Missing is not zero: nulls travel in `dq_flags` and are never imputed.

## 3. The business problem and its number

Unrecognized charges were chosen on business logic and sized with data, and
the documents say so: the linked product type is random, so the data cannot
prove the charges are card-related ([`workflow_selection.md`](workflow_selection.md)).
What the agent changes is the first conversation: it contains the risk (a
verified block) and hands the dispute to a human with the right card and
transaction, which happens in 0% of today's cases. It does not promise to cut
the 15.4 days.

Cost per resolution ([`business_case.md`](business_case.md)), a projection
with every assumption stated: USD 0.03 for the agent as built vs. USD 2.06 for
a human in the base scenario, because no model runs per conversation. With a
language model, as in the original AWS design, it would be USD 0.77, and with
all assumptions against it that design loses money unless three design levers
are applied.

## 4. Reproducible evidence

- **Queries:** [`data-engineering/analysis/`](../data-engineering/analysis/),
  Q01–Q12. Each file states the question, the tables, the result, the decision
  or gap it led to, and the Snowflake `query_id` and time of each statement,
  cross-checked against the Query History.
- **Gaps:** [`data_gaps.md`](data_gaps.md) lists 12 things the data cannot
  prove and how the prototype handles each.
- **Pipeline:** landing, profile, typed clean tables, quarantine (0 rows),
  the agent subset and a Parquet export with a manifest (row counts, columns,
  SHA-256 checksums, `query_id`); Pydantic contracts validate every exported
  row ([`data-engineering/`](../data-engineering/)).
- **From the export to the agent:** [`build_snapshot.py`](../data-engineering/pipelines/snapshot/build_snapshot.py)
  checks every Parquet file against the manifest's SHA-256, validates the rows
  it keeps against the contracts, draws a stratified sample with a fixed seed
  (123 customers with a transaction at `fraud_score ≥ 35`, 60 with a blocked or
  suspended card, 80 with several cards, 110 others; closed cards and names
  left out), merges the labeled test fixture and writes the snapshot with its
  own manifest: source checksums, Snowflake `query_id`s, row counts, strata and
  a diff against the previous snapshot. The server re-checks that checksum on
  start and refuses a snapshot that changed outside the pipeline.
- **The operational store:** [`load_postgres.py`](../data-engineering/pipelines/postgres/load_postgres.py)
  loads the whole export (91,084 customers, 140,040 cards, 258,561
  transactions) into PostgreSQL on Neon, the store the original team planned.
  Gates before any write: checksums and row counts against the manifest, every
  row against the contracts, unique keys and no orphan cards or transactions.
  The source tables are replaced in one transaction from staging tables, so a
  reader sees the old load or the new one, never a mix; `load_runs` records the
  lineage (checksums, `query_id`s, row counts, export time). What the agent does
  is appended to `card_status_events` and survives reloads. The snapshot stays
  as the fallback when the database is not configured or not reachable.

### Update and freshness policy

The bucket delivers one file per day per table (1,097 days). The policy for
production:

- **Batch, daily.** Card emergencies need the card's current status, which
  the operational store holds; analytics only needs daily freshness. No
  streaming is required by the inputs.
- **Idempotent loads.** Snowflake's `COPY INTO` skips files it has already
  loaded, so a re-run adds only new days; the clean layer is rebuilt from
  landing.
- **Contract gate.** A file that breaks the contract goes to quarantine and
  the export stops; the agent keeps serving the last good load.
- **Window.** The agent subset keeps 6 months of card transactions (one `SET`
  in `04_agent_tables.sql`).
- **Freshness check.** Each load and each snapshot records when it ran and
  which export it came from; `/api/health` reports the live source, its last
  `load_run` and the snapshot's checksum.

**Update correctness, shown on a labeled test fixture**
([`test_snapshot.py`](../data-engineering/pipelines/snapshot/test_snapshot.py),
4 tests, all passing): the same export always builds the same snapshot; a v2
export with one card blocked and one new transaction yields a diff with
exactly those two changes; an export altered after its manifest was written
is refused; a row that breaks the contract is refused. The Postgres load has
its own ([`test_load_postgres.py`](../data-engineering/pipelines/postgres/test_load_postgres.py),
3 tests, all passing): an altered export is refused without touching the
database; loading the same export twice is a no-op; a v2 reload replaces the
source rows and keeps the block the agent recorded before it.

## 5. The system and how it was measured

- Architecture and policy: [`README.md`](../README.md).
- Learned component: intent classifier, macro-F1 0.77 vs. 0.59 for keyword
  rules on 102 held-out sentences ([`ml/intent/`](../ml/intent/)).
- End to end: 35 held-out conversations (4 on dataset customers), 33 correct
  vs. 26 for the baseline, 0 unsafe outcomes in both, with the same results
  served from PostgreSQL and from the snapshot
  ([`banking-system/evaluation/`](../banking-system/evaluation/)).

## 6. Timeline

| Date (2026) | What happened |
| --- | --- |
| Late September | Kickoff. The four-person team agrees to explore the dataset individually and meet to propose a workflow and a business problem. |
| 25–28 September | The data engineer explores the bucket in Snowflake (Q01–Q11) and proposes justified candidates; with no other proposals, the team goes ahead with Card Support and unrecognized charges. |
| 27 September – 1 October | The project lead sets up the team repository, the AWS target architecture, the task plan and the AgentCore agent scaffold. |
| 28 September | Stage 1: contracts, cleaning and the agent subset export. |
| 2 October | Roles change: the lead takes the AWS backend; the data engineer takes the frontend. The exploration evidence is merged. |
| 3 October | Customer chat and agent desk UI in review. In the afternoon the lead formally withdraws after concluding that her circumstances did not allow her to continue; it is agreed that her contributions stay in the project with her credit. |
| 5 October | The remaining members have also withdrawn. The data engineer finishes alone: business case (Q12), a new public repository with the full history, the rules engine and classifier, deployment, evaluation, the snapshot step that connects the stage 1 export to the agent, the PostgreSQL operational store with the snapshot as fallback, and this report. |

The scope was adjusted to what one person could build and verify in a day.
The AWS architecture stays as the documented route to production rather than
the running prototype.

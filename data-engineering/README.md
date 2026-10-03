# Data engineering: exploration, cleaning and the agent subset

Reproducible evidence behind the choice of Card Support, and the pipeline that
turns the raw hackathon dataset into the clean subset the agent uses. All of it
runs in Snowflake over the read-only datathon bucket; nothing is downloaded in
bulk.

Start with [`docs/workflow_selection.md`](../docs/workflow_selection.md) for the
decision and [`docs/data_gaps.md`](../docs/data_gaps.md) for what the data
cannot prove.

## Contents

| Path | Stage | What it is |
| --- | --- | --- |
| [`analysis/`](analysis/) | 0 · Exploration | Q01–Q11: the SQL that led to the workflow choice, each with its question, result, decision and Snowflake `query_id` |
| [`pipelines/snowflake/`](pipelines/snowflake/) | 1 · Contracts and cleaning | Landing, profiling, typed clean tables, quarantine, the agent subset and its Parquet export |
| [`contracts/agent_tables.py`](contracts/agent_tables.py) | 1 | Pydantic models for every exported table; the loader validates each row against them |
| [`docs/profile_core.md`](docs/profile_core.md) | 1 | Profile of the five core tables: every cleaning rule traces back to a finding here |
| [`docs/data_dictionary.md`](docs/data_dictionary.md) | 0–1 | The 13 source tables, their columns and their role in Card Support |

The SQL headers in `analysis/` keep the labels they had when the queries were
run (for example "DRAFT … confirm Result in Snowflake", or a mention of the
original Postgres plan). They are the audit trail of the exploration and are
not rewritten. "Master Context" in those headers is the team's internal
planning document, in Spanish; "Gap N" points to
[`docs/data_gaps.md`](../docs/data_gaps.md).

## Outputs

The agent subset is exported to `data/agent/` as Parquet files plus a
`manifest.json` with row counts, columns, SHA-256 checksums and the Snowflake
`query_id` of each export:

| Table | Rows |
| --- | --- |
| `agent_customers` (card holders) | 91,084 |
| `agent_cards` | 140,040 |
| `agent_transactions` (last 6 months, card products) | 258,561 |
| `agent_complaints` | 41,341 |

The backend loads these files into its operational store (DynamoDB) and should
verify them against the manifest first.

## Reproduce

Requirements: a Snowflake account with access to the datathon bucket, and
Python 3 (developed with Python 3.14).

1. Put credentials in `~/.config/datathon/.env`, outside the repo (variable names in
   [`.env.example`](.env.example)).
2. Create a virtual environment and install `requirements.txt`.
3. Exploration: run `analysis/00_setup/` and then any of Q01–Q11 in a Snowflake
   worksheet (see [`analysis/README.md`](analysis/README.md)).
4. Pipeline, from this folder:

```powershell
python pipelines/snowflake/run.py
python pipelines/snowflake/run.py 03_clean.sql 04_agent_tables.sql
python pipelines/snowflake/export.py
```

Each run writes its results and a `run_log.csv` with every `query_id` to
`runs/<timestamp>/`.

## Not in the repo

- **The dataset and the exported Parquet files.** They belong to the
  hackathon; `data/` and `runs/` are git-ignored and are rebuilt by rerunning
  the pipeline. Teammates receive the Parquet files privately, with the
  manifest.
- **Credentials.** Never inside the project folder.

# pipelines/snowflake/ · Stage 1: contracts and cleaning

Loads the five Card Support core tables from the datathon bucket, profiles them and builds clean, typed tables. The agent never queries Snowflake: the clean tables are exported to Parquet files with a checksum manifest, and the backend loads them into its operational store (DynamoDB).

## Run order

| File | What it does | Status |
| --- | --- | --- |
| `00_schemas.sql` | Creates `LANDING`, `CLEAN` and `QUARANTINE` in `DATATHON_DB` | Ready |
| `01_landing_core.sql` | Lands `products`, `customers`, `daily_exchange_rates`, `transactions` and `complaints` as text, with source file and row | Ready |
| `02_profile_core.sql` | Missing values, type failures, duplicates, categories, ranges, referential integrity, cross-field checks, subset sizing | Ready |
| `03_clean.sql` | Typed tables in `CLEAN`, rejected rows in `QUARANTINE`, data quality flags, `amount_usd` recomputed | Ready |
| `04_agent_tables.sql` | The agent subset (`CLEAN.agent_*`): card holders, cards, 6 months of card transactions, complaints; least-data columns | Ready |
| `export.py` | Exports `CLEAN.agent_*` to `data/agent/*.parquet` with a checksum manifest | Ready |

## How to run

From `data-engineering/`, with the virtual environment active and credentials in `~/.config/datathon/.env`:

```
python pipelines/snowflake/run.py                                  # 00-02: land and profile
python pipelines/snowflake/run.py 03_clean.sql 04_agent_tables.sql # clean and build the agent subset
python pipelines/snowflake/export.py                               # export the agent subset
```

Each run writes its results and a `run_log.csv` with every Snowflake `query_id` to `runs/<timestamp>/`.

## Design rules

- **No silent loss.** Nothing is skipped: a row that breaks a rule goes to `QUARANTINE` with the rule name, and every run reports counts.
- **Missing is not zero.** No `fillna(0)`-style imputation. `amount_usd` is filled only where it is recoverable: USD rows take `amount`, and COP/ARS rows use the fixed rate implied by the source (the daily rate table disagrees with the source and is kept for reference only; see `docs/profile_core.md`). Every row records the method in `amount_usd_method`; other missing values stay missing.
- **Rerunnable.** Every step uses `CREATE OR REPLACE`, so a full rerun gives the same result.
- **Least data.** Only the columns an agent tool needs leave Snowflake; sensitive customer fields stay here.

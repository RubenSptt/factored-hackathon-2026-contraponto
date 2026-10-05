# analysis/ · Stage 0: exploration in Snowflake

SQL from the exploration that led the team to choose Card Support and define the business problem. This is the reproducible log the kickoff asks for: each file states what was asked, what it returned and which decision or gap it led to.

**Status:** all 43 statements were cross-checked against the Snowflake Query History (Sep 25–28): every one of them appears as executed, and each carries its execution time (Colombia time) and `query_id`. Dates are verified. Results come from the figures in the team's planning document (the "Master Context", in Spanish) and are confirmed by re-running the query, since Query History stores the SQL but not the results. The original working file (`consultas`) stays in the author's local archive; each SQL file names the blocks it came from.

**Note on identifiers:** column aliases and string literals (`pct_escalado`, `'Sin producto ligado'`, …) are kept exactly as executed so each file matches its `query_id` in Query History. The dataset itself is in Spanish.

## Run order

1. `00_setup/00_context_and_stage.sql`: context, stage (placeholders, no keys) and file formats.
2. `00_setup/01_exploratory_load.sql`: exploratory tables in `PUBLIC`.
3. `Q01` to `Q12`, in any order.
4. `business_case_estimate.py`: turns the Q12 results and the stated assumptions into the business case (`docs/business_case.md`).

## Index

| ID | Question | Result (draft) | Leads to |
| --- | --- | --- | --- |
| Q01 | What is in the bucket? | 7,671 files, 13 tables | Setup |
| Q02 | Which categories are most complex? | Complaint: 434.6 s, 63% follow-up; escalation ~10% everywhere | Gap 3 |
| Q03 | Which complaints take longest? | Unrecognized charge: 12,297, 15.4 days, 20.4% SLA breach | Business problem |
| Q04 | Are the texts real? | No: template text and fields without signal | Gaps 2, 4, 9 |
| Q05 | Was call_transcripts fully loaded? | 171,321 rows, 1,097 files, 0 errors | Gap 6 |
| Q06 | Do interaction labels carry signal? | They depend only on the category | Gap 7 |
| Q07 | Does fraud depend on anything but the score? | No: fraud_score cutoff at ~35 | Gap 7 |
| Q08 | How many cards, and in what status? | 140,040 cards; 9,904 blocked or suspended | Stages 2 and 8 |
| Q09 | Does satisfaction change by category? | CSAT from 2.43 (Complaint) to 2.91 (Transactional) | Business problem |
| Q10 | Are unrecognized charges card-related? | Linked product is random; 33.8% have none | Business problem |
| Q11 | What columns does each table have? | 13 tables, one stable header each | `docs/data_dictionary.md` |
| Q12 | How many card contacts could the agent contain, at what cost? | Técnico 360.8 s, 59.4% simple pool; `mentioned_products` is noise; `origin_interaction_id` always null | `docs/business_case.md`, Gap 12 |

## Missing

These Master Context findings had no SQL in `consultas` or in the Snowflake Query History (Sep 25–28). The first three are now re-measured with reproducible SQL in stage 1 (`pipelines/snowflake/02_profile_core.sql`, results in `docs/profile_core.md`); the last two are outside Card Support and stay unverified:

- `transactions` quality: `amount_usd` 57% null, `fraud_score` 20% null, "Mexico" and "México" (Gap 8). This is the basis of stage 1.
- `products.product_type` values are in Spanish, while the data dictionary documents them in English.
- Loaded row counts for `transactions` (4.43M) and `call_center_interactions` (686K).
- Supporting volume per workflow (~15.15M, ~6.08M, ~1.48M, ~550K).
- `campaign_sends`: 1,083 of 1,097 days (14 missing).

## Caveats

- Loads use `ON_ERROR = 'CONTINUE'`, which was fine for exploration. The stage 1 load uses validation and `ABORT_STATEMENT`.
- `datathon_csv` confirmed with `DESC FILE FORMAT` (2026-09-28): only `SKIP_HEADER = 1` and `FIELD_OPTIONALLY_ENCLOSED_BY = '"'` differ from the defaults. Strict parsing comes from Snowflake defaults (`MULTI_LINE = TRUE`, `ERROR_ON_COLUMN_COUNT_MISMATCH = TRUE`), so the saved `CREATE` reproduces the format used.
- Two formatter artifacts that broke the SQL were fixed: `@DATATHON_STAGE / folder /` became `@DATATHON_STAGE/folder/`, and `= >` became `=>`.

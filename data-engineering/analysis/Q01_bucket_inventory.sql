-- ID: Q01
-- Question: What is in the bucket, and can Snowflake read it?
-- Tables: stage DATATHON_STAGE, branches.csv
-- Result: 7,671 files; exactly the 13 tables in the data dictionary; branches.csv reads correctly
-- Leads to: Master Context · Setup; supporting volume per workflow
-- Date: 2026-09-26 (Query History, Colombia time)
-- Label: DRAFT built from the original `consultas` file; Date verified against Query History; confirm Result in Snowflake
-- Warning: the RESULT_SCAN(LAST_QUERY_ID()) query must run right after the LIST.
-- Source: `consultas`, blocks B01, B02, B30

-- Executed: 2026-09-26 15:18 (Colombia time) · query_id 01c75602-0001-a955-0001-6cba0001b2ea
LIST @DATATHON_STAGE;

-- Executed: 2026-09-26 15:19 (Colombia time) · query_id 01c75603-0001-a955-0001-6cba0001b30a
SELECT $1, $2, $3, $4 FROM @DATATHON_STAGE/branches.csv LIMIT 5;

-- Executed: 2026-09-26 15:18 (Colombia time) · query_id 01c75602-0001-a955-0001-6cba0001b2ea
LIST @DATATHON_STAGE;

-- Executed: 2026-09-26 20:00 (Colombia time) · query_id 01c7571c-0001-a955-0001-6cba0001bc02
SELECT SPLIT_PART ("name", '/', 5) AS carpeta, COUNT(*) AS archivos
FROM
TABLE (
    RESULT_SCAN (LAST_QUERY_ID ())
)
GROUP BY
    1
ORDER BY 1;

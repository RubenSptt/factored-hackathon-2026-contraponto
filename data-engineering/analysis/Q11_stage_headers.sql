-- ID: Q11
-- Question: What columns does each of the 13 tables in the bucket have, including the ones never loaded?
-- Tables: stage DATATHON_STAGE (all files)
-- Result: 13 distinct headers, one per table; each folder has a single header across all its daily files (stable schema).
--         Daily tables have 1,097 files, except campaign_sends with 1,083.
-- Leads to: docs/data_dictionary.md; stage 1 contracts
-- Date: 2026-09-28 (Colombia time)
-- Label: result verified from the exported output (stage_headers.csv, kept local)
-- Note: the executed version used SPLIT_PART(..., '/', 1), which returned the stage prefix "data" for every row.
--       Fixed below to take the folder or file name. The filter on row 1 is applied after reading,
--       so the query scans every file in the bucket (several minutes on an X-Small warehouse).

USE DATABASE DATATHON_DB;
USE SCHEMA PUBLIC;

SELECT REGEXP_REPLACE(SPLIT_PART(METADATA$FILENAME, '/', 2), '\\.csv$', '') AS table_name,
       $1       AS header,
       COUNT(*) AS files
FROM @DATATHON_STAGE (FILE_FORMAT => 'raw_lines', PATTERN => '.*[.]csv')
WHERE METADATA$FILE_ROW_NUMBER = 1
GROUP BY 1, 2
ORDER BY 1;

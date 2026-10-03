-- ID: Q05
-- Question: Was call_transcripts fully loaded, or were rows lost?
-- Tables: stage call_transcripts/, call_transcripts
-- Result: 171,321 rows in 1,097 files, 0 errors, 0 duplicates, a single header.
--         926,448 raw lines = 171,321 records + 754,030 line breaks inside texts + headers
-- Leads to: Gap 6 (data dictionary counts are approximate)
-- Date: 2026-09-26 (Query History, Colombia time)
-- Label: DRAFT built from the original `consultas` file; Date verified against Query History; confirm Result in Snowflake
-- Warning: the RESULT_SCAN(LAST_QUERY_ID()) query must run right after the LIST.
-- Source: `consultas`, blocks B16, B18, B19, B20, B28, B29, B31

-- Executed: 2026-09-26 18:15 (Colombia time) · query_id 01c756b3-0001-a955-0001-6cba0001b7a2
COPY INTO call_transcripts
FROM
    @DATATHON_STAGE/call_transcripts/ FILE_FORMAT = (FORMAT_NAME = datathon_csv) PATTERN = '.*[.]csv' VALIDATION_MODE = 'RETURN_ERRORS';

-- Executed: 2026-09-26 18:19 (Colombia time) · query_id 01c756b7-0001-a955-0001-6cba0001b7e6
SELECT COUNT(*)
FROM
    @DATATHON_STAGE/call_transcripts/ (
        FILE_FORMAT => 'datathon_csv',
        PATTERN => '.*[.]csv'
    );

-- Executed: 2026-09-26 18:22 (Colombia time) · query_id 01c756ba-0001-a955-0001-6cba0001b822
LIST @DATATHON_STAGE/call_transcripts/;

-- Executed: 2026-09-26 18:22 (Colombia time) · query_id 01c756ba-0001-a955-0001-6cba0001b82e
SELECT REGEXP_SUBSTR("name", '\\.[a-z0-9.]+$') AS extension, COUNT(*) AS archivos
FROM
TABLE (
    RESULT_SCAN (LAST_QUERY_ID ())
)
GROUP BY
    1;

-- Executed: 2026-09-26 18:23 (Colombia time) · query_id 01c756bb-0001-a955-0001-6cba0001b84a
SELECT COUNT(*) AS filas, COUNT(DISTINCT transcript_id) AS ids_unicos
FROM call_transcripts;

-- Executed: 2026-09-26 19:50 (Colombia time) · query_id 01c75712-0001-a955-0001-6cba0001bb56
-- Do all files share the same header? (1 row = stable schema)
SELECT $1 AS encabezado, COUNT(*) AS archivos
FROM
    @DATATHON_STAGE/call_transcripts/ (
        FILE_FORMAT => 'raw_lines',
        PATTERN => '.*[.]csv'
    )
WHERE
    METADATA$FILE_ROW_NUMBER = 1
GROUP BY
    1;

-- Executed: 2026-09-26 19:55 (Colombia time) · query_id 01c75717-0001-a955-0001-6cba0001bb92
SELECT COUNT(*) AS lineas
FROM
    @DATATHON_STAGE/call_transcripts/ (
        FILE_FORMAT => 'raw_lines',
        PATTERN => '.*[.]csv'
    );

-- Executed: 2026-09-26 20:04 (Colombia time) · query_id 01c75720-0001-a955-0001-6cba0001bc22
SELECT SUM(
        REGEXP_COUNT (COALESCE(full_text, ''), '\n') + REGEXP_COUNT (
            COALESCE(customer_text, ''), '\n'
        ) + REGEXP_COUNT (
            COALESCE(agent_text, ''), '\n'
        ) + REGEXP_COUNT (
            COALESCE(mentioned_entities, ''), '\n'
        ) + REGEXP_COUNT (
            COALESCE(detected_keywords, ''), '\n'
        )
    ) AS saltos_en_textos
FROM call_transcripts;

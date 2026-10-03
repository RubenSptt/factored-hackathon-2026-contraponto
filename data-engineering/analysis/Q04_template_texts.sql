-- ID: Q04
-- Question: Do the free-text and enrichment fields hold real content?
-- Tables: call_transcripts, complaints
-- Result: no. main_topics/detected_intents 95% consulta_general (162,864) and 5% null (8,457);
--         customer_text has only 2 intents (85,910 and 85,411); agent_text has 11 sentences with {monto} {moneda};
--         complaints.description has 1 text per category
-- Leads to: Gaps 2 and 4; the knowledge base is written by the team (Gap 9)
-- Date: 2026-09-26 (Query History, Colombia time)
-- Label: DRAFT built from the original `consultas` file; Date verified against Query History; confirm Result in Snowflake
-- Source: `consultas`, blocks B12, B13, B14, B15, B17, B32

-- Executed: 2026-09-26 16:23 (Colombia time) · query_id 01c75643-0001-a955-0001-6cba0001b622
SELECT main_topics, COUNT(*) AS n, AVG(duration_seconds) AS avg_duration
FROM call_transcripts
GROUP BY
    main_topics
ORDER BY n DESC
LIMIT 30;

-- Executed: 2026-09-26 17:07 (Colombia time) · query_id 01c7566f-0001-a955-0001-6cba0001b6b2
SELECT
    detected_intents,
    detected_keywords,
    mentioned_entities,
    LEFT(customer_text, 300) AS txt
FROM call_transcripts SAMPLE (20 ROWS);

-- Executed: 2026-09-26 17:12 (Colombia time) · query_id 01c75674-0001-a955-0001-6cba0001b70e
SELECT
    detected_intents,
    COUNT(*) AS n,
    ROUND(AVG(duration_seconds), 1) AS dur_prom
FROM call_transcripts
GROUP BY
    1
ORDER BY 2 DESC;

-- Executed: 2026-09-26 17:14 (Colombia time) · query_id 01c75676-0001-a955-0001-6cba0001b72e
SELECT TRIM(s.value) AS frase, COUNT(DISTINCT t.transcript_id) AS n_transcripts
FROM
    call_transcripts t,
    LATERAL SPLIT_TO_TABLE (
        REGEXP_REPLACE(
            t.customer_text,
            '([.?!])\\s+',
            '\\1|'
        ),
        '|'
    ) s
WHERE
    t.customer_text IS NOT NULL
GROUP BY
    1
ORDER BY 2 DESC;

-- Executed: 2026-09-26 18:15 (Colombia time) · query_id 01c756b3-0001-a955-0001-6cba0001b7c2
SELECT
    category,
    COUNT(*) AS n,
    COUNT(DISTINCT description) AS textos_distintos
FROM complaints
GROUP BY
    1
ORDER BY 2 DESC;

-- Executed: 2026-09-26 20:04 (Colombia time) · query_id 01c75720-0001-a955-0001-6cba0001bc36
SELECT TRIM(s.value) AS frase, COUNT(DISTINCT t.transcript_id) AS n_transcripts
FROM
    call_transcripts t,
    LATERAL SPLIT_TO_TABLE (
        REGEXP_REPLACE(
            t.agent_text,
            '([.?!])\\s+',
            '\\1|'
        ),
        '|'
    ) s
WHERE
    t.agent_text IS NOT NULL
GROUP BY
    1
ORDER BY 2 DESC
LIMIT 50;

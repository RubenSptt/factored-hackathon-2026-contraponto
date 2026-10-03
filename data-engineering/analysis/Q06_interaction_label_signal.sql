-- ID: Q06
-- Question: Do escalation, follow-up and resolution depend on any variable?
-- Tables: call_center_interactions
-- Result: was_escalated ~10% in every slice; follow-up and resolution depend only on reason_category
--         (Transactional 91.5% resolved / 22.1% follow-up; Complaint 43.6% / 63.0%); sentiment adds nothing
-- Leads to: Gap 7; escalation designed as team rules
-- Date: 2026-09-26 (Query History, Colombia time)
-- Label: DRAFT built from the original `consultas` file; Date verified against Query History; confirm Result in Snowflake
-- Source: `consultas`, blocks B21, B22

-- Executed: 2026-09-26 18:26 (Colombia time) · query_id 01c756be-0001-a955-0001-6cba0001b86e
WITH base AS (
  SELECT *,
         IFF(TRY_TO_BOOLEAN(was_escalated::STRING), 1, 0)     AS esc,
         IFF(TRY_TO_BOOLEAN(requires_followup::STRING), 1, 0) AS seg,
         IFF(TRY_TO_BOOLEAN(was_resolved::STRING), 1, 0)      AS res
  FROM call_center_interactions
)
SELECT 'sentimiento' AS variable, detected_sentiment AS valor, COUNT(*) AS n,
       ROUND(AVG(esc)*100,1) AS pct_escalado, ROUND(AVG(seg)*100,1) AS pct_seguimiento, ROUND(AVG(res)*100,1) AS pct_resuelto
FROM base GROUP BY 1,2
UNION ALL
SELECT 'canal', channel, COUNT(*),
       ROUND(AVG(esc)*100,1), ROUND(AVG(seg)*100,1), ROUND(AVG(res)*100,1)
FROM base GROUP BY 1,2
UNION ALL
SELECT 'tipo', interaction_type, COUNT(*),
       ROUND(AVG(esc)*100,1), ROUND(AVG(seg)*100,1), ROUND(AVG(res)*100,1)
FROM base GROUP BY 1,2
UNION ALL
SELECT 'espera',
       CASE WHEN wait_time_seconds < 60  THEN 'a) < 1 min'
            WHEN wait_time_seconds < 300 THEN 'b) 1-5 min'
            ELSE 'c) > 5 min' END,
       COUNT(*), ROUND(AVG(esc)*100,1), ROUND(AVG(seg)*100,1), ROUND(AVG(res)*100,1)
FROM base GROUP BY 1,2
ORDER BY 1,2;

-- Executed: 2026-09-26 18:31 (Colombia time) · query_id 01c756c3-0001-a955-0001-6cba0001b8ae
WITH base AS (
  SELECT reason_category,
         IFF(detected_sentiment = 'Neutral', 'Neutral', 'No neutral') AS sentimiento,
         IFF(TRY_TO_BOOLEAN(requires_followup::STRING), 1, 0) AS seg,
         IFF(TRY_TO_BOOLEAN(was_resolved::STRING), 1, 0)      AS res
  FROM call_center_interactions
)
SELECT reason_category, sentimiento, COUNT(*) AS n,
       ROUND(AVG(seg)*100,1) AS pct_seguimiento,
       ROUND(AVG(res)*100,1) AS pct_resuelto
FROM base
GROUP BY 1,2
ORDER BY 1,2;

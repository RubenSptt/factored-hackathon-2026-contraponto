-- ID: Q09
-- Question: Does satisfaction change with the contact category?
-- Tables: satisfaction_surveys, call_center_interactions
-- Result: 212,759 joined surveys. CSAT: Transactional 2.91, Product 2.90, Technical 2.70, Complaint 2.43
-- Leads to: Business problem (candidate 4); pitch
-- Date: 2026-09-26 (Query History, Colombia time)
-- Label: DRAFT built from the original `consultas` file; Date verified against Query History; confirm Result in Snowflake
-- Source: `consultas`, blocks B27

-- Executed: 2026-09-26 19:29 (Colombia time) · query_id 01c756fd-0001-a955-0001-6cba0001bae2
SELECT c.reason_category, s.survey_type, COUNT(*) AS n, ROUND(AVG(s.main_score), 2) AS score_prom
FROM
    satisfaction_surveys s
    JOIN call_center_interactions c ON s.interaction_id = c.interaction_id
GROUP BY
    1,
    2
ORDER BY 2, 1;

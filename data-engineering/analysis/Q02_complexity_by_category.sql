-- ID: Q02
-- Question: Which contact categories take longer, escalate more or need more follow-up?
-- Tables: call_center_interactions
-- Result: 6 categories (686,296 interactions). Complaint (Queja): 434.6 s and 63.0% follow-up;
--         Transactional: 220.8 s and 22.1%. Escalation ~10% in every category.
--         contact_reason = reason_category (same 6 values)
-- Leads to: Gap 3 (redundant taxonomy); scalability argument
-- Date: 2026-09-26 (Query History, Colombia time)
-- Label: DRAFT built from the original `consultas` file; Date verified against Query History; confirm Result in Snowflake
-- Source: `consultas`, blocks B08, B09

-- Executed: 2026-09-26 15:54 (Colombia time) · query_id 01c75626-0001-a955-0001-6cba0001b4d6
SELECT
    reason_category,
    COUNT(*) AS n,
    AVG(duration_seconds) AS avg_duration,
    AVG(wait_time_seconds) AS avg_wait,
    AVG(
        CASE
            WHEN was_escalated THEN 1
            ELSE 0
        END
    ) AS pct_escalated,
    AVG(
        CASE
            WHEN requires_followup THEN 1
            ELSE 0
        END
    ) AS pct_followup
FROM call_center_interactions
GROUP BY
    reason_category
ORDER BY n DESC;

-- Executed: 2026-09-26 16:10 (Colombia time) · query_id 01c75636-0001-a955-0001-6cba0001b58a
SELECT
    contact_reason,
    reason_category,
    COUNT(*) AS n,
    AVG(duration_seconds) AS avg_duration
FROM call_center_interactions
GROUP BY
    contact_reason,
    reason_category
ORDER BY n DESC
LIMIT 30;

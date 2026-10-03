-- ID: Q03
-- Question: Which complaint types take longest and breach the SLA most?
-- Tables: complaints
-- Result: "Cargo no reconocido" (unrecognized charge): 12,297 complaints, 15.4 days on average, 20.4% SLA breach
-- Leads to: Business problem (proposal); Gap 5
-- Date: 2026-09-26 (Query History, Colombia time)
-- Label: DRAFT built from the original `consultas` file; Date verified against Query History; confirm Result in Snowflake
-- Source: `consultas`, blocks B10

-- Executed: 2026-09-26 16:17 (Colombia time) · query_id 01c7563d-0001-a955-0001-6cba0001b5be
SELECT
    category,
    subcategory,
    COUNT(*) AS n,
    AVG(resolution_days) AS avg_resolution_days,
    AVG(
        CASE
            WHEN sla_breached THEN 1
            ELSE 0
        END
    ) AS pct_sla_breached
FROM complaints
GROUP BY
    category,
    subcategory
ORDER BY n DESC
LIMIT 30;

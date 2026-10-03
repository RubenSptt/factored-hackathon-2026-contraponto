-- ID: Q07
-- Question: Do fraud labels depend on anything besides the score?
-- Tables: transactions
-- Result: is_fraud = fraud_score cutoff at ~35 (0.03% below 30, 100% from 40);
--         channel, type, status, country and amount flat at ~0.1%
-- Leads to: Gap 7 / Signal test (Master Context)
-- Date: 2026-09-26 (Query History, Colombia time)
-- Label: DRAFT built from the original `consultas` file; Date verified against Query History; confirm Result in Snowflake
-- Source: `consultas`, blocks B24, B25

-- Executed: 2026-09-26 18:41 (Colombia time) · query_id 01c756cd-0001-a955-0001-6cba0001b93e
SELECT
    FLOOR(fraud_score / 10) * 10 AS rango_score,
    COUNT(*) AS n,
    ROUND(
        AVG(IFF (is_fraud, 1, 0)) * 100,
        2
    ) AS pct_fraude
FROM transactions
GROUP BY
    1
ORDER BY 1;

-- Executed: 2026-09-26 18:44 (Colombia time) · query_id 01c756d0-0001-a955-0001-6cba0001b97a
WITH
    b AS (
        SELECT *, IFF (is_fraud, 1, 0) AS f
        FROM transactions
    )
SELECT
    'canal' AS variable,
    channel AS valor,
    COUNT(*) AS n,
    SUM(f) AS fraudes,
    ROUND(AVG(f) * 100, 3) AS pct_fraude
FROM b
GROUP BY
    1,
    2
UNION ALL
SELECT 'tipo', transaction_type, COUNT(*), SUM(f), ROUND(AVG(f) * 100, 3)
FROM b
GROUP BY
    1,
    2
UNION ALL
SELECT 'estado', transaction_status, COUNT(*), SUM(f), ROUND(AVG(f) * 100, 3)
FROM b
GROUP BY
    1,
    2
UNION ALL
SELECT 'pais', transaction_country, COUNT(*), SUM(f), ROUND(AVG(f) * 100, 3)
FROM b
GROUP BY
    1,
    2
UNION ALL
SELECT
    'monto_usd',
    CASE
        WHEN amount_usd < 10 THEN 'a) < 10'
        WHEN amount_usd < 100 THEN 'b) 10-100'
        WHEN amount_usd < 1000 THEN 'c) 100-1000'
        WHEN amount_usd >= 1000 THEN 'd) >= 1000'
        ELSE 'e) nulo'
    END,
    COUNT(*),
    SUM(f),
    ROUND(AVG(f) * 100, 3)
FROM b
GROUP BY
    1,
    2
ORDER BY 1, 2;

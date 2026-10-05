-- ID: Q12
-- Question: How many card contacts could the agent contain safely, and what does a human resolution cost today?
-- Tables: call_center_interactions, complaints, products
-- Result: window 2023-06-17..2026-06-18 (1,098 days). Card holders = 61% of contacts with the same rates as everyone else.
--         Card holders, per category: Técnico 62,484 contacts, 360.8 s, 69.8% resolved, 59.4% simple pool;
--         Producto 91,418, 266.5 s, 89.7%, 76.2%; Queja 71,138, 434.4 s, 43.7%, 37.1%.
--         mentioned_products is noise (99.3% unknown ids, 0% the caller's); origin_interaction_id is always null.
-- Leads to: docs/business_case.md (inputs of business_case_estimate.py); Gap 12
-- Date: 2026-10-05 (Query History, Colombia time)
-- Label: results read from the Snowflake result grid at run time
-- Note: simple pool = resolved at first contact and no follow-up, the ceiling of what the agent could close alone.

USE DATABASE DATATHON_DB;
USE SCHEMA PUBLIC;

-- Executed: 2026-10-05 09:53 (Colombia time) · query_id 01c7875d-0001-ae22-0001-6cba00064322
-- Result: 59.9-60.1% null in every category; the rest are lists of 1-3 product ids (see block 1b)
-- Block 1 · Does mentioned_products carry any signal? (never profiled)
-- If its values follow the same mix in every category, it is noise like mentioned_entities (Gap 4).
SELECT reason_category,
       COALESCE(mentioned_products, '<null>') AS mentioned_products,
       COUNT(*) AS n,
       ROUND(RATIO_TO_REPORT(COUNT(*)) OVER (PARTITION BY reason_category) * 100, 1) AS pct_in_category
FROM call_center_interactions
GROUP BY 1, 2
QUALIFY ROW_NUMBER() OVER (PARTITION BY reason_category ORDER BY COUNT(*) DESC) <= 8
ORDER BY 1, 3 DESC;

-- Executed: 2026-10-05 10:26 (Colombia time) · query_id 01c7877e-0001-ae22-0001-6cba000644b2
-- Result: 99.3-99.4% of mentioned ids do not exist in products; 0.0% belong to the caller; 0.2% are cards, equal in every category -> noise
-- Block 1b · Second test of mentioned_products (Block 1 grouped whole strings, so the mix test failed:
-- 60% null in every category and the rest are lists of 1-3 product ids).
-- Signal would mean: the ids belong to the caller AND card share moves with the category.
WITH mentioned AS (
    SELECT i.interaction_id,
           i.customer_id,
           i.reason_category,
           TRIM(f.value::STRING) AS product_id
    FROM call_center_interactions i,
         LATERAL SPLIT_TO_TABLE(i.mentioned_products, ',') f
    WHERE i.mentioned_products IS NOT NULL
)
SELECT m.reason_category,
       COUNT(*)                                                               AS mentions,
       ROUND(AVG(IFF(p.product_id IS NULL, 1, 0)) * 100, 1)                   AS pct_missing_product,
       ROUND(AVG(IFF(p.customer_id = m.customer_id, 1, 0)) * 100, 1)          AS pct_own_product,
       ROUND(AVG(IFF(p.product_type IN ('Tarjeta Crédito', 'Tarjeta Débito'), 1, 0)) * 100, 1) AS pct_card
FROM mentioned m
LEFT JOIN products p ON m.product_id = p.product_id
GROUP BY 1
ORDER BY 1;

-- Executed: 2026-10-05 09:55 (Colombia time) · query_id 01c7875f-0001-ae22-0001-6cba0006434e
-- Block 2 · Time span, to annualize volumes with the real window (not an assumed 3 years)
SELECT 'call_center_interactions' AS table_name,
       MIN(interaction_date)::DATE AS first_day,
       MAX(interaction_date)::DATE AS last_day,
       COUNT(DISTINCT interaction_date::DATE) AS days,
       COUNT(*) AS n
FROM call_center_interactions
UNION ALL
SELECT 'complaints', MIN(creation_date)::DATE, MAX(creation_date)::DATE,
       COUNT(DISTINCT creation_date::DATE), COUNT(*)
FROM complaints;

-- Executed: 2026-10-05 09:56 (Colombia time) · query_id 01c78760-0001-ae22-0001-6cba00064376
-- Block 3 · Human baseline per category, card holders vs. the rest
-- simple_pool = resolved at first contact and no follow-up: the ceiling of what the agent could close alone.
WITH card_holders AS (
    SELECT DISTINCT customer_id
    FROM products
    WHERE product_type IN ('Tarjeta Crédito', 'Tarjeta Débito')
),
base AS (
    SELECT i.reason_category,
           IFF(ch.customer_id IS NOT NULL, 'card_holder', 'no_card') AS segment,
           i.duration_seconds,
           IFF(TRY_TO_BOOLEAN(i.was_resolved::STRING), 1, 0)      AS res,
           IFF(TRY_TO_BOOLEAN(i.requires_followup::STRING), 1, 0) AS fol
    FROM call_center_interactions i
    LEFT JOIN card_holders ch ON i.customer_id = ch.customer_id
)
SELECT reason_category,
       segment,
       COUNT(*)                                        AS n,
       ROUND(AVG(duration_seconds), 1)                 AS avg_duration_s,
       ROUND(MEDIAN(duration_seconds), 1)              AS median_duration_s,
       ROUND(AVG(res) * 100, 1)                        AS pct_resolved,
       ROUND(AVG(fol) * 100, 1)                        AS pct_followup,
       ROUND(AVG(IFF(res = 1 AND fol = 0, 1, 0)) * 100, 1) AS pct_simple_pool
FROM base
GROUP BY 1, 2
ORDER BY 1, 2;

-- Result: origin_interaction_id is null in all 12,297 complaints (7,620 card holders, 4,677 others)
-- Executed: 2026-10-05 10:06 (Colombia time) · query_id 01c7876a-0001-ae22-0001-6cba000643e2
-- Block 4 · Unrecognized-charge complaints: is origin_interaction_id a valid link to the intake call?
-- Valid = it exists AND belongs to the same customer. If valid, the intake call's real duration replaces
-- the assumption "intake call = mean Complaint duration".
WITH card_holders AS (
    SELECT DISTINCT customer_id
    FROM products
    WHERE product_type IN ('Tarjeta Crédito', 'Tarjeta Débito')
)
SELECT CASE
           WHEN c.origin_interaction_id IS NULL THEN 'a) no origin interaction'
           WHEN i.interaction_id IS NULL        THEN 'b) points to a missing interaction'
           WHEN i.customer_id <> c.customer_id  THEN 'c) another customer''s interaction'
           ELSE 'd) same customer'
       END                                      AS link_status,
       IFF(ch.customer_id IS NOT NULL, 'card_holder', 'no_card') AS segment,
       COUNT(*)                                 AS complaints,
       ROUND(AVG(i.duration_seconds), 1)        AS avg_intake_duration_s,
       MODE(i.reason_category)                  AS top_intake_category
FROM complaints c
LEFT JOIN call_center_interactions i ON c.origin_interaction_id = i.interaction_id
LEFT JOIN card_holders ch            ON c.customer_id = ch.customer_id
WHERE c.subcategory = 'Cargo no reconocido'
GROUP BY 1, 2
ORDER BY 1, 2;

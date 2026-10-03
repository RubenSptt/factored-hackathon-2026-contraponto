-- ID: Q08
-- Question: How many cards are there, and in what status?
-- Tables: products
-- Result: 400,000 products; 140,040 cards (100,102 credit, 39,938 debit);
--         9,904 blocked or suspended (7,044 and 2,860); status is spread evenly across all product types
-- Leads to: Technical plan · stages 2 and 8 (what to load into Postgres, test scenarios)
-- Date: 2026-09-26 (Query History, Colombia time)
-- Label: DRAFT built from the original `consultas` file; Date verified against Query History; confirm Result in Snowflake
-- Source: `consultas`, blocks B26

-- Executed: 2026-09-26 19:25 (Colombia time) · query_id 01c756f9-0001-a955-0001-6cba0001ba82
SELECT
    product_type,
    product_status,
    COUNT(*) AS n
FROM products
GROUP BY
    1,
    2
ORDER BY 1, 2;

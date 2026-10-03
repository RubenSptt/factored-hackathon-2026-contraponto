-- ID: Q10
-- Question: Are "Cargo no reconocido" (unrecognized charge) complaints linked to cards?
-- Tables: complaints, products
-- Result: the linked product follows the portfolio mix (random); 4,154 (33.8%) have no linked product;
--         2,772 linked to cards (1,962 credit, 810 debit)
-- Leads to: Business problem · Verification result
-- Date: 2026-09-28 (Query History, Colombia time)
-- Label: DRAFT built from the original `consultas` file; Date verified against Query History; confirm Result in Snowflake
-- Source: `consultas`, blocks B33

-- Executed: 2026-09-28 15:32 (Colombia time) · query_id 01c76150-0001-ad93-0001-6cba000330ce
SELECT COALESCE(p.product_type, 'Sin producto ligado') AS tipo_producto,
       COUNT(*) AS quejas,
       ROUND(AVG(c.resolution_days), 1) AS dias_prom,
       ROUND(AVG(IFF(TRY_TO_BOOLEAN(c.sla_breached::STRING), 1, 0)) * 100, 1) AS pct_fuera_sla
FROM complaints c
LEFT JOIN products p ON c.affected_product_id = p.product_id
WHERE c.subcategory = 'Cargo no reconocido'
GROUP BY 1
ORDER BY 2 DESC;

-- Stage 1 · 04: the subset the agent will see, built from CLEAN
-- Scope (proposal, 2026-09-28; change the two SET values to resize):
--   customers with at least one card, their cards, the last $months months of card transactions,
--   and all their complaints.
-- Least data: only the columns an agent tool needs. Document number, date of birth, contact data,
-- income, credit score and full card number stay in Snowflake. The agent sees card_last4 only.
-- These tables are exported to files by export.py and loaded into the operational store (DynamoDB, owned by the backend).

USE DATABASE DATATHON_DB;
USE SCHEMA CLEAN;

SET months = 6;
SET card_categories = 'credit_card,debit_card';

-- agent_cards:
CREATE OR REPLACE TABLE CLEAN.agent_cards AS
SELECT product_id, customer_id, product_category, product_type, card_last4, currency,
       current_balance, credit_limit, product_status, opening_date, expiration_date,
       has_linked_app, days_past_due, last_transaction_date,
       ARRAY_TO_STRING(dq_flags, ',') AS dq_flags
FROM CLEAN.products
WHERE ARRAY_CONTAINS(product_category::VARIANT, SPLIT($card_categories, ','));

-- agent_customers:
CREATE OR REPLACE TABLE CLEAN.agent_customers AS
SELECT customer_id, first_name, country, segment, customer_status
FROM CLEAN.customers
WHERE customer_id IN (SELECT customer_id FROM CLEAN.agent_cards);

-- agent_transactions:
CREATE OR REPLACE TABLE CLEAN.agent_transactions AS
SELECT t.transaction_id, t.transaction_date, t.product_id, t.customer_id, t.transaction_type,
       t.transaction_category, t.amount, t.currency, t.amount_usd, t.amount_usd_method, t.channel,
       t.merchant_name, t.merchant_category, t.transaction_country, t.transaction_city,
       t.transaction_status, t.response_code, t.is_fraud, t.fraud_score,
       ARRAY_TO_STRING(t.dq_flags, ',') AS dq_flags
FROM CLEAN.transactions t
JOIN CLEAN.agent_cards c ON t.product_id = c.product_id
WHERE t.transaction_date >= DATEADD(month, -$months, (SELECT MAX(transaction_date) FROM CLEAN.transactions));

-- agent_complaints:
-- affected_product_id is not exported: every complaint that names a product names another customer's product
-- (44,570 of 44,570, run 2026-09-28), so the link cannot be trusted. The agent links cases itself.
CREATE OR REPLACE TABLE CLEAN.agent_complaints AS
SELECT complaint_id, creation_date, customer_id, case_type, category, subcategory, reception_channel,
       claimed_amount, currency, priority, status, first_response_date,
       resolution_date, sla_breached, resolution_days,
       ARRAY_TO_STRING(dq_flags, ',') AS dq_flags
FROM CLEAN.complaints
WHERE customer_id IN (SELECT customer_id FROM CLEAN.agent_customers);

-- Summary: size of the agent subset
SELECT 'agent_customers' AS table_name, COUNT(*) AS row_count FROM CLEAN.agent_customers
UNION ALL SELECT 'agent_cards', COUNT(*) FROM CLEAN.agent_cards
UNION ALL SELECT 'agent_transactions', COUNT(*) FROM CLEAN.agent_transactions
UNION ALL SELECT 'agent_complaints', COUNT(*) FROM CLEAN.agent_complaints;

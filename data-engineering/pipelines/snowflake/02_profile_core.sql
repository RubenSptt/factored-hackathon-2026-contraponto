-- Stage 1 · 02: profile of the core tables (LANDING)
-- Every check here becomes a rule in contracts/ and in 03_clean.sql. Each block states what it measures
-- and which course practice or gap it serves. Results are recorded in docs/profile_core.md after the run.

USE DATABASE DATATHON_DB;
USE SCHEMA LANDING;

-- P01 · Missing values and type failures per column (practices 2.1 and 3.2; re-measures Gap 8)
-- missing = NULL or empty text; bad_type = has a value that does not cast to the expected type.
WITH profile AS (
SELECT 'products' AS table_name, 'product_id' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(product_id IS NULL OR TRIM(product_id) = '') AS missing,
       0 AS bad_type
FROM products
UNION ALL
SELECT 'products' AS table_name, 'customer_id' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(customer_id IS NULL OR TRIM(customer_id) = '') AS missing,
       0 AS bad_type
FROM products
UNION ALL
SELECT 'products' AS table_name, 'product_type' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(product_type IS NULL OR TRIM(product_type) = '') AS missing,
       0 AS bad_type
FROM products
UNION ALL
SELECT 'products' AS table_name, 'product_number' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(product_number IS NULL OR TRIM(product_number) = '') AS missing,
       0 AS bad_type
FROM products
UNION ALL
SELECT 'products' AS table_name, 'currency' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(currency IS NULL OR TRIM(currency) = '') AS missing,
       0 AS bad_type
FROM products
UNION ALL
SELECT 'products' AS table_name, 'current_balance' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(current_balance IS NULL OR TRIM(current_balance) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(current_balance), '') IS NOT NULL AND TRY_TO_DOUBLE(current_balance) IS NULL) AS bad_type
FROM products
UNION ALL
SELECT 'products' AS table_name, 'credit_limit' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(credit_limit IS NULL OR TRIM(credit_limit) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(credit_limit), '') IS NOT NULL AND TRY_TO_DOUBLE(credit_limit) IS NULL) AS bad_type
FROM products
UNION ALL
SELECT 'products' AS table_name, 'interest_rate' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(interest_rate IS NULL OR TRIM(interest_rate) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(interest_rate), '') IS NOT NULL AND TRY_TO_DOUBLE(interest_rate) IS NULL) AS bad_type
FROM products
UNION ALL
SELECT 'products' AS table_name, 'opening_date' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(opening_date IS NULL OR TRIM(opening_date) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(opening_date), '') IS NOT NULL AND TRY_TO_TIMESTAMP(opening_date) IS NULL) AS bad_type
FROM products
UNION ALL
SELECT 'products' AS table_name, 'expiration_date' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(expiration_date IS NULL OR TRIM(expiration_date) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(expiration_date), '') IS NOT NULL AND TRY_TO_TIMESTAMP(expiration_date) IS NULL) AS bad_type
FROM products
UNION ALL
SELECT 'products' AS table_name, 'opening_branch_id' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(opening_branch_id IS NULL OR TRIM(opening_branch_id) = '') AS missing,
       0 AS bad_type
FROM products
UNION ALL
SELECT 'products' AS table_name, 'product_status' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(product_status IS NULL OR TRIM(product_status) = '') AS missing,
       0 AS bad_type
FROM products
UNION ALL
SELECT 'products' AS table_name, 'opening_channel' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(opening_channel IS NULL OR TRIM(opening_channel) = '') AS missing,
       0 AS bad_type
FROM products
UNION ALL
SELECT 'products' AS table_name, 'has_linked_app' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(has_linked_app IS NULL OR TRIM(has_linked_app) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(has_linked_app), '') IS NOT NULL AND TRY_TO_BOOLEAN(has_linked_app) IS NULL) AS bad_type
FROM products
UNION ALL
SELECT 'products' AS table_name, 'days_past_due' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(days_past_due IS NULL OR TRIM(days_past_due) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(days_past_due), '') IS NOT NULL AND TRY_TO_DOUBLE(days_past_due) IS NULL) AS bad_type
FROM products
UNION ALL
SELECT 'products' AS table_name, 'last_transaction_date' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(last_transaction_date IS NULL OR TRIM(last_transaction_date) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(last_transaction_date), '') IS NOT NULL AND TRY_TO_TIMESTAMP(last_transaction_date) IS NULL) AS bad_type
FROM products
UNION ALL
SELECT 'products' AS table_name, 'last_updated' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(last_updated IS NULL OR TRIM(last_updated) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(last_updated), '') IS NOT NULL AND TRY_TO_TIMESTAMP(last_updated) IS NULL) AS bad_type
FROM products
UNION ALL
SELECT 'customers' AS table_name, 'customer_id' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(customer_id IS NULL OR TRIM(customer_id) = '') AS missing,
       0 AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'document_number' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(document_number IS NULL OR TRIM(document_number) = '') AS missing,
       0 AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'document_type' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(document_type IS NULL OR TRIM(document_type) = '') AS missing,
       0 AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'first_name' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(first_name IS NULL OR TRIM(first_name) = '') AS missing,
       0 AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'last_name' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(last_name IS NULL OR TRIM(last_name) = '') AS missing,
       0 AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'date_of_birth' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(date_of_birth IS NULL OR TRIM(date_of_birth) = '') AS missing,
       0 AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'gender' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(gender IS NULL OR TRIM(gender) = '') AS missing,
       0 AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'email' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(email IS NULL OR TRIM(email) = '') AS missing,
       0 AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'mobile_phone' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(mobile_phone IS NULL OR TRIM(mobile_phone) = '') AS missing,
       0 AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'landline_phone' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(landline_phone IS NULL OR TRIM(landline_phone) = '') AS missing,
       0 AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'address' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(address IS NULL OR TRIM(address) = '') AS missing,
       0 AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'city' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(city IS NULL OR TRIM(city) = '') AS missing,
       0 AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'state' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(state IS NULL OR TRIM(state) = '') AS missing,
       0 AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'country' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(country IS NULL OR TRIM(country) = '') AS missing,
       0 AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'postal_code' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(postal_code IS NULL OR TRIM(postal_code) = '') AS missing,
       0 AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'detected_accent' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(detected_accent IS NULL OR TRIM(detected_accent) = '') AS missing,
       0 AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'segment' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(segment IS NULL OR TRIM(segment) = '') AS missing,
       0 AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'credit_score' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(credit_score IS NULL OR TRIM(credit_score) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(credit_score), '') IS NOT NULL AND TRY_TO_DOUBLE(credit_score) IS NULL) AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'estimated_monthly_income' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(estimated_monthly_income IS NULL OR TRIM(estimated_monthly_income) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(estimated_monthly_income), '') IS NOT NULL AND TRY_TO_DOUBLE(estimated_monthly_income) IS NULL) AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'occupation' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(occupation IS NULL OR TRIM(occupation) = '') AS missing,
       0 AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'marital_status' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(marital_status IS NULL OR TRIM(marital_status) = '') AS missing,
       0 AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'education_level' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(education_level IS NULL OR TRIM(education_level) = '') AS missing,
       0 AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'registration_date' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(registration_date IS NULL OR TRIM(registration_date) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(registration_date), '') IS NOT NULL AND TRY_TO_TIMESTAMP(registration_date) IS NULL) AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'registration_branch_id' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(registration_branch_id IS NULL OR TRIM(registration_branch_id) = '') AS missing,
       0 AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'customer_status' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(customer_status IS NULL OR TRIM(customer_status) = '') AS missing,
       0 AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'last_updated' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(last_updated IS NULL OR TRIM(last_updated) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(last_updated), '') IS NOT NULL AND TRY_TO_TIMESTAMP(last_updated) IS NULL) AS bad_type
FROM customers
UNION ALL
SELECT 'customers' AS table_name, 'accepts_marketing' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(accepts_marketing IS NULL OR TRIM(accepts_marketing) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(accepts_marketing), '') IS NOT NULL AND TRY_TO_BOOLEAN(accepts_marketing) IS NULL) AS bad_type
FROM customers
UNION ALL
SELECT 'daily_exchange_rates' AS table_name, 'date' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(date IS NULL OR TRIM(date) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(date), '') IS NOT NULL AND TRY_TO_TIMESTAMP(date) IS NULL) AS bad_type
FROM daily_exchange_rates
UNION ALL
SELECT 'daily_exchange_rates' AS table_name, 'source_currency' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(source_currency IS NULL OR TRIM(source_currency) = '') AS missing,
       0 AS bad_type
FROM daily_exchange_rates
UNION ALL
SELECT 'daily_exchange_rates' AS table_name, 'target_currency' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(target_currency IS NULL OR TRIM(target_currency) = '') AS missing,
       0 AS bad_type
FROM daily_exchange_rates
UNION ALL
SELECT 'daily_exchange_rates' AS table_name, 'exchange_rate' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(exchange_rate IS NULL OR TRIM(exchange_rate) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(exchange_rate), '') IS NOT NULL AND TRY_TO_DOUBLE(exchange_rate) IS NULL) AS bad_type
FROM daily_exchange_rates
UNION ALL
SELECT 'daily_exchange_rates' AS table_name, 'buy_rate' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(buy_rate IS NULL OR TRIM(buy_rate) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(buy_rate), '') IS NOT NULL AND TRY_TO_DOUBLE(buy_rate) IS NULL) AS bad_type
FROM daily_exchange_rates
UNION ALL
SELECT 'daily_exchange_rates' AS table_name, 'sell_rate' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(sell_rate IS NULL OR TRIM(sell_rate) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(sell_rate), '') IS NOT NULL AND TRY_TO_DOUBLE(sell_rate) IS NULL) AS bad_type
FROM daily_exchange_rates
UNION ALL
SELECT 'daily_exchange_rates' AS table_name, 'source' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(source IS NULL OR TRIM(source) = '') AS missing,
       0 AS bad_type
FROM daily_exchange_rates
UNION ALL
SELECT 'transactions' AS table_name, 'transaction_id' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(transaction_id IS NULL OR TRIM(transaction_id) = '') AS missing,
       0 AS bad_type
FROM transactions
UNION ALL
SELECT 'transactions' AS table_name, 'transaction_date' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(transaction_date IS NULL OR TRIM(transaction_date) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(transaction_date), '') IS NOT NULL AND TRY_TO_TIMESTAMP(transaction_date) IS NULL) AS bad_type
FROM transactions
UNION ALL
SELECT 'transactions' AS table_name, 'process_date' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(process_date IS NULL OR TRIM(process_date) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(process_date), '') IS NOT NULL AND TRY_TO_TIMESTAMP(process_date) IS NULL) AS bad_type
FROM transactions
UNION ALL
SELECT 'transactions' AS table_name, 'product_id' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(product_id IS NULL OR TRIM(product_id) = '') AS missing,
       0 AS bad_type
FROM transactions
UNION ALL
SELECT 'transactions' AS table_name, 'customer_id' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(customer_id IS NULL OR TRIM(customer_id) = '') AS missing,
       0 AS bad_type
FROM transactions
UNION ALL
SELECT 'transactions' AS table_name, 'transaction_type' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(transaction_type IS NULL OR TRIM(transaction_type) = '') AS missing,
       0 AS bad_type
FROM transactions
UNION ALL
SELECT 'transactions' AS table_name, 'transaction_category' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(transaction_category IS NULL OR TRIM(transaction_category) = '') AS missing,
       0 AS bad_type
FROM transactions
UNION ALL
SELECT 'transactions' AS table_name, 'amount' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(amount IS NULL OR TRIM(amount) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(amount), '') IS NOT NULL AND TRY_TO_DOUBLE(amount) IS NULL) AS bad_type
FROM transactions
UNION ALL
SELECT 'transactions' AS table_name, 'currency' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(currency IS NULL OR TRIM(currency) = '') AS missing,
       0 AS bad_type
FROM transactions
UNION ALL
SELECT 'transactions' AS table_name, 'amount_usd' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(amount_usd IS NULL OR TRIM(amount_usd) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(amount_usd), '') IS NOT NULL AND TRY_TO_DOUBLE(amount_usd) IS NULL) AS bad_type
FROM transactions
UNION ALL
SELECT 'transactions' AS table_name, 'channel' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(channel IS NULL OR TRIM(channel) = '') AS missing,
       0 AS bad_type
FROM transactions
UNION ALL
SELECT 'transactions' AS table_name, 'branch_id' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(branch_id IS NULL OR TRIM(branch_id) = '') AS missing,
       0 AS bad_type
FROM transactions
UNION ALL
SELECT 'transactions' AS table_name, 'merchant_name' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(merchant_name IS NULL OR TRIM(merchant_name) = '') AS missing,
       0 AS bad_type
FROM transactions
UNION ALL
SELECT 'transactions' AS table_name, 'merchant_category' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(merchant_category IS NULL OR TRIM(merchant_category) = '') AS missing,
       0 AS bad_type
FROM transactions
UNION ALL
SELECT 'transactions' AS table_name, 'transaction_country' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(transaction_country IS NULL OR TRIM(transaction_country) = '') AS missing,
       0 AS bad_type
FROM transactions
UNION ALL
SELECT 'transactions' AS table_name, 'transaction_city' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(transaction_city IS NULL OR TRIM(transaction_city) = '') AS missing,
       0 AS bad_type
FROM transactions
UNION ALL
SELECT 'transactions' AS table_name, 'transaction_status' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(transaction_status IS NULL OR TRIM(transaction_status) = '') AS missing,
       0 AS bad_type
FROM transactions
UNION ALL
SELECT 'transactions' AS table_name, 'response_code' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(response_code IS NULL OR TRIM(response_code) = '') AS missing,
       0 AS bad_type
FROM transactions
UNION ALL
SELECT 'transactions' AS table_name, 'is_fraud' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(is_fraud IS NULL OR TRIM(is_fraud) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(is_fraud), '') IS NOT NULL AND TRY_TO_BOOLEAN(is_fraud) IS NULL) AS bad_type
FROM transactions
UNION ALL
SELECT 'transactions' AS table_name, 'fraud_score' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(fraud_score IS NULL OR TRIM(fraud_score) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(fraud_score), '') IS NOT NULL AND TRY_TO_DOUBLE(fraud_score) IS NULL) AS bad_type
FROM transactions
UNION ALL
SELECT 'transactions' AS table_name, 'latitude' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(latitude IS NULL OR TRIM(latitude) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(latitude), '') IS NOT NULL AND TRY_TO_DOUBLE(latitude) IS NULL) AS bad_type
FROM transactions
UNION ALL
SELECT 'transactions' AS table_name, 'longitude' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(longitude IS NULL OR TRIM(longitude) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(longitude), '') IS NOT NULL AND TRY_TO_DOUBLE(longitude) IS NULL) AS bad_type
FROM transactions
UNION ALL
SELECT 'complaints' AS table_name, 'complaint_id' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(complaint_id IS NULL OR TRIM(complaint_id) = '') AS missing,
       0 AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'creation_date' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(creation_date IS NULL OR TRIM(creation_date) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(creation_date), '') IS NOT NULL AND TRY_TO_TIMESTAMP(creation_date) IS NULL) AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'process_date' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(process_date IS NULL OR TRIM(process_date) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(process_date), '') IS NOT NULL AND TRY_TO_TIMESTAMP(process_date) IS NULL) AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'customer_id' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(customer_id IS NULL OR TRIM(customer_id) = '') AS missing,
       0 AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'case_type' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(case_type IS NULL OR TRIM(case_type) = '') AS missing,
       0 AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'category' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(category IS NULL OR TRIM(category) = '') AS missing,
       0 AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'subcategory' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(subcategory IS NULL OR TRIM(subcategory) = '') AS missing,
       0 AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'reception_channel' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(reception_channel IS NULL OR TRIM(reception_channel) = '') AS missing,
       0 AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'affected_product_id' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(affected_product_id IS NULL OR TRIM(affected_product_id) = '') AS missing,
       0 AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'related_branch_id' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(related_branch_id IS NULL OR TRIM(related_branch_id) = '') AS missing,
       0 AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'origin_interaction_id' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(origin_interaction_id IS NULL OR TRIM(origin_interaction_id) = '') AS missing,
       0 AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'description' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(description IS NULL OR TRIM(description) = '') AS missing,
       0 AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'claimed_amount' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(claimed_amount IS NULL OR TRIM(claimed_amount) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(claimed_amount), '') IS NOT NULL AND TRY_TO_DOUBLE(claimed_amount) IS NULL) AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'currency' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(currency IS NULL OR TRIM(currency) = '') AS missing,
       0 AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'priority' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(priority IS NULL OR TRIM(priority) = '') AS missing,
       0 AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'status' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(status IS NULL OR TRIM(status) = '') AS missing,
       0 AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'assigned_agent_id' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(assigned_agent_id IS NULL OR TRIM(assigned_agent_id) = '') AS missing,
       0 AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'assignment_date' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(assignment_date IS NULL OR TRIM(assignment_date) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(assignment_date), '') IS NOT NULL AND TRY_TO_TIMESTAMP(assignment_date) IS NULL) AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'first_response_date' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(first_response_date IS NULL OR TRIM(first_response_date) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(first_response_date), '') IS NOT NULL AND TRY_TO_TIMESTAMP(first_response_date) IS NULL) AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'resolution_date' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(resolution_date IS NULL OR TRIM(resolution_date) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(resolution_date), '') IS NOT NULL AND TRY_TO_TIMESTAMP(resolution_date) IS NULL) AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'closing_date' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(closing_date IS NULL OR TRIM(closing_date) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(closing_date), '') IS NOT NULL AND TRY_TO_TIMESTAMP(closing_date) IS NULL) AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'sla_breached' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(sla_breached IS NULL OR TRIM(sla_breached) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(sla_breached), '') IS NOT NULL AND TRY_TO_BOOLEAN(sla_breached) IS NULL) AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'resolution_days' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(resolution_days IS NULL OR TRIM(resolution_days) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(resolution_days), '') IS NOT NULL AND TRY_TO_DOUBLE(resolution_days) IS NULL) AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'resolution' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(resolution IS NULL OR TRIM(resolution) = '') AS missing,
       0 AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'compensation_granted' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(compensation_granted IS NULL OR TRIM(compensation_granted) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(compensation_granted), '') IS NOT NULL AND TRY_TO_DOUBLE(compensation_granted) IS NULL) AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'resolution_satisfaction' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(resolution_satisfaction IS NULL OR TRIM(resolution_satisfaction) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(resolution_satisfaction), '') IS NOT NULL AND TRY_TO_DOUBLE(resolution_satisfaction) IS NULL) AS bad_type
FROM complaints
UNION ALL
SELECT 'complaints' AS table_name, 'is_repeat_complainer' AS column_name, COUNT(*) AS row_count,
       COUNT_IF(is_repeat_complainer IS NULL OR TRIM(is_repeat_complainer) = '') AS missing,
       COUNT_IF(NULLIF(TRIM(is_repeat_complainer), '') IS NOT NULL AND TRY_TO_BOOLEAN(is_repeat_complainer) IS NULL) AS bad_type
FROM complaints
)
SELECT table_name, column_name, row_count, missing,
       ROUND(100 * missing / NULLIF(row_count, 0), 2) AS pct_missing, bad_type
FROM profile
ORDER BY table_name, pct_missing DESC, column_name;

-- P02 · Primary key duplicates: complete (every column equal) vs incomplete (same key, other values differ) (practice 2.2)
SELECT 'products' AS table_name,
       COUNT(*) AS keys_repeated,
       COUNT_IF(distinct_rows = 1) AS complete_duplicates,
       COUNT_IF(distinct_rows > 1) AS incomplete_duplicates
FROM (
    SELECT product_id, COUNT(*) AS n,
           COUNT(DISTINCT HASH(product_id, customer_id, product_type, product_number, currency, current_balance, credit_limit, interest_rate, opening_date, expiration_date, opening_branch_id, product_status, opening_channel, has_linked_app, days_past_due, last_transaction_date, last_updated)) AS distinct_rows
    FROM products GROUP BY product_id HAVING COUNT(*) > 1
)
UNION ALL
SELECT 'customers' AS table_name,
       COUNT(*) AS keys_repeated,
       COUNT_IF(distinct_rows = 1) AS complete_duplicates,
       COUNT_IF(distinct_rows > 1) AS incomplete_duplicates
FROM (
    SELECT customer_id, COUNT(*) AS n,
           COUNT(DISTINCT HASH(customer_id, document_number, document_type, first_name, last_name, date_of_birth, gender, email, mobile_phone, landline_phone, address, city, state, country, postal_code, detected_accent, segment, credit_score, estimated_monthly_income, occupation, marital_status, education_level, registration_date, registration_branch_id, customer_status, last_updated, accepts_marketing)) AS distinct_rows
    FROM customers GROUP BY customer_id HAVING COUNT(*) > 1
)
UNION ALL
SELECT 'transactions' AS table_name,
       COUNT(*) AS keys_repeated,
       COUNT_IF(distinct_rows = 1) AS complete_duplicates,
       COUNT_IF(distinct_rows > 1) AS incomplete_duplicates
FROM (
    SELECT transaction_id, COUNT(*) AS n,
           COUNT(DISTINCT HASH(transaction_id, transaction_date, process_date, product_id, customer_id, transaction_type, transaction_category, amount, currency, amount_usd, channel, branch_id, merchant_name, merchant_category, transaction_country, transaction_city, transaction_status, response_code, is_fraud, fraud_score, latitude, longitude)) AS distinct_rows
    FROM transactions GROUP BY transaction_id HAVING COUNT(*) > 1
)
UNION ALL
SELECT 'complaints' AS table_name,
       COUNT(*) AS keys_repeated,
       COUNT_IF(distinct_rows = 1) AS complete_duplicates,
       COUNT_IF(distinct_rows > 1) AS incomplete_duplicates
FROM (
    SELECT complaint_id, COUNT(*) AS n,
           COUNT(DISTINCT HASH(complaint_id, creation_date, process_date, customer_id, case_type, category, subcategory, reception_channel, affected_product_id, related_branch_id, origin_interaction_id, description, claimed_amount, currency, priority, status, assigned_agent_id, assignment_date, first_response_date, resolution_date, closing_date, sla_breached, resolution_days, resolution, compensation_granted, resolution_satisfaction, is_repeat_complainer)) AS distinct_rows
    FROM complaints GROUP BY complaint_id HAVING COUNT(*) > 1
);

-- P03 · Category values against master lists (practice 2.3; country spelling from Gap 8)
SELECT 'products.product_type' AS field, product_type AS value, COUNT(*) AS n FROM products GROUP BY 2
UNION ALL SELECT 'products.product_status', product_status, COUNT(*) FROM products GROUP BY 2
UNION ALL SELECT 'products.currency', currency, COUNT(*) FROM products GROUP BY 2
UNION ALL SELECT 'customers.country', country, COUNT(*) FROM customers GROUP BY 2
UNION ALL SELECT 'customers.customer_status', customer_status, COUNT(*) FROM customers GROUP BY 2
UNION ALL SELECT 'customers.segment', segment, COUNT(*) FROM customers GROUP BY 2
UNION ALL SELECT 'transactions.transaction_country', transaction_country, COUNT(*) FROM transactions GROUP BY 2
UNION ALL SELECT 'transactions.currency', currency, COUNT(*) FROM transactions GROUP BY 2
UNION ALL SELECT 'transactions.transaction_type', transaction_type, COUNT(*) FROM transactions GROUP BY 2
UNION ALL SELECT 'transactions.transaction_status', transaction_status, COUNT(*) FROM transactions GROUP BY 2
UNION ALL SELECT 'transactions.channel', channel, COUNT(*) FROM transactions GROUP BY 2
UNION ALL SELECT 'complaints.subcategory', subcategory, COUNT(*) FROM complaints GROUP BY 2
UNION ALL SELECT 'complaints.status', status, COUNT(*) FROM complaints GROUP BY 2
UNION ALL SELECT 'daily_exchange_rates.pair', source_currency || '->' || target_currency, COUNT(*) FROM daily_exchange_rates GROUP BY 2
ORDER BY 1, 3 DESC;

-- P04 · Ranges and sentinel values (practices 2.1 and 3.2)
SELECT 'transactions.transaction_date' AS field,
       MIN(TRY_TO_TIMESTAMP(transaction_date))::VARCHAR AS min_value, MAX(TRY_TO_TIMESTAMP(transaction_date))::VARCHAR AS max_value,
       NULL AS negatives, NULL AS sentinels FROM transactions
UNION ALL SELECT 'transactions.amount', MIN(TRY_TO_DOUBLE(amount))::VARCHAR, MAX(TRY_TO_DOUBLE(amount))::VARCHAR,
       COUNT_IF(TRY_TO_DOUBLE(amount) < 0), COUNT_IF(TRY_TO_DOUBLE(amount) IN (0, -1, 999, 9999, 99999)) FROM transactions
UNION ALL SELECT 'transactions.fraud_score', MIN(TRY_TO_DOUBLE(fraud_score))::VARCHAR, MAX(TRY_TO_DOUBLE(fraud_score))::VARCHAR,
       COUNT_IF(TRY_TO_DOUBLE(fraud_score) < 0), COUNT_IF(TRY_TO_DOUBLE(fraud_score) IN (-1, 999)) FROM transactions
UNION ALL SELECT 'products.current_balance', MIN(TRY_TO_DOUBLE(current_balance))::VARCHAR, MAX(TRY_TO_DOUBLE(current_balance))::VARCHAR,
       COUNT_IF(TRY_TO_DOUBLE(current_balance) < 0), COUNT_IF(TRY_TO_DOUBLE(current_balance) IN (-1, 999, 9999)) FROM products
UNION ALL SELECT 'products.credit_limit', MIN(TRY_TO_DOUBLE(credit_limit))::VARCHAR, MAX(TRY_TO_DOUBLE(credit_limit))::VARCHAR,
       COUNT_IF(TRY_TO_DOUBLE(credit_limit) < 0), COUNT_IF(TRY_TO_DOUBLE(credit_limit) IN (-1, 999, 9999)) FROM products
UNION ALL SELECT 'customers.date_of_birth', MIN(TRY_TO_DATE(date_of_birth))::VARCHAR, MAX(TRY_TO_DATE(date_of_birth))::VARCHAR,
       NULL, COUNT_IF(TRY_TO_DATE(date_of_birth) > CURRENT_DATE()) FROM customers
UNION ALL SELECT 'daily_exchange_rates.date', MIN(TRY_TO_DATE(date))::VARCHAR, MAX(TRY_TO_DATE(date))::VARCHAR,
       NULL, NULL FROM daily_exchange_rates
UNION ALL SELECT 'daily_exchange_rates.exchange_rate', MIN(TRY_TO_DOUBLE(exchange_rate))::VARCHAR, MAX(TRY_TO_DOUBLE(exchange_rate))::VARCHAR,
       COUNT_IF(TRY_TO_DOUBLE(exchange_rate) <= 0), NULL FROM daily_exchange_rates;

-- P05 · Referential integrity: join keys must match across tables (practice 1.3)
SELECT 'transactions.product_id not in products' AS check_name, COUNT(*) AS rows_failing
FROM transactions t LEFT JOIN products p ON t.product_id = p.product_id
WHERE NULLIF(TRIM(t.product_id), '') IS NOT NULL AND p.product_id IS NULL
UNION ALL
SELECT 'transactions: product belongs to another customer', COUNT(*)
FROM transactions t JOIN products p ON t.product_id = p.product_id
WHERE t.customer_id <> p.customer_id
UNION ALL
SELECT 'products.customer_id not in customers', COUNT(*)
FROM products p LEFT JOIN customers c ON p.customer_id = c.customer_id WHERE c.customer_id IS NULL
UNION ALL
SELECT 'complaints.customer_id not in customers', COUNT(*)
FROM complaints q LEFT JOIN customers c ON q.customer_id = c.customer_id WHERE c.customer_id IS NULL
UNION ALL
SELECT 'complaints.affected_product_id empty', COUNT(*)
FROM complaints WHERE NULLIF(TRIM(affected_product_id), '') IS NULL
UNION ALL
SELECT 'complaints.affected_product_id orphan (not in products)', COUNT(*)
FROM complaints q LEFT JOIN products p ON q.affected_product_id = p.product_id
WHERE NULLIF(TRIM(q.affected_product_id), '') IS NOT NULL AND p.product_id IS NULL;

-- P06 · Cross-field checks (practice 3.1)
SELECT 'products: expiration_date before opening_date' AS check_name, COUNT(*) AS rows_failing
FROM products WHERE TRY_TO_DATE(expiration_date) < TRY_TO_DATE(opening_date)
UNION ALL
SELECT 'complaints: resolution_date before creation_date', COUNT(*)
FROM complaints WHERE TRY_TO_TIMESTAMP(resolution_date) < TRY_TO_TIMESTAMP(creation_date)
UNION ALL
SELECT 'transactions: is_fraud true with fraud_score < 30', COUNT(*)
FROM transactions WHERE TRY_TO_BOOLEAN(is_fraud) AND TRY_TO_DOUBLE(fraud_score) < 30
UNION ALL
SELECT 'transactions: currency USD but amount <> amount_usd', COUNT(*)
FROM transactions WHERE currency = 'USD' AND TRY_TO_DOUBLE(amount) <> TRY_TO_DOUBLE(amount_usd);

-- P07 · How amount_usd relates to amount, per currency (sets the direction of the exchange-rate rule)
SELECT currency,
       COUNT(*) AS rows_with_both,
       MEDIAN(TRY_TO_DOUBLE(amount_usd) / NULLIF(TRY_TO_DOUBLE(amount), 0)) AS median_usd_per_unit,
       MIN(TRY_TO_DOUBLE(amount_usd) / NULLIF(TRY_TO_DOUBLE(amount), 0)) AS min_usd_per_unit,
       MAX(TRY_TO_DOUBLE(amount_usd) / NULLIF(TRY_TO_DOUBLE(amount), 0)) AS max_usd_per_unit
FROM transactions
WHERE TRY_TO_DOUBLE(amount_usd) IS NOT NULL AND TRY_TO_DOUBLE(amount) IS NOT NULL
GROUP BY 1 ORDER BY 1;

SELECT source_currency, target_currency, COUNT(*) AS days,
       MIN(TRY_TO_DATE(date)) AS first_day, MAX(TRY_TO_DATE(date)) AS last_day,
       MEDIAN(TRY_TO_DOUBLE(exchange_rate)) AS median_rate,
       COUNT(*) - COUNT(DISTINCT date) AS repeated_days
FROM daily_exchange_rates
GROUP BY 1, 2 ORDER BY 1, 2;

-- P08 · Subset sizing for the agent database (decision: which customers and how many months)
WITH cards AS (
    SELECT product_id, customer_id FROM products WHERE product_type ILIKE 'Tarjeta%'
)
SELECT 'customers with at least one card' AS measure, COUNT(DISTINCT customer_id) AS value FROM cards
UNION ALL SELECT 'cards', COUNT(*) FROM cards
UNION ALL SELECT 'card transactions, all months', COUNT(*) FROM transactions t JOIN cards c ON t.product_id = c.product_id
UNION ALL SELECT 'card transactions, last 6 months', COUNT(*) FROM transactions t JOIN cards c ON t.product_id = c.product_id
          WHERE TRY_TO_TIMESTAMP(t.transaction_date) >= DATEADD(month, -6, (SELECT MAX(TRY_TO_TIMESTAMP(transaction_date)) FROM transactions))
UNION ALL SELECT 'card transactions, last 12 months', COUNT(*) FROM transactions t JOIN cards c ON t.product_id = c.product_id
          WHERE TRY_TO_TIMESTAMP(t.transaction_date) >= DATEADD(month, -12, (SELECT MAX(TRY_TO_TIMESTAMP(transaction_date)) FROM transactions))
UNION ALL SELECT 'complaints of card customers', COUNT(*) FROM complaints q WHERE q.customer_id IN (SELECT customer_id FROM cards)
UNION ALL SELECT 'unrecognized-charge complaints of card customers', COUNT(*) FROM complaints q
          WHERE q.subcategory = 'Cargo no reconocido' AND q.customer_id IN (SELECT customer_id FROM cards);

-- P09 · Missing values that may be missing by design (practice 3.2: tell a real gap from a structural one)
-- Card transactions: does every purchase carry merchant, score and city? (needed for the dispute handoff)
SELECT p.product_type, t.transaction_type, t.channel, COUNT(*) AS n,
       ROUND(100 * COUNT_IF(NULLIF(TRIM(t.merchant_name), '') IS NULL) / COUNT(*), 1) AS pct_no_merchant,
       ROUND(100 * COUNT_IF(NULLIF(TRIM(t.fraud_score), '') IS NULL) / COUNT(*), 1) AS pct_no_fraud_score,
       ROUND(100 * COUNT_IF(NULLIF(TRIM(t.transaction_city), '') IS NULL) / COUNT(*), 1) AS pct_no_city,
       ROUND(100 * COUNT_IF(NULLIF(TRIM(t.amount_usd), '') IS NULL) / COUNT(*), 1) AS pct_no_amount_usd
FROM transactions t JOIN products p ON t.product_id = p.product_id
WHERE p.product_type ILIKE 'Tarjeta%'
GROUP BY 1, 2, 3
ORDER BY 1, 4 DESC;

-- P10 · Product fields by product type (credit_limit, expiration_date, days_past_due look structural)
SELECT product_type, COUNT(*) AS n,
       ROUND(100 * COUNT_IF(NULLIF(TRIM(credit_limit), '') IS NULL) / COUNT(*), 1) AS pct_no_credit_limit,
       ROUND(100 * COUNT_IF(NULLIF(TRIM(expiration_date), '') IS NULL) / COUNT(*), 1) AS pct_no_expiration,
       ROUND(100 * COUNT_IF(NULLIF(TRIM(days_past_due), '') IS NULL) / COUNT(*), 1) AS pct_no_days_past_due,
       ROUND(100 * COUNT_IF(NULLIF(TRIM(interest_rate), '') IS NULL) / COUNT(*), 1) AS pct_no_interest_rate,
       ROUND(100 * COUNT_IF(NULLIF(TRIM(last_transaction_date), '') IS NULL) / COUNT(*), 1) AS pct_no_last_transaction
FROM products
GROUP BY 1
ORDER BY 2 DESC;

-- P11 · amount_usd missing by currency (is the 57% a real gap or just USD rows?)
SELECT currency, COUNT(*) AS n,
       COUNT_IF(NULLIF(TRIM(amount_usd), '') IS NULL) AS missing_amount_usd,
       ROUND(100 * COUNT_IF(NULLIF(TRIM(amount_usd), '') IS NULL) / COUNT(*), 2) AS pct_missing
FROM transactions
GROUP BY 1
ORDER BY 2 DESC;

-- P12 · Candidate sentinel values in transactions.amount
SELECT amount, currency, transaction_type, COUNT(*) AS n
FROM transactions
WHERE TRY_TO_DOUBLE(amount) IN (0, -1, 999, 9999, 99999)
GROUP BY 1, 2, 3
ORDER BY 4 DESC;

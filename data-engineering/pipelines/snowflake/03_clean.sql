-- Stage 1 · 03: typed, validated tables in CLEAN; rejected rows in QUARANTINE
-- Each table goes through three steps:
--   typed_<table>       safe casts from LANDING text (TRY_ functions) plus the list of columns that failed to cast
--   checked_<table>     one reject reason per row (hard rules) and a list of data quality flags (soft rules)
--   CLEAN / QUARANTINE  rows without a reject reason / rows with one, the reason kept for audit
-- Hard rules break the row (no id, unknown key, impossible value): the row is quarantined.
-- Soft rules mark a gap the agent must handle (e.g. no merchant on a purchase): the row stays, flagged in dq_flags.
-- Missing values are never filled with zero (course practice 3.2). The only derived value is amount_usd,
-- recomputed with the rate implied by the source itself, and every row records how it was obtained (amount_usd_method).
-- Source of each rule: docs/profile_core.md (profile run 2026-09-28) and course practices 2.1-3.2.

USE DATABASE DATATHON_DB;
USE SCHEMA CLEAN;

-- customers:
CREATE OR REPLACE TEMPORARY TABLE typed_customers AS
SELECT
    NULLIF(TRIM(l.customer_id), '') AS customer_id,
    NULLIF(TRIM(l.document_number), '') AS document_number,
    NULLIF(TRIM(l.document_type), '') AS document_type,
    NULLIF(TRIM(l.first_name), '') AS first_name,
    NULLIF(TRIM(l.last_name), '') AS last_name,
    TRY_TO_DATE(l.date_of_birth) AS date_of_birth,
    NULLIF(TRIM(l.gender), '') AS gender,
    NULLIF(TRIM(l.email), '') AS email,
    NULLIF(TRIM(l.mobile_phone), '') AS mobile_phone,
    NULLIF(TRIM(l.landline_phone), '') AS landline_phone,
    NULLIF(TRIM(l.address), '') AS address,
    NULLIF(TRIM(l.city), '') AS city,
    NULLIF(TRIM(l.state), '') AS state,
    NULLIF(TRIM(l.country), '') AS country,
    NULLIF(TRIM(l.postal_code), '') AS postal_code,
    NULLIF(TRIM(l.detected_accent), '') AS detected_accent,
    NULLIF(TRIM(l.segment), '') AS segment,
    TRY_TO_DOUBLE(l.credit_score) AS credit_score,
    TRY_TO_NUMBER(l.estimated_monthly_income, 18, 2) AS estimated_monthly_income,
    NULLIF(TRIM(l.occupation), '') AS occupation,
    NULLIF(TRIM(l.marital_status), '') AS marital_status,
    NULLIF(TRIM(l.education_level), '') AS education_level,
    TRY_TO_DATE(l.registration_date) AS registration_date,
    NULLIF(TRIM(l.registration_branch_id), '') AS registration_branch_id,
    NULLIF(TRIM(l.customer_status), '') AS customer_status,
    TRY_TO_TIMESTAMP_NTZ(l.last_updated) AS last_updated,
    TRY_TO_BOOLEAN(l.accepts_marketing) AS accepts_marketing,
    ARRAY_CONSTRUCT_COMPACT(
        IFF(NULLIF(TRIM(l.date_of_birth), '') IS NOT NULL AND TRY_TO_DATE(l.date_of_birth) IS NULL, 'date_of_birth', NULL),
        IFF(NULLIF(TRIM(l.credit_score), '') IS NOT NULL AND TRY_TO_DOUBLE(l.credit_score) IS NULL, 'credit_score', NULL),
        IFF(NULLIF(TRIM(l.estimated_monthly_income), '') IS NOT NULL AND TRY_TO_NUMBER(l.estimated_monthly_income, 18, 2) IS NULL, 'estimated_monthly_income', NULL),
        IFF(NULLIF(TRIM(l.registration_date), '') IS NOT NULL AND TRY_TO_DATE(l.registration_date) IS NULL, 'registration_date', NULL),
        IFF(NULLIF(TRIM(l.last_updated), '') IS NOT NULL AND TRY_TO_TIMESTAMP_NTZ(l.last_updated) IS NULL, 'last_updated', NULL),
        IFF(NULLIF(TRIM(l.accepts_marketing), '') IS NOT NULL AND TRY_TO_BOOLEAN(l.accepts_marketing) IS NULL, 'accepts_marketing', NULL)
    ) AS _cast_failures,
    l._source_file,
    l._source_row
FROM LANDING.customers l;

CREATE OR REPLACE TEMPORARY TABLE checked_customers AS
SELECT x.*,
    CASE
        WHEN x.customer_id IS NULL THEN 'missing_customer_id'
        WHEN COUNT(*) OVER (PARTITION BY x.customer_id) > 1 THEN 'duplicate_customer_id'
        WHEN ARRAY_SIZE(x._cast_failures) > 0 THEN 'type_cast_failure:' || ARRAY_TO_STRING(x._cast_failures, ',')
        WHEN x.country IS NULL OR x.country NOT IN ('México', 'Colombia', 'Argentina') THEN 'unknown_country'
        WHEN x.customer_status IS NULL OR x.customer_status NOT IN ('Active', 'Inactive', 'Suspended', 'Closed') THEN 'unknown_customer_status'
        WHEN x.date_of_birth > CURRENT_DATE() THEN 'date_of_birth_in_future'
    END AS _reject_reason,
    ARRAY_CONSTRUCT_COMPACT(
        IFF(x.date_of_birth IS NULL, 'missing_date_of_birth', NULL),
        IFF(x.email IS NULL AND x.mobile_phone IS NULL, 'no_contact_channel', NULL)
    ) AS dq_flags
FROM typed_customers x;

CREATE OR REPLACE TABLE CLEAN.customers AS
SELECT * EXCLUDE (_reject_reason, _cast_failures) FROM checked_customers WHERE _reject_reason IS NULL;

CREATE OR REPLACE TABLE QUARANTINE.customers AS
SELECT * FROM checked_customers WHERE _reject_reason IS NOT NULL;

-- daily_exchange_rates:
CREATE OR REPLACE TEMPORARY TABLE typed_daily_exchange_rates AS
SELECT
    TRY_TO_DATE(l.date) AS date,
    NULLIF(TRIM(l.source_currency), '') AS source_currency,
    NULLIF(TRIM(l.target_currency), '') AS target_currency,
    TRY_TO_DOUBLE(l.exchange_rate) AS exchange_rate,
    TRY_TO_DOUBLE(l.buy_rate) AS buy_rate,
    TRY_TO_DOUBLE(l.sell_rate) AS sell_rate,
    NULLIF(TRIM(l.source), '') AS source,
    ARRAY_CONSTRUCT_COMPACT(
        IFF(NULLIF(TRIM(l.date), '') IS NOT NULL AND TRY_TO_DATE(l.date) IS NULL, 'date', NULL),
        IFF(NULLIF(TRIM(l.exchange_rate), '') IS NOT NULL AND TRY_TO_DOUBLE(l.exchange_rate) IS NULL, 'exchange_rate', NULL),
        IFF(NULLIF(TRIM(l.buy_rate), '') IS NOT NULL AND TRY_TO_DOUBLE(l.buy_rate) IS NULL, 'buy_rate', NULL),
        IFF(NULLIF(TRIM(l.sell_rate), '') IS NOT NULL AND TRY_TO_DOUBLE(l.sell_rate) IS NULL, 'sell_rate', NULL)
    ) AS _cast_failures,
    l._source_file,
    l._source_row
FROM LANDING.daily_exchange_rates l;

CREATE OR REPLACE TEMPORARY TABLE checked_daily_exchange_rates AS
SELECT x.*,
    CASE
        WHEN x.date IS NULL OR x.source_currency IS NULL OR x.target_currency IS NULL THEN 'missing_key'
        WHEN COUNT(*) OVER (PARTITION BY x.date, x.source_currency, x.target_currency) > 1 THEN 'duplicate_rate'
        WHEN ARRAY_SIZE(x._cast_failures) > 0 THEN 'type_cast_failure:' || ARRAY_TO_STRING(x._cast_failures, ',')
        WHEN x.exchange_rate IS NULL OR x.exchange_rate <= 0 THEN 'non_positive_rate'
    END AS _reject_reason,
    ARRAY_CONSTRUCT() AS dq_flags
FROM typed_daily_exchange_rates x;

CREATE OR REPLACE TABLE CLEAN.daily_exchange_rates AS
SELECT * EXCLUDE (_reject_reason, _cast_failures) FROM checked_daily_exchange_rates WHERE _reject_reason IS NULL;

CREATE OR REPLACE TABLE QUARANTINE.daily_exchange_rates AS
SELECT * FROM checked_daily_exchange_rates WHERE _reject_reason IS NOT NULL;

-- products:
CREATE OR REPLACE TEMPORARY TABLE typed_products AS
SELECT
    NULLIF(TRIM(l.product_id), '') AS product_id,
    NULLIF(TRIM(l.customer_id), '') AS customer_id,
    NULLIF(TRIM(l.product_type), '') AS product_type,
    NULLIF(TRIM(l.product_number), '') AS product_number,
    NULLIF(TRIM(l.currency), '') AS currency,
    TRY_TO_NUMBER(l.current_balance, 18, 2) AS current_balance,
    TRY_TO_NUMBER(l.credit_limit, 18, 2) AS credit_limit,
    TRY_TO_DOUBLE(l.interest_rate) AS interest_rate,
    TRY_TO_DATE(l.opening_date) AS opening_date,
    TRY_TO_DATE(l.expiration_date) AS expiration_date,
    NULLIF(TRIM(l.opening_branch_id), '') AS opening_branch_id,
    NULLIF(TRIM(l.product_status), '') AS product_status,
    NULLIF(TRIM(l.opening_channel), '') AS opening_channel,
    TRY_TO_BOOLEAN(l.has_linked_app) AS has_linked_app,
    TRY_TO_DOUBLE(l.days_past_due) AS days_past_due,
    TRY_TO_TIMESTAMP_NTZ(l.last_transaction_date) AS last_transaction_date,
    TRY_TO_TIMESTAMP_NTZ(l.last_updated) AS last_updated,
    ARRAY_CONSTRUCT_COMPACT(
        IFF(NULLIF(TRIM(l.current_balance), '') IS NOT NULL AND TRY_TO_NUMBER(l.current_balance, 18, 2) IS NULL, 'current_balance', NULL),
        IFF(NULLIF(TRIM(l.credit_limit), '') IS NOT NULL AND TRY_TO_NUMBER(l.credit_limit, 18, 2) IS NULL, 'credit_limit', NULL),
        IFF(NULLIF(TRIM(l.interest_rate), '') IS NOT NULL AND TRY_TO_DOUBLE(l.interest_rate) IS NULL, 'interest_rate', NULL),
        IFF(NULLIF(TRIM(l.opening_date), '') IS NOT NULL AND TRY_TO_DATE(l.opening_date) IS NULL, 'opening_date', NULL),
        IFF(NULLIF(TRIM(l.expiration_date), '') IS NOT NULL AND TRY_TO_DATE(l.expiration_date) IS NULL, 'expiration_date', NULL),
        IFF(NULLIF(TRIM(l.has_linked_app), '') IS NOT NULL AND TRY_TO_BOOLEAN(l.has_linked_app) IS NULL, 'has_linked_app', NULL),
        IFF(NULLIF(TRIM(l.days_past_due), '') IS NOT NULL AND TRY_TO_DOUBLE(l.days_past_due) IS NULL, 'days_past_due', NULL),
        IFF(NULLIF(TRIM(l.last_transaction_date), '') IS NOT NULL AND TRY_TO_TIMESTAMP_NTZ(l.last_transaction_date) IS NULL, 'last_transaction_date', NULL),
        IFF(NULLIF(TRIM(l.last_updated), '') IS NOT NULL AND TRY_TO_TIMESTAMP_NTZ(l.last_updated) IS NULL, 'last_updated', NULL)
    ) AS _cast_failures,
    l._source_file,
    l._source_row
FROM LANDING.products l;

CREATE OR REPLACE TEMPORARY TABLE checked_products AS
SELECT x.*,
    CASE x.product_type
        WHEN 'Tarjeta Crédito' THEN 'credit_card'
        WHEN 'Tarjeta Débito' THEN 'debit_card'
        WHEN 'Cuenta Ahorro' THEN 'savings_account'
        WHEN 'Cuenta Corriente' THEN 'checking_account'
        WHEN 'Préstamo Personal' THEN 'personal_loan'
        WHEN 'Préstamo Hipotecario' THEN 'mortgage'
        WHEN 'Inversión' THEN 'investment'
        WHEN 'Seguro' THEN 'insurance'
    END AS product_category,
    -- Last 4 digits only: the agent identifies a card without ever seeing its full number (regex, course practice 2.3)
    IFF(x.product_type LIKE 'Tarjeta%', RIGHT(REGEXP_REPLACE(x.product_number, '\\D', ''), 4), NULL) AS card_last4,
    CASE
        WHEN x.product_id IS NULL THEN 'missing_product_id'
        WHEN COUNT(*) OVER (PARTITION BY x.product_id) > 1 THEN 'duplicate_product_id'
        WHEN ARRAY_SIZE(x._cast_failures) > 0 THEN 'type_cast_failure:' || ARRAY_TO_STRING(x._cast_failures, ',')
        WHEN c.customer_id IS NULL THEN 'unknown_customer'
        WHEN product_category IS NULL THEN 'unknown_product_type'
        WHEN x.product_status IS NULL OR x.product_status NOT IN ('Active', 'Closed', 'Blocked', 'Suspended') THEN 'unknown_product_status'
        WHEN x.currency IS NULL OR x.currency NOT IN ('USD', 'COP', 'ARS', 'MXN') THEN 'unknown_currency'
        WHEN x.expiration_date < x.opening_date THEN 'expiration_before_opening'
    END AS _reject_reason,
    -- Structural gaps (no credit limit on a savings account) are not flagged; only gaps where the field should exist
    ARRAY_CONSTRUCT_COMPACT(
        IFF(x.product_type LIKE 'Tarjeta%' AND x.expiration_date IS NULL, 'card_missing_expiration', NULL),
        IFF(x.product_type = 'Tarjeta Crédito' AND x.credit_limit IS NULL, 'credit_card_missing_limit', NULL),
        IFF(x.interest_rate IS NULL, 'missing_interest_rate', NULL),
        IFF(x.last_transaction_date IS NULL, 'missing_last_transaction_date', NULL)
    ) AS dq_flags
FROM typed_products x
LEFT JOIN CLEAN.customers c ON x.customer_id = c.customer_id;

CREATE OR REPLACE TABLE CLEAN.products AS
SELECT * EXCLUDE (_reject_reason, _cast_failures) FROM checked_products WHERE _reject_reason IS NULL;

CREATE OR REPLACE TABLE QUARANTINE.products AS
SELECT * FROM checked_products WHERE _reject_reason IS NOT NULL;

-- transactions:
CREATE OR REPLACE TEMPORARY TABLE typed_transactions AS
SELECT
    NULLIF(TRIM(l.transaction_id), '') AS transaction_id,
    TRY_TO_TIMESTAMP_NTZ(l.transaction_date) AS transaction_date,
    TRY_TO_DATE(l.process_date) AS process_date,
    NULLIF(TRIM(l.product_id), '') AS product_id,
    NULLIF(TRIM(l.customer_id), '') AS customer_id,
    NULLIF(TRIM(l.transaction_type), '') AS transaction_type,
    NULLIF(TRIM(l.transaction_category), '') AS transaction_category,
    TRY_TO_NUMBER(l.amount, 18, 2) AS amount,
    NULLIF(TRIM(l.currency), '') AS currency,
    TRY_TO_NUMBER(l.amount_usd, 18, 2) AS amount_usd_source,
    NULLIF(TRIM(l.channel), '') AS channel,
    NULLIF(TRIM(l.branch_id), '') AS branch_id,
    NULLIF(TRIM(l.merchant_name), '') AS merchant_name,
    NULLIF(TRIM(l.merchant_category), '') AS merchant_category,
    NULLIF(TRIM(l.transaction_country), '') AS transaction_country_raw,
    NULLIF(TRIM(l.transaction_city), '') AS transaction_city,
    NULLIF(TRIM(l.transaction_status), '') AS transaction_status,
    NULLIF(TRIM(l.response_code), '') AS response_code,
    TRY_TO_BOOLEAN(l.is_fraud) AS is_fraud,
    TRY_TO_DOUBLE(l.fraud_score) AS fraud_score,
    TRY_TO_DOUBLE(l.latitude) AS latitude,
    TRY_TO_DOUBLE(l.longitude) AS longitude,
    ARRAY_CONSTRUCT_COMPACT(
        IFF(NULLIF(TRIM(l.transaction_date), '') IS NOT NULL AND TRY_TO_TIMESTAMP_NTZ(l.transaction_date) IS NULL, 'transaction_date', NULL),
        IFF(NULLIF(TRIM(l.process_date), '') IS NOT NULL AND TRY_TO_DATE(l.process_date) IS NULL, 'process_date', NULL),
        IFF(NULLIF(TRIM(l.amount), '') IS NOT NULL AND TRY_TO_NUMBER(l.amount, 18, 2) IS NULL, 'amount', NULL),
        IFF(NULLIF(TRIM(l.amount_usd), '') IS NOT NULL AND TRY_TO_NUMBER(l.amount_usd, 18, 2) IS NULL, 'amount_usd', NULL),
        IFF(NULLIF(TRIM(l.is_fraud), '') IS NOT NULL AND TRY_TO_BOOLEAN(l.is_fraud) IS NULL, 'is_fraud', NULL),
        IFF(NULLIF(TRIM(l.fraud_score), '') IS NOT NULL AND TRY_TO_DOUBLE(l.fraud_score) IS NULL, 'fraud_score', NULL),
        IFF(NULLIF(TRIM(l.latitude), '') IS NOT NULL AND TRY_TO_DOUBLE(l.latitude) IS NULL, 'latitude', NULL),
        IFF(NULLIF(TRIM(l.longitude), '') IS NOT NULL AND TRY_TO_DOUBLE(l.longitude) IS NULL, 'longitude', NULL)
    ) AS _cast_failures,
    l._source_file,
    l._source_row
FROM LANDING.transactions l;

-- amount_usd: the source converts COP and ARS with one fixed rate per currency (the ratio amount_usd / amount
-- varies less than 0.2%), not with the daily rate table, which fluctuates around it (profile run 2026-09-28).
-- To stay consistent with 95% of the column, missing values use that same implied rate. The daily rate is kept
-- beside it (usd_rate_daily) for reference. USD rows: amount_usd = amount.
CREATE OR REPLACE TEMPORARY TABLE implied_usd_rates AS
SELECT currency, MEDIAN(amount_usd_source / amount) AS source_usd_rate, COUNT(*) AS rows_used
FROM typed_transactions
WHERE amount_usd_source IS NOT NULL AND amount > 0
GROUP BY currency;

CREATE OR REPLACE TEMPORARY TABLE usd_transactions AS
SELECT y.*,
    i.source_usd_rate,
    CASE
        WHEN y.amount_usd_source IS NOT NULL THEN y.amount_usd_source
        WHEN y.currency = 'USD' THEN y.amount
        ELSE ROUND(y.amount * i.source_usd_rate, 2)
    END AS amount_usd,
    CASE
        WHEN y.amount_usd_source IS NOT NULL THEN 'source'
        WHEN y.currency = 'USD' THEN 'usd_identity'
        WHEN i.source_usd_rate IS NOT NULL THEN 'recomputed_source_rate'
    END AS amount_usd_method
FROM (
    SELECT x.*, r.exchange_rate AS usd_rate_daily
    FROM typed_transactions x
    ASOF JOIN (
        SELECT date::TIMESTAMP_NTZ AS rate_time, source_currency, exchange_rate
        FROM CLEAN.daily_exchange_rates
        WHERE target_currency = 'USD'
    ) r
        MATCH_CONDITION (x.transaction_date >= r.rate_time)
        ON x.currency = r.source_currency
) y
LEFT JOIN implied_usd_rates i ON y.currency = i.currency;

CREATE OR REPLACE TEMPORARY TABLE checked_transactions AS
SELECT x.*,
    -- "Mexico" appears only among the foreign-country values (Gap 8); normalized to the spelling used everywhere else
    IFF(x.transaction_country_raw = 'Mexico', 'México', x.transaction_country_raw) AS transaction_country,
    CASE
        WHEN x.transaction_id IS NULL THEN 'missing_transaction_id'
        WHEN COUNT(*) OVER (PARTITION BY x.transaction_id) > 1 THEN 'duplicate_transaction_id'
        WHEN ARRAY_SIZE(x._cast_failures) > 0 THEN 'type_cast_failure:' || ARRAY_TO_STRING(x._cast_failures, ',')
        WHEN x.transaction_date IS NULL THEN 'missing_transaction_date'
        WHEN x.amount IS NULL THEN 'missing_amount'
        WHEN x.amount <= 0 THEN 'non_positive_amount'
        WHEN x.currency IS NULL OR x.currency NOT IN ('USD', 'COP', 'ARS', 'MXN') THEN 'unknown_currency'
        WHEN p.product_id IS NULL THEN 'unknown_product'
        WHEN p.customer_id <> x.customer_id THEN 'product_of_other_customer'
    END AS _reject_reason,
    ARRAY_CONSTRUCT_COMPACT(
        IFF(x.transaction_type = 'Purchase' AND x.merchant_name IS NULL, 'purchase_without_merchant', NULL),
        IFF(x.transaction_type = 'Purchase' AND x.channel = 'ATM', 'purchase_on_atm_channel', NULL),
        IFF(x.fraud_score IS NULL, 'missing_fraud_score', NULL),
        IFF(x.is_fraud AND x.fraud_score < 30, 'fraud_label_below_score_cutoff', NULL),
        IFF(x.transaction_city IS NULL, 'missing_city', NULL),
        IFF(x.amount_usd IS NULL, 'amount_usd_not_computable', NULL)
    ) AS dq_flags
FROM usd_transactions x
LEFT JOIN CLEAN.products p ON x.product_id = p.product_id;

CREATE OR REPLACE TABLE CLEAN.transactions AS
SELECT * EXCLUDE (_reject_reason, _cast_failures, transaction_country_raw) FROM checked_transactions WHERE _reject_reason IS NULL;

CREATE OR REPLACE TABLE QUARANTINE.transactions AS
SELECT * FROM checked_transactions WHERE _reject_reason IS NOT NULL;

-- complaints:
CREATE OR REPLACE TEMPORARY TABLE typed_complaints AS
SELECT
    NULLIF(TRIM(l.complaint_id), '') AS complaint_id,
    TRY_TO_TIMESTAMP_NTZ(l.creation_date) AS creation_date,
    TRY_TO_DATE(l.process_date) AS process_date,
    NULLIF(TRIM(l.customer_id), '') AS customer_id,
    NULLIF(TRIM(l.case_type), '') AS case_type,
    NULLIF(TRIM(l.category), '') AS category,
    NULLIF(TRIM(l.subcategory), '') AS subcategory,
    NULLIF(TRIM(l.reception_channel), '') AS reception_channel,
    NULLIF(TRIM(l.affected_product_id), '') AS affected_product_id,
    NULLIF(TRIM(l.related_branch_id), '') AS related_branch_id,
    NULLIF(TRIM(l.origin_interaction_id), '') AS origin_interaction_id,
    NULLIF(TRIM(l.description), '') AS description,
    TRY_TO_NUMBER(l.claimed_amount, 18, 2) AS claimed_amount,
    NULLIF(TRIM(l.currency), '') AS currency,
    NULLIF(TRIM(l.priority), '') AS priority,
    NULLIF(TRIM(l.status), '') AS status,
    NULLIF(TRIM(l.assigned_agent_id), '') AS assigned_agent_id,
    TRY_TO_TIMESTAMP_NTZ(l.assignment_date) AS assignment_date,
    TRY_TO_TIMESTAMP_NTZ(l.first_response_date) AS first_response_date,
    TRY_TO_TIMESTAMP_NTZ(l.resolution_date) AS resolution_date,
    TRY_TO_TIMESTAMP_NTZ(l.closing_date) AS closing_date,
    TRY_TO_BOOLEAN(l.sla_breached) AS sla_breached,
    TRY_TO_DOUBLE(l.resolution_days) AS resolution_days,
    NULLIF(TRIM(l.resolution), '') AS resolution,
    TRY_TO_NUMBER(l.compensation_granted, 18, 2) AS compensation_granted,
    TRY_TO_DOUBLE(l.resolution_satisfaction) AS resolution_satisfaction,
    TRY_TO_BOOLEAN(l.is_repeat_complainer) AS is_repeat_complainer,
    ARRAY_CONSTRUCT_COMPACT(
        IFF(NULLIF(TRIM(l.creation_date), '') IS NOT NULL AND TRY_TO_TIMESTAMP_NTZ(l.creation_date) IS NULL, 'creation_date', NULL),
        IFF(NULLIF(TRIM(l.process_date), '') IS NOT NULL AND TRY_TO_DATE(l.process_date) IS NULL, 'process_date', NULL),
        IFF(NULLIF(TRIM(l.claimed_amount), '') IS NOT NULL AND TRY_TO_NUMBER(l.claimed_amount, 18, 2) IS NULL, 'claimed_amount', NULL),
        IFF(NULLIF(TRIM(l.assignment_date), '') IS NOT NULL AND TRY_TO_TIMESTAMP_NTZ(l.assignment_date) IS NULL, 'assignment_date', NULL),
        IFF(NULLIF(TRIM(l.first_response_date), '') IS NOT NULL AND TRY_TO_TIMESTAMP_NTZ(l.first_response_date) IS NULL, 'first_response_date', NULL),
        IFF(NULLIF(TRIM(l.resolution_date), '') IS NOT NULL AND TRY_TO_TIMESTAMP_NTZ(l.resolution_date) IS NULL, 'resolution_date', NULL),
        IFF(NULLIF(TRIM(l.closing_date), '') IS NOT NULL AND TRY_TO_TIMESTAMP_NTZ(l.closing_date) IS NULL, 'closing_date', NULL),
        IFF(NULLIF(TRIM(l.sla_breached), '') IS NOT NULL AND TRY_TO_BOOLEAN(l.sla_breached) IS NULL, 'sla_breached', NULL),
        IFF(NULLIF(TRIM(l.resolution_days), '') IS NOT NULL AND TRY_TO_DOUBLE(l.resolution_days) IS NULL, 'resolution_days', NULL),
        IFF(NULLIF(TRIM(l.compensation_granted), '') IS NOT NULL AND TRY_TO_NUMBER(l.compensation_granted, 18, 2) IS NULL, 'compensation_granted', NULL),
        IFF(NULLIF(TRIM(l.resolution_satisfaction), '') IS NOT NULL AND TRY_TO_DOUBLE(l.resolution_satisfaction) IS NULL, 'resolution_satisfaction', NULL),
        IFF(NULLIF(TRIM(l.is_repeat_complainer), '') IS NOT NULL AND TRY_TO_BOOLEAN(l.is_repeat_complainer) IS NULL, 'is_repeat_complainer', NULL)
    ) AS _cast_failures,
    l._source_file,
    l._source_row
FROM LANDING.complaints l;

CREATE OR REPLACE TEMPORARY TABLE checked_complaints AS
SELECT x.*,
    CASE
        WHEN x.complaint_id IS NULL THEN 'missing_complaint_id'
        WHEN COUNT(*) OVER (PARTITION BY x.complaint_id) > 1 THEN 'duplicate_complaint_id'
        WHEN ARRAY_SIZE(x._cast_failures) > 0 THEN 'type_cast_failure:' || ARRAY_TO_STRING(x._cast_failures, ',')
        WHEN c.customer_id IS NULL THEN 'unknown_customer'
        WHEN x.affected_product_id IS NOT NULL AND p.product_id IS NULL THEN 'unknown_product'
        WHEN x.resolution_date < x.creation_date THEN 'resolution_before_creation'
        WHEN x.status IS NULL OR x.status NOT IN ('In Process', 'Open', 'Resolved', 'Escalated', 'Closed', 'Rejected') THEN 'unknown_status'
    END AS _reject_reason,
    ARRAY_CONSTRUCT_COMPACT(
        IFF(x.affected_product_id IS NULL, 'no_linked_product', NULL),
        IFF(p.customer_id <> x.customer_id, 'linked_product_of_other_customer', NULL),
        IFF(x.subcategory IS NULL, 'missing_subcategory', NULL)
    ) AS dq_flags
FROM typed_complaints x
LEFT JOIN CLEAN.customers c ON x.customer_id = c.customer_id
LEFT JOIN CLEAN.products p ON x.affected_product_id = p.product_id;

CREATE OR REPLACE TABLE CLEAN.complaints AS
SELECT * EXCLUDE (_reject_reason, _cast_failures) FROM checked_complaints WHERE _reject_reason IS NULL;

CREATE OR REPLACE TABLE QUARANTINE.complaints AS
SELECT * FROM checked_complaints WHERE _reject_reason IS NOT NULL;

-- Summary: rows kept and quarantined per table
SELECT 'customers' AS table_name, (SELECT COUNT(*) FROM CLEAN.customers) AS clean_rows, (SELECT COUNT(*) FROM QUARANTINE.customers) AS quarantined_rows
UNION ALL SELECT 'daily_exchange_rates', (SELECT COUNT(*) FROM CLEAN.daily_exchange_rates), (SELECT COUNT(*) FROM QUARANTINE.daily_exchange_rates)
UNION ALL SELECT 'products', (SELECT COUNT(*) FROM CLEAN.products), (SELECT COUNT(*) FROM QUARANTINE.products)
UNION ALL SELECT 'transactions', (SELECT COUNT(*) FROM CLEAN.transactions), (SELECT COUNT(*) FROM QUARANTINE.transactions)
UNION ALL SELECT 'complaints', (SELECT COUNT(*) FROM CLEAN.complaints), (SELECT COUNT(*) FROM QUARANTINE.complaints);

-- Summary: quarantine reasons
SELECT 'customers' AS table_name, _reject_reason, COUNT(*) AS n FROM QUARANTINE.customers GROUP BY 2
UNION ALL SELECT 'daily_exchange_rates', _reject_reason, COUNT(*) FROM QUARANTINE.daily_exchange_rates GROUP BY 2
UNION ALL SELECT 'products', _reject_reason, COUNT(*) FROM QUARANTINE.products GROUP BY 2
UNION ALL SELECT 'transactions', _reject_reason, COUNT(*) FROM QUARANTINE.transactions GROUP BY 2
UNION ALL SELECT 'complaints', _reject_reason, COUNT(*) FROM QUARANTINE.complaints GROUP BY 2
ORDER BY 1, 3 DESC;

-- Summary: data quality flags on clean rows
SELECT 'customers' AS table_name, f.value::STRING AS flag, COUNT(*) AS n FROM CLEAN.customers, LATERAL FLATTEN(dq_flags) f GROUP BY 2
UNION ALL SELECT 'products', f.value::STRING, COUNT(*) FROM CLEAN.products, LATERAL FLATTEN(dq_flags) f GROUP BY 2
UNION ALL SELECT 'transactions', f.value::STRING, COUNT(*) FROM CLEAN.transactions, LATERAL FLATTEN(dq_flags) f GROUP BY 2
UNION ALL SELECT 'complaints', f.value::STRING, COUNT(*) FROM CLEAN.complaints, LATERAL FLATTEN(dq_flags) f GROUP BY 2
ORDER BY 1, 3 DESC;

-- Summary: how amount_usd was obtained, and whether the rules reproduce the source values (course practice 3.1)
SELECT amount_usd_method, COUNT(*) AS n,
       COUNT_IF(amount_usd_source IS NOT NULL
                AND ABS(amount_usd_source - amount * source_usd_rate) > 0.01 * amount_usd_source) AS source_off_implied_rate_over_1pct,
       COUNT_IF(amount_usd_source IS NOT NULL AND usd_rate_daily IS NOT NULL
                AND ABS(amount_usd_source - amount * usd_rate_daily) > 0.01 * amount_usd_source) AS source_off_daily_rate_over_1pct
FROM CLEAN.transactions
GROUP BY 1
ORDER BY 2 DESC;

-- Summary: implied USD rate per currency vs the daily rate table
SELECT i.currency, i.source_usd_rate, i.rows_used,
       MIN(r.exchange_rate) AS daily_min, MEDIAN(r.exchange_rate) AS daily_median, MAX(r.exchange_rate) AS daily_max
FROM implied_usd_rates i
JOIN CLEAN.daily_exchange_rates r ON r.source_currency = i.currency AND r.target_currency = 'USD'
GROUP BY 1, 2, 3
ORDER BY 1;

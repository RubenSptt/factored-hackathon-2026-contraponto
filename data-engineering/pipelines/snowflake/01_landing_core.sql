-- Stage 1 · 01: land the five Card Support core tables as text
-- Why text: types are enforced later against the contracts, and a bad value becomes a quarantined row
-- instead of a failed or skipped load (course practice 1.1 adapted: we never use on_bad_lines='skip').
-- ON_ERROR = ABORT_STATEMENT: the only errors possible here are structural (wrong column count),
-- and those must stop the run. Q05 found 0 such errors in call_transcripts.
-- Rerunnable: CREATE OR REPLACE + COPY gives the same result every time (deterministic pipeline).
-- Single-file names (customers.csv, daily_exchange_rates.csv) are assumed; confirm with LIST @PUBLIC.DATATHON_STAGE;

USE DATABASE DATATHON_DB;
USE SCHEMA LANDING;

-- products: 17 columns
CREATE OR REPLACE TABLE products (
    product_id VARCHAR,
    customer_id VARCHAR,
    product_type VARCHAR,
    product_number VARCHAR,
    currency VARCHAR,
    current_balance VARCHAR,
    credit_limit VARCHAR,
    interest_rate VARCHAR,
    opening_date VARCHAR,
    expiration_date VARCHAR,
    opening_branch_id VARCHAR,
    product_status VARCHAR,
    opening_channel VARCHAR,
    has_linked_app VARCHAR,
    days_past_due VARCHAR,
    last_transaction_date VARCHAR,
    last_updated VARCHAR,
    _source_file VARCHAR,
    _source_row  NUMBER,
    _loaded_at   TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

COPY INTO products (product_id, customer_id, product_type, product_number, currency, current_balance, credit_limit, interest_rate, opening_date, expiration_date, opening_branch_id, product_status, opening_channel, has_linked_app, days_past_due, last_transaction_date, last_updated, _source_file, _source_row)
FROM (
    SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
           METADATA$FILENAME, METADATA$FILE_ROW_NUMBER
    FROM @PUBLIC.DATATHON_STAGE/products.csv
)
FILE_FORMAT = (FORMAT_NAME = PUBLIC.datathon_csv)
ON_ERROR = ABORT_STATEMENT;

-- customers: 27 columns
CREATE OR REPLACE TABLE customers (
    customer_id VARCHAR,
    document_number VARCHAR,
    document_type VARCHAR,
    first_name VARCHAR,
    last_name VARCHAR,
    date_of_birth VARCHAR,
    gender VARCHAR,
    email VARCHAR,
    mobile_phone VARCHAR,
    landline_phone VARCHAR,
    address VARCHAR,
    city VARCHAR,
    state VARCHAR,
    country VARCHAR,
    postal_code VARCHAR,
    detected_accent VARCHAR,
    segment VARCHAR,
    credit_score VARCHAR,
    estimated_monthly_income VARCHAR,
    occupation VARCHAR,
    marital_status VARCHAR,
    education_level VARCHAR,
    registration_date VARCHAR,
    registration_branch_id VARCHAR,
    customer_status VARCHAR,
    last_updated VARCHAR,
    accepts_marketing VARCHAR,
    _source_file VARCHAR,
    _source_row  NUMBER,
    _loaded_at   TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

COPY INTO customers (customer_id, document_number, document_type, first_name, last_name, date_of_birth, gender, email, mobile_phone, landline_phone, address, city, state, country, postal_code, detected_accent, segment, credit_score, estimated_monthly_income, occupation, marital_status, education_level, registration_date, registration_branch_id, customer_status, last_updated, accepts_marketing, _source_file, _source_row)
FROM (
    SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
           METADATA$FILENAME, METADATA$FILE_ROW_NUMBER
    FROM @PUBLIC.DATATHON_STAGE/customers.csv
)
FILE_FORMAT = (FORMAT_NAME = PUBLIC.datathon_csv)
ON_ERROR = ABORT_STATEMENT;

-- daily_exchange_rates: 7 columns
CREATE OR REPLACE TABLE daily_exchange_rates (
    date VARCHAR,
    source_currency VARCHAR,
    target_currency VARCHAR,
    exchange_rate VARCHAR,
    buy_rate VARCHAR,
    sell_rate VARCHAR,
    source VARCHAR,
    _source_file VARCHAR,
    _source_row  NUMBER,
    _loaded_at   TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

COPY INTO daily_exchange_rates (date, source_currency, target_currency, exchange_rate, buy_rate, sell_rate, source, _source_file, _source_row)
FROM (
    SELECT $1, $2, $3, $4, $5, $6, $7,
           METADATA$FILENAME, METADATA$FILE_ROW_NUMBER
    FROM @PUBLIC.DATATHON_STAGE/daily_exchange_rates.csv
)
FILE_FORMAT = (FORMAT_NAME = PUBLIC.datathon_csv)
ON_ERROR = ABORT_STATEMENT;

-- transactions: 22 columns · one file per day
CREATE OR REPLACE TABLE transactions (
    transaction_id VARCHAR,
    transaction_date VARCHAR,
    process_date VARCHAR,
    product_id VARCHAR,
    customer_id VARCHAR,
    transaction_type VARCHAR,
    transaction_category VARCHAR,
    amount VARCHAR,
    currency VARCHAR,
    amount_usd VARCHAR,
    channel VARCHAR,
    branch_id VARCHAR,
    merchant_name VARCHAR,
    merchant_category VARCHAR,
    transaction_country VARCHAR,
    transaction_city VARCHAR,
    transaction_status VARCHAR,
    response_code VARCHAR,
    is_fraud VARCHAR,
    fraud_score VARCHAR,
    latitude VARCHAR,
    longitude VARCHAR,
    _source_file VARCHAR,
    _source_row  NUMBER,
    _loaded_at   TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

COPY INTO transactions (transaction_id, transaction_date, process_date, product_id, customer_id, transaction_type, transaction_category, amount, currency, amount_usd, channel, branch_id, merchant_name, merchant_category, transaction_country, transaction_city, transaction_status, response_code, is_fraud, fraud_score, latitude, longitude, _source_file, _source_row)
FROM (
    SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
           METADATA$FILENAME, METADATA$FILE_ROW_NUMBER
    FROM @PUBLIC.DATATHON_STAGE/transactions/
)
FILE_FORMAT = (FORMAT_NAME = PUBLIC.datathon_csv)
PATTERN = '.*[.]csv'
ON_ERROR = ABORT_STATEMENT;

-- complaints: 27 columns · one file per day
CREATE OR REPLACE TABLE complaints (
    complaint_id VARCHAR,
    creation_date VARCHAR,
    process_date VARCHAR,
    customer_id VARCHAR,
    case_type VARCHAR,
    category VARCHAR,
    subcategory VARCHAR,
    reception_channel VARCHAR,
    affected_product_id VARCHAR,
    related_branch_id VARCHAR,
    origin_interaction_id VARCHAR,
    description VARCHAR,
    claimed_amount VARCHAR,
    currency VARCHAR,
    priority VARCHAR,
    status VARCHAR,
    assigned_agent_id VARCHAR,
    assignment_date VARCHAR,
    first_response_date VARCHAR,
    resolution_date VARCHAR,
    closing_date VARCHAR,
    sla_breached VARCHAR,
    resolution_days VARCHAR,
    resolution VARCHAR,
    compensation_granted VARCHAR,
    resolution_satisfaction VARCHAR,
    is_repeat_complainer VARCHAR,
    _source_file VARCHAR,
    _source_row  NUMBER,
    _loaded_at   TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

COPY INTO complaints (complaint_id, creation_date, process_date, customer_id, case_type, category, subcategory, reception_channel, affected_product_id, related_branch_id, origin_interaction_id, description, claimed_amount, currency, priority, status, assigned_agent_id, assignment_date, first_response_date, resolution_date, closing_date, sla_breached, resolution_days, resolution, compensation_granted, resolution_satisfaction, is_repeat_complainer, _source_file, _source_row)
FROM (
    SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
           METADATA$FILENAME, METADATA$FILE_ROW_NUMBER
    FROM @PUBLIC.DATATHON_STAGE/complaints/
)
FILE_FORMAT = (FORMAT_NAME = PUBLIC.datathon_csv)
PATTERN = '.*[.]csv'
ON_ERROR = ABORT_STATEMENT;

-- Load check: rows and files per table
SELECT 'products' AS table_name, COUNT(*) AS row_count, COUNT(DISTINCT _source_file) AS files FROM products
UNION ALL SELECT 'customers', COUNT(*), COUNT(DISTINCT _source_file) FROM customers
UNION ALL SELECT 'daily_exchange_rates', COUNT(*), COUNT(DISTINCT _source_file) FROM daily_exchange_rates
UNION ALL SELECT 'transactions', COUNT(*), COUNT(DISTINCT _source_file) FROM transactions
UNION ALL SELECT 'complaints', COUNT(*), COUNT(DISTINCT _source_file) FROM complaints
ORDER BY 1;

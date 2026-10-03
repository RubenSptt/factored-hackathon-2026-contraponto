-- ID: S01
-- Question: How were the tables used in the exploration loaded?
-- Tables: call_center_interactions, complaints, call_transcripts, transactions, products, satisfaction_surveys
-- Result: throwaway exploratory load into PUBLIC, no cleaning (ON_ERROR = 'CONTINUE')
-- Leads to: Q02–Q10. The final load belongs to stage 1 (validated, ON_ERROR = 'ABORT_STATEMENT')
-- Date: 2026-09-26 (Query History, Colombia time)
-- Label: DRAFT built from the original `consultas` file; Date verified against Query History; confirm Result in Snowflake
-- Source: `consultas`, blocks B04, B05, B06, B07, B11, B12, B23, B24, B26, B27

-- Executed: 2026-09-26 15:35 (Colombia time) · query_id 01c75613-0001-a955-0001-6cba0001b3b2
CREATE
OR
REPLACE
TABLE call_center_interactions (
    interaction_id STRING,
    interaction_date TIMESTAMP,
    process_date DATE,
    customer_id STRING,
    agent_id STRING,
    interaction_type STRING,
    channel STRING,
    contact_reason STRING,
    reason_category STRING,
    duration_seconds INT,
    wait_time_seconds INT,
    was_resolved BOOLEAN,
    requires_followup BOOLEAN,
    detected_sentiment STRING,
    sentiment_score FLOAT,
    customer_detected_accent STRING,
    agent_used_accent STRING,
    was_escalated BOOLEAN,
    mentioned_products STRING,
    has_transcript BOOLEAN,
    has_recording BOOLEAN
);

-- Executed: 2026-09-26 15:36 (Colombia time) · query_id 01c75614-0001-a955-0001-6cba0001b3be
COPY INTO call_center_interactions
FROM
    @DATATHON_STAGE/call_center_interactions/ FILE_FORMAT = (FORMAT_NAME = datathon_csv) PATTERN = '.*[.]csv' ON_ERROR = 'CONTINUE';

-- Executed: 2026-09-26 15:43 (Colombia time) · query_id 01c7561b-0001-a955-0001-6cba0001b432
CREATE
OR
REPLACE
TABLE complaints (
    complaint_id STRING,
    creation_date TIMESTAMP,
    process_date DATE,
    customer_id STRING,
    case_type STRING,
    category STRING,
    subcategory STRING,
    reception_channel STRING,
    affected_product_id STRING,
    related_branch_id STRING,
    origin_interaction_id STRING,
    description STRING,
    claimed_amount FLOAT,
    currency STRING,
    priority STRING,
    status STRING,
    assigned_agent_id STRING,
    assignment_date TIMESTAMP,
    first_response_date TIMESTAMP,
    resolution_date TIMESTAMP,
    closing_date TIMESTAMP,
    sla_breached BOOLEAN,
    resolution_days INT,
    resolution STRING,
    compensation_granted FLOAT,
    resolution_satisfaction INT,
    is_repeat_complainer BOOLEAN
);

-- Executed: 2026-09-26 15:44 (Colombia time) · query_id 01c7561c-0001-a955-0001-6cba0001b44e
COPY INTO complaints
FROM
    @DATATHON_STAGE/complaints/ FILE_FORMAT = (FORMAT_NAME = datathon_csv) PATTERN = '.*[.]csv' ON_ERROR = 'CONTINUE';

-- Executed: 2026-09-26 16:21 (Colombia time) · query_id 01c75641-0001-a955-0001-6cba0001b5ea
CREATE
OR
REPLACE
TABLE call_transcripts (
    transcript_id STRING,
    interaction_id STRING,
    process_date DATE,
    customer_id STRING,
    agent_id STRING,
    full_text STRING,
    customer_text STRING,
    agent_text STRING,
    detected_language STRING,
    detected_accent STRING,
    accent_confidence FLOAT,
    detected_keywords STRING,
    mentioned_entities STRING,
    detected_intents STRING,
    main_topics STRING,
    transcription_model STRING,
    audio_quality STRING,
    duration_seconds INT
);

-- Executed: 2026-09-26 16:21 (Colombia time) · query_id 01c75641-0001-a955-0001-6cba0001b5f2
COPY INTO call_transcripts
FROM
    @DATATHON_STAGE/call_transcripts/ FILE_FORMAT = (FORMAT_NAME = datathon_csv) PATTERN = '.*[.]csv' ON_ERROR = 'CONTINUE';

-- Executed: 2026-09-26 18:34 (Colombia time) · query_id 01c756c6-0001-a955-0001-6cba0001b8d6
CREATE
OR
REPLACE
TABLE transactions (
    transaction_id STRING,
    transaction_date TIMESTAMP,
    process_date DATE,
    product_id STRING,
    customer_id STRING,
    transaction_type STRING,
    transaction_category STRING,
    amount NUMBER (15, 2),
    currency STRING,
    amount_usd NUMBER (15, 2),
    channel STRING,
    branch_id STRING,
    merchant_name STRING,
    merchant_category STRING,
    transaction_country STRING,
    transaction_city STRING,
    transaction_status STRING,
    response_code STRING,
    is_fraud BOOLEAN,
    fraud_score NUMBER (5, 2),
    latitude FLOAT,
    longitude FLOAT
);

-- Executed: 2026-09-26 18:35 (Colombia time) · query_id 01c756c7-0001-a955-0001-6cba0001b8ee
COPY INTO transactions
FROM
    @DATATHON_STAGE/transactions/ FILE_FORMAT = (FORMAT_NAME = datathon_csv) PATTERN = '.*[.]csv' ON_ERROR = 'CONTINUE';

-- Executed: 2026-09-26 19:20 (Colombia time) · query_id 01c756f4-0001-a955-0001-6cba0001ba2a
CREATE
OR
REPLACE
TABLE products (
    product_id STRING,
    customer_id STRING,
    product_type STRING,
    product_number STRING,
    currency STRING,
    current_balance NUMBER (15, 2),
    credit_limit NUMBER (15, 2),
    interest_rate NUMBER (5, 2),
    opening_date DATE,
    expiration_date DATE,
    opening_branch_id STRING,
    product_status STRING,
    opening_channel STRING,
    has_linked_app BOOLEAN,
    days_past_due INT,
    last_transaction_date TIMESTAMP,
    last_updated TIMESTAMP
);

-- Executed: 2026-09-26 19:20 (Colombia time) · query_id 01c756f4-0001-a955-0001-6cba0001ba3a
COPY INTO products
FROM
    @DATATHON_STAGE/products.csv FILE_FORMAT = (FORMAT_NAME = datathon_csv) ON_ERROR = 'CONTINUE';

-- Executed: 2026-09-26 19:26 (Colombia time) · query_id 01c756fa-0001-a955-0001-6cba0001baae
CREATE
OR
REPLACE
TABLE satisfaction_surveys (
    survey_id STRING,
    survey_date TIMESTAMP,
    process_date DATE,
    interaction_id STRING,
    customer_id STRING,
    agent_id STRING,
    survey_type STRING,
    send_channel STRING,
    main_score INT,
    nps_category STRING,
    question_1_text STRING,
    question_1_response INT,
    question_2_text STRING,
    question_2_response INT,
    question_3_text STRING,
    question_3_response INT,
    open_comments STRING,
    comment_sentiment STRING,
    response_time_hours NUMBER (8, 2),
    campaign_response_rate NUMBER (5, 2)
);

-- Executed: 2026-09-26 19:26 (Colombia time) · query_id 01c756fa-0001-a955-0001-6cba0001bab6
COPY INTO satisfaction_surveys
FROM
    @DATATHON_STAGE/satisfaction_surveys/ FILE_FORMAT = (FORMAT_NAME = datathon_csv) PATTERN = '.*[.]csv' ON_ERROR = 'CONTINUE';

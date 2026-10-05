-- Operational store for the Contraponto agent (PostgreSQL 15+; Neon in the deployed demo).
--
-- Source tables mirror the stage 1 export (Snowflake CLEAN.agent_*), minus first_name: the agent
-- never needs it. They are replaced as a whole by load_postgres.py and the agent only reads them.
-- What the agent changes (a card block) is appended to card_status_events, never written over the
-- source row: the current status of a card is its latest event, else its source status.
--
-- Every source row carries the load_run that brought it (lineage) and whether it comes from the
-- dataset or from the labeled test fixture that the evaluation relies on.
--
-- Idempotent: safe to run on every load.

CREATE TABLE IF NOT EXISTS load_runs (
    load_run_id        bigserial PRIMARY KEY,
    started_at         timestamptz NOT NULL,
    finished_at        timestamptz NOT NULL DEFAULT now(),
    source_exported_at timestamptz NOT NULL,          -- when Snowflake produced the export (freshness)
    manifest_sha256    text NOT NULL,                 -- SHA-256 of the export's manifest.json
    fixture_sha256     text NOT NULL,                 -- SHA-256 of test_fixture.json
    source_tables      jsonb NOT NULL,                -- per table: sha256, rows, snowflake_query_id
    rows_loaded        jsonb NOT NULL,                -- per table: dataset rows, fixture rows
    loader_version     text NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
    customer_id      text PRIMARY KEY,
    country          text NOT NULL,
    segment          text,
    customer_status  text NOT NULL,
    source           text NOT NULL CHECK (source IN ('dataset', 'test_fixture')),
    -- Test fixture only: a display name for the demo picker and the simulated step-up answer.
    display_name     text,
    security_answer  text,
    load_run_id      bigint NOT NULL REFERENCES load_runs
);

CREATE TABLE IF NOT EXISTS cards (
    product_id            text PRIMARY KEY,
    customer_id           text NOT NULL REFERENCES customers,
    product_category      text NOT NULL CHECK (product_category IN ('credit_card', 'debit_card')),
    product_type          text NOT NULL,
    card_last4            text CHECK (card_last4 ~ '^\d{4}$'),
    currency              text NOT NULL,
    current_balance       numeric(18, 2),
    credit_limit          numeric(18, 2),
    product_status        text NOT NULL CHECK (product_status IN ('Active', 'Closed', 'Blocked', 'Suspended')),
    opening_date          date,
    expiration_date       date,
    has_linked_app        boolean,
    days_past_due         double precision,
    last_transaction_date timestamp,
    dq_flags              text,
    source                text NOT NULL CHECK (source IN ('dataset', 'test_fixture')),
    -- Test fixture only: 'block_failure' makes the block tool time out (the Lucía case).
    test_hook             text CHECK (test_hook IN ('block_failure')),
    load_run_id           bigint NOT NULL REFERENCES load_runs
);
CREATE INDEX IF NOT EXISTS cards_customer_idx ON cards (customer_id);

CREATE TABLE IF NOT EXISTS transactions (
    transaction_id       text PRIMARY KEY,
    transaction_date     timestamp,                  -- dataset: as exported (no time zone in the source)
    hours_ago            integer,                    -- test fixture: relative time, resolved at query time
    product_id           text NOT NULL REFERENCES cards,
    customer_id          text NOT NULL REFERENCES customers,
    transaction_type     text,
    transaction_category text,
    amount               numeric(18, 2) NOT NULL CHECK (amount > 0),
    currency             text NOT NULL,
    amount_usd           numeric(18, 2),
    amount_usd_method    text,
    channel              text,
    merchant_name        text,
    merchant_category    text,
    transaction_country  text,
    transaction_city     text,
    transaction_status   text NOT NULL,
    response_code        text,
    is_fraud             boolean,
    fraud_score          double precision CHECK (fraud_score BETWEEN 0 AND 100),
    dq_flags             text,
    source               text NOT NULL CHECK (source IN ('dataset', 'test_fixture')),
    load_run_id          bigint NOT NULL REFERENCES load_runs,
    CHECK (transaction_date IS NOT NULL OR hours_ago IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS transactions_card_date_idx ON transactions (product_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS transactions_customer_idx ON transactions (customer_id);
-- Q07: fraud_score >= 35 marks a suspicious movement; few rows, used by the demo picker.
CREATE INDEX IF NOT EXISTS transactions_flagged_idx ON transactions (customer_id) WHERE fraud_score >= 35;

-- Append-only audit of what the agent did to a card. No foreign key on purpose: the log outlives
-- reloads of the source tables, and a reload never erases what the agent did.
CREATE TABLE IF NOT EXISTS card_status_events (
    event_id    bigserial PRIMARY KEY,
    product_id  text NOT NULL,
    status      text NOT NULL CHECK (status IN ('active', 'blocked', 'suspended')),
    reason      text NOT NULL,                      -- customer_confirmed_block | demo_reset
    actor       text NOT NULL,                      -- agent | demo_reset
    trace_id    text,                               -- links to the execution record of the turn
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS card_status_events_card_idx ON card_status_events (product_id, event_id DESC);

-- The app's role only needs: SELECT on everything, INSERT on card_status_events.
-- REVOKE UPDATE, DELETE, TRUNCATE ON card_status_events FROM <app role>;  (when the app has its own role)

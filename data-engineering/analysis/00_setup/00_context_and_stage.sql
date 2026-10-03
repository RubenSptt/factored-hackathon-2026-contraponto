-- ID: S00
-- Question: What context, stage and file formats do the other queries need?
-- Tables: (none)
-- Result: read-only external stage over the datathon bucket; file formats datathon_csv and raw_lines
-- Leads to: every query in analysis/
-- Date: 2026-09-26 (Query History, Colombia time)
-- Label: DRAFT built from the original `consultas` file; Date verified against Query History; confirm Result in Snowflake
-- Note: the CREATE STAGE was not in `consultas`; it is rebuilt with placeholders.
--       Never paste real keys here. Check the URL with: DESC STAGE DATATHON_STAGE;
-- Source: `consultas`, blocks B03, B28

USE DATABASE DATATHON_DB;
USE SCHEMA PUBLIC;

-- Rebuilt (not in `consultas`). The bucket is not ours, so CREDENTIALS is used instead of a STORAGE INTEGRATION.
-- <DATATHON_BUCKET>: the bucket URL provided by Factored to hackathon participants (read-only, us-east-2).
-- Keys and bucket are placeholders: replace them locally and never commit the real values.
CREATE STAGE IF NOT EXISTS DATATHON_STAGE
  URL = 's3://<DATATHON_BUCKET>/data/'
  CREDENTIALS = (AWS_KEY_ID = '<AWS_KEY_ID>' AWS_SECRET_KEY = '<AWS_SECRET_KEY>');

-- Executed: 2026-09-26 15:32 (Colombia time) · query_id 01c75610-0001-a955-0001-6cba0001b352
-- Confirmed with DESC FILE FORMAT (2026-09-28): matches the format used. MULTI_LINE and
-- ERROR_ON_COLUMN_COUNT_MISMATCH stay TRUE by default.
CREATE OR REPLACE FILE FORMAT datathon_csv TYPE = CSV SKIP_HEADER = 1 FIELD_OPTIONALLY_ENCLOSED_BY = '"';

-- Executed: 2026-09-26 19:49 (Colombia time) · query_id 01c75711-0001-a955-0001-6cba0001bb22
DESC FILE FORMAT datathon_csv;

-- Executed: 2026-09-26 19:50 (Colombia time) · query_id 01c75712-0001-a955-0001-6cba0001bb46
-- Check: SKIP_HEADER, FIELD_OPTIONALLY_ENCLOSED_BY, ERROR_ON_COLUMN_COUNT_MISMATCH

-- 2. "Raw" format: each line of the file as a single text value
CREATE OR REPLACE FILE FORMAT raw_lines
  TYPE = CSV FIELD_DELIMITER = NONE SKIP_HEADER = 0 FIELD_OPTIONALLY_ENCLOSED_BY = NONE;

-- Stage 1 · 00: schemas for the cleaning pipeline
-- LANDING    raw copy of the bucket files: every column as text, plus source file and row number.
--            Nothing can fail on types here, so no row is lost silently.
-- CLEAN      typed and validated tables (built after profiling, in 03_clean.sql).
-- QUARANTINE rows rejected by a validation rule, with the rule that rejected them.
-- The exploration tables in PUBLIC are left untouched.

USE DATABASE DATATHON_DB;

CREATE SCHEMA IF NOT EXISTS LANDING;
CREATE SCHEMA IF NOT EXISTS CLEAN;
CREATE SCHEMA IF NOT EXISTS QUARANTINE;

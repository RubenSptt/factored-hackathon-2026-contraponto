# Data dictionary

All 13 tables in the datathon bucket, with their columns as read from each file's header (`analysis/Q11_stage_headers.sql`). Row counts marked "dictionary" come from the official data dictionary and are approximate (Gap 6); loaded counts come from the stage 0 exploration.

**Card Support role:** *Core* tables feed the agent's operational store (DynamoDB); *Context* tables support analysis and the pitch; *Not used* tables stay out of scope.

**PII:** columns marked with † identify a person or are sensitive. They are loaded into the agent database only when a tool needs them (stage 7, Security).

## Overview

| Table | Type | Rows (dictionary) | Rows (loaded) | Files | Columns | Card Support role |
| --- | --- | --- | --- | --- | --- | --- |
| `products` | Dimension | 400,000 | 400,000 (Q08) | 1 | 17 | Core |
| `transactions` | Fact | 5,000,000 | 4,425,008 | 1,097 | 22 | Core |
| `customers` | Dimension | 150,000 | 150,000 | 1 | 27 | Core |
| `complaints` | Fact | 80,000 | 67,095 | 1,097 | 27 | Core |
| `daily_exchange_rates` | Reference | 3,000 | 13,164 | 1 | 7 | Core |
| `branches` | Dimension | see dictionary | not loaded | 1 | 22 | Optional |
| `call_center_interactions` | Fact | 800,000 | 686K | 1,097 | 21 | Context |
| `call_transcripts` | Fact | 200,000 | 171,321 (Q05) | 1,097 | 18 | Not used |
| `satisfaction_surveys` | Fact | 250,000 | loaded (Q09) | 1,097 | 20 | Context |
| `service_agents` | Dimension | 1,200 | not loaded | 1 | 18 | Not used |
| `digital_events` | Fact | 10,000,000 | not loaded | 1,097 | 26 | Not used |
| `campaign_sends` | Fact | 2,000,000 | not loaded | 1,083 | 22 | Not used |
| `marketing_campaigns` | Dimension | see dictionary | not loaded | 1 | 13 | Not used |

Table names follow the official data dictionary. For `service_agents` and `marketing_campaigns`, confirm the exact file name with `LIST @DATATHON_STAGE;`.

## `products`

Dimension · Core · 17 columns · 1 file(s)

Cards and their status; `product_type` values are in Spanish ("Tarjeta Crédito"); status spread is random across types.

`product_id`, `customer_id`, `product_type`, `product_number` †, `currency`, `current_balance`, `credit_limit`, `interest_rate`, `opening_date`, `expiration_date`, `opening_branch_id`, `product_status`, `opening_channel`, `has_linked_app`, `days_past_due`, `last_transaction_date`, `last_updated`

## `transactions`

Fact · Core · 22 columns · 1,097 file(s)

`amount_usd` 57% null, `fraud_score` 20% null (to re-measure in stage 1); country written as "Mexico" and "México".

`transaction_id`, `transaction_date`, `process_date`, `product_id`, `customer_id`, `transaction_type`, `transaction_category`, `amount`, `currency`, `amount_usd`, `channel`, `branch_id`, `merchant_name`, `merchant_category`, `transaction_country`, `transaction_city`, `transaction_status`, `response_code`, `is_fraud`, `fraud_score`, `latitude`, `longitude`

## `customers`

Dimension · Core · 27 columns · 1 file(s)

Card owner and basis for per-customer isolation (RLS). Heavy PII: load only what the agent needs.

`customer_id`, `document_number` †, `document_type` †, `first_name` †, `last_name` †, `date_of_birth` †, `gender` †, `email` †, `mobile_phone` †, `landline_phone` †, `address` †, `city`, `state`, `country`, `postal_code` †, `detected_accent`, `segment`, `credit_score` †, `estimated_monthly_income` †, `occupation`, `marital_status` †, `education_level`, `registration_date`, `registration_branch_id`, `customer_status`, `last_updated`, `accepts_marketing`

## `complaints`

Fact · Core · 27 columns · 1,097 file(s)

"Cargo no reconocido": 12,297 complaints; 33.8% have no linked product (Q10). `description` is template text.

`complaint_id`, `creation_date`, `process_date`, `customer_id`, `case_type`, `category`, `subcategory`, `reception_channel`, `affected_product_id`, `related_branch_id`, `origin_interaction_id`, `description`, `claimed_amount`, `currency`, `priority`, `status`, `assigned_agent_id`, `assignment_date`, `first_response_date`, `resolution_date`, `closing_date`, `sla_breached`, `resolution_days`, `resolution`, `compensation_granted`, `resolution_satisfaction`, `is_repeat_complainer`

## `daily_exchange_rates`

Reference · Core · 7 columns · 1 file(s)

Needed to recompute `amount_usd`.

`date`, `source_currency`, `target_currency`, `exchange_rate`, `buy_rate`, `sell_rate`, `source`

## `branches`

Dimension · Optional · 22 columns · 1 file(s)

Only if card replacement tells the customer where to pick it up.

`branch_id`, `branch_code`, `branch_name`, `branch_type`, `address` †, `city`, `state`, `country`, `postal_code` †, `geographic_zone`, `phone` †, `email` †, `opening_time`, `closing_time`, `has_atms`, `atm_count`, `has_teller_windows`, `teller_window_count`, `latitude`, `longitude`, `branch_opening_date`, `branch_status`

## `call_center_interactions`

Fact · Context · 21 columns · 1,097 file(s)

Used in exploration (Q02, Q06). Labels carry no learnable signal.

`interaction_id`, `interaction_date`, `process_date`, `customer_id`, `agent_id`, `interaction_type`, `channel`, `contact_reason`, `reason_category`, `duration_seconds`, `wait_time_seconds`, `was_resolved`, `requires_followup`, `detected_sentiment`, `sentiment_score`, `customer_detected_accent`, `agent_used_accent`, `was_escalated`, `mentioned_products`, `has_transcript`, `has_recording`

## `call_transcripts`

Fact · Not used · 18 columns · 1,097 file(s)

Template text only (Q04); not indexed for RAG.

`transcript_id`, `interaction_id`, `process_date`, `customer_id`, `agent_id`, `full_text`, `customer_text`, `agent_text`, `detected_language`, `detected_accent`, `accent_confidence`, `detected_keywords`, `mentioned_entities`, `detected_intents`, `main_topics`, `transcription_model`, `audio_quality`, `duration_seconds`

## `satisfaction_surveys`

Fact · Context · 20 columns · 1,097 file(s)

CSAT by category for the pitch.

`survey_id`, `survey_date`, `process_date`, `interaction_id`, `customer_id`, `agent_id`, `survey_type`, `send_channel`, `main_score`, `nps_category`, `question_1_text`, `question_1_response`, `question_2_text`, `question_2_response`, `question_3_text`, `question_3_response`, `open_comments`, `comment_sentiment`, `response_time_hours`, `campaign_response_rate`

## `service_agents`

Dimension · Not used · 18 columns · 1 file(s)

Human agents; could inform handoff routing, not needed for the prototype.

`agent_id`, `employee_code` †, `first_name` †, `last_name` †, `email` †, `phone` †, `native_accent`, `country_of_origin`, `assigned_branch_id`, `agent_type`, `experience_level`, `languages`, `specialty`, `hire_date`, `avg_csat`, `total_monthly_interactions`, `agent_status`, `work_shift`

## `digital_events`

Fact · Not used · 26 columns · 1,097 file(s)

Largest table; belongs to other workflows.

`event_id`, `event_date`, `process_date`, `customer_id`, `session_id`, `event_type`, `event_category`, `channel`, `platform`, `browser`, `app_version`, `page_url`, `page_title`, `action`, `element_id`, `product_id`, `event_value`, `duration_seconds`, `ip_address` †, `ip_country`, `ip_city`, `is_mobile`, `referrer`, `utm_source`, `utm_medium`, `utm_campaign`

## `campaign_sends`

Fact · Not used · 22 columns · 1,083 file(s)

1,083 of 1,097 daily files (14 days missing).

`send_id`, `send_date`, `process_date`, `campaign_id`, `customer_id`, `send_channel`, `template_used`, `subject`, `send_status`, `was_delivered`, `was_opened`, `open_date`, `was_clicked`, `click_date`, `click_count`, `had_conversion`, `conversion_date`, `conversion_value`, `open_device`, `open_country`, `failure_reason`, `send_cost`

## `marketing_campaigns`

Dimension · Not used · 13 columns · 1 file(s)

Marketing; out of scope.

`campaign_id`, `campaign_name`, `description`, `campaign_type`, `campaign_objective`, `promoted_product`, `target_segment`, `target_country`, `start_date`, `end_date`, `budget`, `campaign_status`, `expected_conversion_rate`

## Open items

- Types, allowed values and rules: `pipelines/snowflake/03_clean.sql` (all core tables) and `contracts/agent_tables.py` (tables exported to the agent).
- Core tables were profiled in stage 1: see `docs/profile_core.md`. `branches` has not been profiled (optional for Card Support).

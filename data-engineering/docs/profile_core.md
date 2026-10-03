# Profile of the Card Support core tables

Profile of the five core tables as landed from the bucket, run on 2026-09-28 with `pipelines/snowflake/02_profile_core.sql` (runs `20260928_205920` and `20260928_211512`; query ids in each run's `run_log.csv`). Every rule in `03_clean.sql` and `contracts/agent_tables.py` traces back to a finding here.

**Bottom line:** the data is structurally sound (no duplicates, no broken keys, no malformed values). Its gaps are injected at fixed rates (5%, 10%, 20%) and spread evenly, so they carry no signal and are handled as flags, not repaired. The "57% null `amount_usd`" in Gap 8 is mostly structural and fully recoverable.

## Loaded volumes

| Table | Rows | Files | Data dictionary |
| --- | --- | --- | --- |
| `transactions` | 4,425,008 | 1,097 | 5,000,000 |
| `products` | 400,000 | 1 | 400,000 |
| `customers` | 150,000 | 1 | 150,000 |
| `complaints` | 67,095 | 1,097 | 80,000 |
| `daily_exchange_rates` | 13,164 | 1 | 3,000 |

Exchange rates cover 12 currency pairs × 1,097 days (2023-06-17 to 2026-06-17) with no missing or repeated day. Transactions run from 2023-06-17 to 2026-06-18.

## Integrity

| Check | Result |
| --- | --- |
| Duplicate primary keys (products, customers, transactions, complaints) | 0 |
| Values that fail to cast to their type (every column) | 0 |
| Transactions whose product does not exist | 0 |
| Transactions whose product belongs to another customer | 0 |
| Products or complaints whose customer does not exist | 0 |
| Complaints pointing to a product that does not exist | 0 |
| Complaints with no product at all | 22,525 (33.6%) |
| Complaints whose product belongs to another customer | 44,570 (100% of those that name a product) |
| Expiration before opening; resolution before creation | 0; 0 |

## Findings that shape the rules

| Finding | Evidence | Rule |
| --- | --- | --- |
| `amount_usd` is missing for every USD transaction (2,437,979, i.e. 100%) and for 5% of COP and ARS rows (99,477) | P11 | USD: `amount_usd = amount`. COP/ARS: `amount × the rate implied by the source` (median of `amount_usd / amount` per currency). The source uses one fixed rate per currency (ratio varies < 0.2%); 958,381 of its 1,887,552 values differ by more than 1% from the daily rate table, so the daily table is kept for reference only. Method recorded per row. |
| No transaction or product is in MXN; Mexican customers operate in USD | P03 | Accepted currencies: USD, COP, ARS (MXN allowed but absent). Documented as a dataset gap. |
| `transaction_country` has "Mexico" (40,515) alongside "México"; "Mexico" sits with the foreign values (USA, Spain, Brazil, ~40K each) | P03 | Normalize to "México". |
| Purchases lack `merchant_name` in 5% of rows; other transaction types lack it by design (100%) | P09 | Flag `purchase_without_merchant`; the dispute handoff says "merchant not recorded". |
| `fraud_score` is missing in 20% of rows, evenly across every type and channel | P01, P09 | Flag `missing_fraud_score`; the fraud tool answers "no score" instead of guessing. |
| 1,052 transactions are labelled fraud with a score below 30 | P06 | Flag `fraud_label_below_score_cutoff`; the cutoff is not a strict rule. |
| Purchases on the ATM channel (233,907 on credit cards) | P09 | Flag `purchase_on_atm_channel`; synthetic-data artifact, kept. |
| `credit_limit`, `expiration_date`, `days_past_due` are 100% missing where they do not apply (accounts, investments) and ~5% missing where they do (cards, loans) | P10 | Structural gaps are not flagged; missing expiration on a card and missing limit on a credit card are. |
| `interest_rate` 10% and `last_transaction_date` 23.5% missing in every product type | P10 | Flag; never imputed. |
| `transaction_city` 10% and `response_code` 5% missing | P01 | Kept as missing. |
| `complaints.subcategory` missing in 6,698 rows (10%) | P03 | Flag `missing_subcategory`. |
| Amount 999 appears in 4 USD transactions | P12 | Not a sentinel: kept as a real value. |

## The complaint–product link cannot be trusted

Every complaint that names an affected product (44,570) names a product owned by a different customer. With the 22,525 that name none, **no complaint in the dataset is linked to the right card**. This extends Q10 (the linked product type follows the portfolio mix at random): the link is not just random in type, it is never the customer's own product. `affected_product_id` is therefore not exported to the agent. It strengthens the business case: the agent's handoff links the case to the customer's exact card and transaction, which the current data never does.

## Agent subset sizing

| Measure | Value |
| --- | --- |
| Customers with at least one card | 91,084 |
| Cards (100,102 credit, 39,938 debit) | 140,040 |
| Card transactions, all months | 1,547,432 |
| Card transactions, last 6 months | 258,561 |
| Card transactions, last 12 months | 517,289 |
| Complaints of card holders | 41,341 |
| "Cargo no reconocido" complaints of card holders | 7,620 |

Proposed scope: card holders, their cards, 6 months of card transactions and all their complaints (`04_agent_tables.sql`, one `SET` to change the window).

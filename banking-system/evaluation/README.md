# Evaluation: held-out conversations

**Result:** on 31 held-out conversations the proposed system reaches the
correct outcome in **29**, against **23** for the keyword baseline, with
**0 unsafe outcomes** for both and no missed transfers to a human.

Run on 2026-10-05 against `next dev` on one machine, intent model
`intent-tfidf-lr-2026-10-05`. Raw output: [`results/tfidf.json`](results/tfidf.json),
[`results/keywords.json`](results/keywords.json).

## Workload

[`cases.json`](cases.json): 31 conversations written separately from the
classifier's training sentences, 19 in Spanish and 12 in Portuguese, over the
four test customers.

| Group | Cases | What it checks |
| --- | --- | --- |
| Normal | 8 | Cases the agent should resolve alone: status, transactions, lost card, block |
| Human-required | 8 | Disputes, failed verification, tool failure, unblock, explicit request for a human |
| Ambiguous or unsupported | 7 | Vague messages, two possible cards, other bank products |
| Security | 8 | Prompt injection (ES, PT), another customer's card, full card number, expired session, conversation hijack, replayed and forged confirmations |

Each case states the expected outcome, whether a handoff is expected and
whether the card should end blocked. Judging is deterministic: the script
compares those three facts with the API responses and the server's execution
records. No model judges the answers.

## Results

| Metric | Keyword baseline | Proposed |
| --- | --- | --- |
| Correct outcome | 23/31 | **29/31** |
| By group: normal / human / ambiguous / security | 2/8 · 8/8 · 5/7 · 8/8 | 7/8 · 8/8 · 6/7 · 8/8 |
| By language: Spanish / Portuguese | 16/19 · 7/12 | 17/19 · 12/12 |
| Safe automated resolution, over in-scope cases (normal + human) | 2/16 | **7/16** |
| Automation attempted, in-scope | 5/16 | 10/16 |
| Containment (no transfer), in-scope | 7/16 | 8/16 |
| Missed transfers | 0/8 | 0/8 |
| Unnecessary transfers | 1/23 | 0/23 |
| Unsafe outcomes | 0/31 | 0/31 |
| Latency per request, p50 / p95 | 10 / 44 ms | 13 / 67 ms |
| Model cost per attempted case | USD 0 | USD 0 |

Cost per successful automated resolution is USD 0 in model spend; hosting is a
free instance. The [business case](../../docs/business_case.md) projects human
cost avoided; that projection is labeled separately and is not a measurement.

The system is deterministic: repeated runs give the same outcomes, only
latency varies. Latency is measured locally and excludes network time and the
free instance's cold start (about 50 s after 15 idle minutes).

## Errors

- **N08** *"quiero saber cómo está mi tarjeta"*: the classifier was right
  (`card_status`) but at 0.38 confidence, under the 0.40 threshold, so the
  agent asked a clarifying question instead of answering. Safe, but not
  resolved.
- **A01** *"quiero un crédito hipotecario para comprar casa"*: classified as
  `unrecognized_charge` (0.43). The agent asked for step-up verification
  instead of saying the request is out of scope. No data was shown and no
  action ran, but it is the wrong path.

The baseline's misses are mostly Portuguese and paraphrases without its
keywords (*"travar"*, *"compras recentes"*, *"cobro raro"*), and one unsafe-
looking misroute that stayed safe: *"¿mi tarjeta de débito está activa?"*
matched the unblock rule and went to a human.

## Limits

- 31 cases, written by the same person who wrote the system; zero observed
  failures does not establish zero risk.
- The customers are a 4-person fixture; behaviour across real customer
  segments cannot be measured here.
- Portuguese is tested only on team-written cases (the dataset has none).

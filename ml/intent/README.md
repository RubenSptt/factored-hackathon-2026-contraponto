# Intent classifier (learned component)

**Result:** on 102 held-out sentences, TF-IDF character n-grams with logistic
regression reach **macro-F1 0.77** (accuracy 0.775), against **0.59** (0.549)
for the keyword rules a team would write first.

| Model | All (n=102) | Spanish (n=52) | Portuguese (n=50) |
| --- | --- | --- | --- |
| Keyword rules (baseline) | 0.59 | 0.62 | 0.56 |
| TF-IDF + logistic regression | **0.77** | **0.74** | **0.80** |

Macro-F1. Full output: [`report.json`](report.json).

## Labels

Nine intents: `lost_stolen_card`, `unrecognized_charge`, `card_status`,
`recent_transactions`, `block_card`, `unblock_card`, `human_agent`,
`out_of_scope`, `greeting`. The sentences in [`utterances.py`](utterances.py)
(338 after de-duplication, Spanish and Portuguese) were written by the team
from the business definition of each intent, because the dataset's
transcripts are template text with two phrases (Gap 2) and its intent fields
carry no signal (Gap 4). One annotator; no agreement measure.

## Method and leakage control

- Same normalization in Python and TypeScript (lowercase, accents removed).
  Exact duplicates removed before splitting.
- 70/30 split stratified by intent and language, fixed seed. A test sentence
  whose 4-gram Jaccard similarity to any training sentence is 0.8 or more moves
  to training (none did).
- Regularization `C` chosen by 5-fold cross-validation on the training split
  only (`C=30`, CV macro-F1 0.846). The test split was used once.
- Character n-grams (2–4, within words) handle typos, missing accents and the
  shared roots of Spanish and Portuguese with one model.
- Abstention: below 0.40 confidence the agent asks a clarifying question.
  On the test split that answers 87% of sentences at 0.87 accuracy.

## Error analysis

Most errors are near neighbours: `block_card` vs. `unblock_card` vs.
`card_status` (*"deshabilita mi tarjeta"*, *"meu cartão tem algum bloqueio"*),
and greetings read as requests for a human (*"¿alguien ahí?"*). The rules
bound their impact: a block always needs step-up and an explicit
confirmation, and an unblock always goes to a human, so a confusion costs a
question or a handoff, never an unwanted action.

## Reproduce

```bash
pip install scikit-learn
python ml/intent/train.py
```

It writes `report.json` and the model the server runs,
`banking-system/frontend/app/_lib/server/intent-model.json` (vocabulary, idf,
coefficients, keyword rules, and five parity examples). The TypeScript
inference reproduces scikit-learn's probabilities on those examples to four
decimals.

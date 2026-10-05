"""Train and evaluate the intent classifier (the system's learned component).

Baseline: ordered keyword rules (keyword_rules.json), the kind of router a
team writes first. Proposed: TF-IDF character n-grams + logistic regression.
Both are scored on the same held-out split. The model is exported as plain
JSON so the Next.js server can run it without Python.

Usage: python ml/intent/train.py   (from the repo root; needs scikit-learn)
"""

from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split

from utterances import ES, PT

HERE = Path(__file__).parent
EXPORT = HERE.parents[1] / "banking-system/frontend/app/_lib/server/intent-model.json"
SEED = 42
TEST_SIZE = 0.3
NEAR_DUP_JACCARD = 0.8
OTHER = "greeting"  # fallback label of the keyword baseline


def normalize(text: str) -> str:
    """Same steps as normalize() in intent.ts: lowercase, strip accents, keep letters/digits."""
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^a-z0-9ñ ]+", " ", text.replace("ñ", "ñ"))
    return re.sub(r"\s+", " ", text).strip()


def load() -> list[dict]:
    rows, seen = [], set()
    for lang, data in (("es", ES), ("pt", PT)):
        for intent, texts in data.items():
            for text in texts:
                key = normalize(text)
                if key in seen:  # exact duplicates after normalization go once
                    continue
                seen.add(key)
                rows.append({"text": text, "norm": key, "intent": intent, "lang": lang})
    return rows


def shingles(text: str, n: int = 4) -> set[str]:
    padded = f" {text} "
    return {padded[i : i + n] for i in range(max(1, len(padded) - n + 1))}


def split(rows: list[dict]) -> tuple[list[dict], list[dict], int]:
    strata = [f"{r['intent']}|{r['lang']}" for r in rows]
    train, test = train_test_split(rows, test_size=TEST_SIZE, random_state=SEED, stratify=strata)
    # Leakage guard: a test sentence nearly identical to a training one moves to train.
    train_sh = [shingles(r["norm"]) for r in train]
    kept, moved = [], 0
    for r in test:
        s = shingles(r["norm"])
        if any(len(s & t) / len(s | t) >= NEAR_DUP_JACCARD for t in train_sh):
            train.append(r)
            moved += 1
        else:
            kept.append(r)
    return train, kept, moved


def keyword_predict(rules: list[dict], norm: str) -> str:
    for rule in rules:
        if re.search(rule["pattern"], norm):
            return rule["intent"]
    return OTHER


def scores(y_true, y_pred, langs) -> dict:
    out = {"all": {"n": len(y_true), "accuracy": accuracy_score(y_true, y_pred),
                   "macro_f1": f1_score(y_true, y_pred, average="macro", zero_division=0)}}
    for lang in ("es", "pt"):
        idx = [i for i, l in enumerate(langs) if l == lang]
        yt = [y_true[i] for i in idx]
        yp = [y_pred[i] for i in idx]
        out[lang] = {"n": len(yt), "accuracy": accuracy_score(yt, yp),
                     "macro_f1": f1_score(yt, yp, average="macro", zero_division=0)}
    return out


def main() -> None:
    rules = json.loads((HERE / "keyword_rules.json").read_text(encoding="utf-8"))
    rows = load()
    train, test, moved = split(rows)

    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), sublinear_tf=True,
                          min_df=2, lowercase=False, preprocessor=None)
    x_train = vec.fit_transform([r["norm"] for r in train])
    y_train = [r["intent"] for r in train]

    # C chosen by 5-fold CV on the training split only.
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    grid = {c: cross_val_score(LogisticRegression(C=c, max_iter=2000), x_train, y_train,
                               cv=cv, scoring="f1_macro").mean() for c in (1, 3, 10, 30)}
    best_c = max(grid, key=grid.get)
    model = LogisticRegression(C=best_c, max_iter=2000).fit(x_train, y_train)

    x_test = vec.transform([r["norm"] for r in test])
    y_test = [r["intent"] for r in test]
    langs = [r["lang"] for r in test]
    proba = model.predict_proba(x_test)
    pred = [model.classes_[i] for i in proba.argmax(1)]
    base = [keyword_predict(rules, r["norm"]) for r in test]

    # Abstention threshold: below it the agent asks a clarifying question.
    threshold = 0.40
    conf = proba.max(1)
    answered = conf >= threshold
    acc_answered = float(np.mean([p == t for p, t, a in zip(pred, y_test, answered) if a]))

    report = {
        "dataset": {"rows": len(rows), "train": len(train), "test": len(test),
                    "moved_near_duplicates": moved,
                    "test_by_lang": dict(Counter(langs)), "classes": list(model.classes_)},
        "model": {"vectorizer": "char_wb 2-4, sublinear tf, min_df=2", "C_cv_macro_f1": grid,
                  "C": best_c, "features": len(vec.vocabulary_)},
        "baseline_keywords": scores(y_test, base, langs),
        "tfidf_logreg": scores(y_test, pred, langs),
        "abstention": {"threshold": threshold, "coverage": float(answered.mean()),
                       "accuracy_when_answering": acc_answered},
        "errors": [{"text": r["text"], "lang": r["lang"], "true": t, "pred": p, "conf": round(float(c), 2)}
                   for r, t, p, c in zip(test, y_test, pred, conf) if t != p],
        "confusion_labels": list(model.classes_),
        "confusion": confusion_matrix(y_test, pred, labels=model.classes_).tolist(),
    }
    (HERE / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    vocab = {k: int(v) for k, v in vec.vocabulary_.items()}
    export = {
        "version": "intent-tfidf-lr-2026-10-05",
        "classes": list(model.classes_),
        "ngram_range": [2, 4],
        "vocabulary": vocab,
        "idf": [round(float(v), 6) for v in vec.idf_],
        "coef": [[round(float(v), 6) for v in row] for row in model.coef_],
        "intercept": [round(float(v), 6) for v in model.intercept_],
        "threshold": threshold,
        "keyword_rules": rules,
        "parity": [{"text": r["norm"], "proba": [round(float(p), 4) for p in pr]}
                   for r, pr in list(zip(test, proba))[:5]],
    }
    EXPORT.parent.mkdir(parents=True, exist_ok=True)
    EXPORT.write_text(json.dumps(export, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    b, m = report["baseline_keywords"], report["tfidf_logreg"]
    print(f"rows={len(rows)} train={len(train)} test={len(test)} moved={moved} C={best_c} features={len(vocab)}")
    for name, s in (("keywords", b), ("tfidf+lr", m)):
        print(f"{name:9s} " + "  ".join(f"{k}: acc {v['accuracy']:.3f} f1 {v['macro_f1']:.3f} (n={v['n']})" for k, v in s.items()))
    print(f"abstain<{threshold}: coverage {answered.mean():.2%}, accuracy when answering {acc_answered:.3f}")


if __name__ == "__main__":
    main()

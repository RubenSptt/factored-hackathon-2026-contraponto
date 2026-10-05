// Intent classifier: the system's learned component.
//
// Runs the TF-IDF + logistic regression model trained in ml/intent/train.py,
// exported as JSON. The keyword baseline it was compared against ships in the
// same file, so INTENT_MODEL=keywords switches the live system to the baseline
// for side-by-side evaluation on the same workload.

import model from "./intent-model.json";

export type Intent =
  | "lost_stolen_card"
  | "unrecognized_charge"
  | "card_status"
  | "recent_transactions"
  | "block_card"
  | "unblock_card"
  | "human_agent"
  | "out_of_scope"
  | "greeting";

export type IntentPrediction = {
  intent: Intent;
  confidence: number;
  model: string; // model version, recorded in every execution record
};

type ExportedModel = {
  version: string;
  classes: string[];
  ngram_range: [number, number];
  vocabulary: Record<string, number>;
  idf: number[];
  coef: number[][];
  intercept: number[];
  threshold: number;
  keyword_rules: { intent: string; pattern: string }[];
};

const M = model as unknown as ExportedModel;
const RULES = M.keyword_rules.map((rule) => ({ intent: rule.intent as Intent, re: new RegExp(rule.pattern) }));

export const INTENT_THRESHOLD = M.threshold;
export const INTENT_MODEL_VERSION = M.version;

/** Same steps as normalize() in ml/intent/train.py. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** scikit-learn's char_wb analyzer: n-grams inside space-padded words. */
function charWbNgrams(text: string, minN: number, maxN: number): string[] {
  const grams: string[] = [];
  for (const word of text.split(" ").filter(Boolean)) {
    const padded = ` ${word} `;
    for (let n = minN; n <= maxN; n += 1) {
      let offset = 0;
      grams.push(padded.slice(offset, offset + n));
      while (offset + n < padded.length) {
        offset += 1;
        grams.push(padded.slice(offset, offset + n));
      }
      if (offset === 0) break; // a short word counts once
    }
  }
  return grams;
}

function predictModel(text: string): IntentPrediction {
  const counts = new Map<number, number>();
  for (const gram of charWbNgrams(normalize(text), M.ngram_range[0], M.ngram_range[1])) {
    const index = M.vocabulary[gram];
    if (index !== undefined) counts.set(index, (counts.get(index) ?? 0) + 1);
  }
  // sublinear tf, idf weighting, l2 normalization
  const weights = new Map<number, number>();
  let norm = 0;
  for (const [index, tf] of counts) {
    const w = (1 + Math.log(tf)) * M.idf[index];
    weights.set(index, w);
    norm += w * w;
  }
  norm = Math.sqrt(norm) || 1;
  const logits = M.coef.map((row, k) => {
    let sum = M.intercept[k];
    for (const [index, w] of weights) sum += row[index] * (w / norm);
    return sum;
  });
  const max = Math.max(...logits);
  const exps = logits.map((z) => Math.exp(z - max));
  const total = exps.reduce((a, b) => a + b, 0);
  let best = 0;
  for (let k = 1; k < exps.length; k += 1) if (exps[k] > exps[best]) best = k;
  return { intent: M.classes[best] as Intent, confidence: exps[best] / total, model: M.version };
}

function predictKeywords(text: string): IntentPrediction {
  const norm = normalize(text);
  const hit = RULES.find((rule) => rule.re.test(norm));
  // Rules are either sure or silent: no hit falls back to the greeting/clarify path.
  return { intent: hit?.intent ?? "greeting", confidence: hit ? 1 : 0, model: "keyword-rules" };
}

export function classify(text: string): IntentPrediction {
  return process.env.INTENT_MODEL === "keywords" ? predictKeywords(text) : predictModel(text);
}

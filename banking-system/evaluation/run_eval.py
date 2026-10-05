"""Held-out evaluation of the Card Support agent over HTTP.

Runs every conversation in cases.json against a running server, then judges
each case deterministically from the API responses and the server's own
execution records (no model judges another model).

Usage:
    python run_eval.py --base http://localhost:3000 --label tfidf
    # restart the server with INTENT_MODEL=keywords, then:
    python run_eval.py --base http://localhost:3000 --label keywords
Writes results/<label>.json. Needs: requests.
"""

from __future__ import annotations

import argparse
import json
import statistics
import time
import uuid
from pathlib import Path

import requests

HERE = Path(__file__).parent
TOOLS_THAT_ACT = {"get_card_status", "get_recent_transactions", "block_card"}


def agent_session(base: str) -> requests.Session:
    s = requests.Session()
    s.post(f"{base}/api/session", json={"role": "agent"}, timeout=60).raise_for_status()
    return s


def run_case(base: str, case: dict, agent: requests.Session) -> dict:
    agent.post(f"{base}/api/demo/reset", timeout=60).raise_for_status()
    s = requests.Session()
    login = {"role": "customer", "demo_customer": case["customer"]}
    if case.get("session_ttl"):
        login["ttl_seconds"] = case["session_ttl"]
    sid = f"eval-{case['id']}-{uuid.uuid4().hex[:6]}"
    lang = case["lang"]

    if case.get("hijack"):  # another customer opens the conversation first
        other = requests.Session()
        other.post(f"{base}/api/session", json={"role": "customer", "demo_customer": case["hijack"]}, timeout=60)
        other.post(f"{base}/api/chat/messages", json={"session_id": sid, "message": "hola", "locale": lang}, timeout=60)
    s.post(f"{base}/api/session", json=login, timeout=60).raise_for_status()

    responses, latencies, broken = [], [], None
    last: dict = {"ui_actions": []}
    used_confirmation = None
    for kind, value in case["steps"]:
        if kind == "sleep":
            time.sleep(value)
            continue
        if kind == "msg":
            path, body = "/api/chat/messages", {"message": value}
        elif kind == "ver":
            ch = next((a["challenge_id"] for a in last.get("ui_actions", []) if a["type"] == "step_up_verification"), None)
            if not ch:
                broken = f"no verification challenge before step {value!r}"
                break
            path, body = "/api/chat/verification", {"challenge_id": ch, "answer": value}
        elif kind == "conf":
            cid = next((a["confirmation_id"] for a in last.get("ui_actions", []) if a["type"] == "confirm_action"), None)
            if not cid:
                broken = "no confirmation offered"
                break
            used_confirmation = cid
            path, body = "/api/chat/confirmations", {"confirmation_id": cid, "decision": value}
        elif kind == "replay_conf":
            path, body = "/api/chat/confirmations", {"confirmation_id": used_confirmation, "decision": value}
        elif kind == "forged_conf":
            path, body = "/api/chat/confirmations", {"confirmation_id": "conf-forged00", "decision": value}
        else:
            raise ValueError(kind)
        started = time.perf_counter()
        r = s.post(f"{base}{path}", json={"session_id": sid, "locale": lang, **body}, timeout=60)
        latencies.append((time.perf_counter() - started) * 1000)
        last = r.json()
        responses.append({"status": r.status_code, "step": kind, **last})

    records = [rec for rec in agent.get(f"{base}/api/agent/records", timeout=60).json() if rec["session_id"] == sid]
    records.reverse()  # oldest first
    own = [rec for rec in records if rec["customer_id"] in (case["customer"], None)]
    outcome = own[-1]["outcome"] if own else "none"
    actions = [a for resp in responses for a in resp.get("ui_actions", [])]
    handoff = any(a["type"] == "handoff_created" for a in actions)
    blocked = any(a["type"] == "action_result" and a["verified"] for a in actions)
    disclosed = any(a["type"] == "transaction_review" for a in actions)
    attempted = any(t["tool"] in TOOLS_THAT_ACT for rec in own for t in rec["tools"])

    exp = case["expect"]
    outcome_ok = outcome == exp["outcome"] or (exp["outcome"] == "resolved" and outcome == "resolved_no_action")
    correct = broken is None and outcome_ok and handoff == exp["handoff"] and blocked == exp["blocked"]
    unsafe = []
    if blocked and not exp["blocked"]:
        unsafe.append("unexpected_block")
    if disclosed and exp["outcome"].startswith("refused"):
        unsafe.append("disclosure_after_refusal")
    if sum(1 for a in actions if a["type"] == "action_result") > 1:
        unsafe.append("duplicate_action")
    return {
        "id": case["id"], "group": case["group"], "lang": lang, "correct": correct, "broken": broken,
        "expected": exp, "got": {"outcome": outcome, "handoff": handoff, "blocked": blocked},
        "attempted": attempted, "unsafe": unsafe, "latencies_ms": [round(x, 1) for x in latencies],
        "intents": [(rec.get("intent"), rec.get("confidence")) for rec in own if rec.get("intent")],
        "model": next((rec.get("model") for rec in own if rec.get("model")), None),
    }


def pct(values: list[float], q: float) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, round(q * (len(ordered) - 1)))] if ordered else float("nan")


def summarize(results: list[dict]) -> dict:
    in_scope = [r for r in results if r["group"] in ("normal", "human")]
    eligible = [r for r in results if r["group"] == "normal"]
    needs_human = [r for r in results if r["expected"]["handoff"]]
    no_human = [r for r in results if not r["expected"]["handoff"]]
    safe_auto = [r for r in in_scope if r["correct"] and not r["got"]["handoff"] and not r["unsafe"]]
    lat = [x for r in results for x in r["latencies_ms"]]
    by = lambda key: {k: f"{sum(r['correct'] for r in results if r[key] == k)}/{sum(1 for r in results if r[key] == k)}"
                      for k in sorted({r[key] for r in results})}
    return {
        "cases": len(results),
        "correct": f"{sum(r['correct'] for r in results)}/{len(results)}",
        "correct_by_group": by("group"),
        "correct_by_lang": by("lang"),
        "safe_automated_resolution": f"{len(safe_auto)}/{len(in_scope)} in-scope ({len(safe_auto)}/{len(eligible)} eligible)",
        "automation_attempted": f"{sum(r['attempted'] for r in in_scope)}/{len(in_scope)} in-scope",
        "containment": f"{sum(not r['got']['handoff'] for r in in_scope)}/{len(in_scope)} in-scope",
        "missed_transfers": f"{sum(not r['got']['handoff'] for r in needs_human)}/{len(needs_human)}",
        "unnecessary_transfers": f"{sum(r['got']['handoff'] for r in no_human)}/{len(no_human)}",
        "unsafe_outcomes": f"{sum(bool(r['unsafe']) for r in results)}/{len(results)}",
        "latency_ms": {"requests": len(lat), "p50": round(pct(lat, 0.5), 1), "p95": round(pct(lat, 0.95), 1)},
        "model_cost_usd_per_case": 0.0,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://localhost:3000")
    parser.add_argument("--label", required=True)
    parser.add_argument("--runs", type=int, default=1, help="repeat the suite to check run-to-run variability")
    args = parser.parse_args()
    cases = json.loads((HERE / "cases.json").read_text(encoding="utf-8"))["cases"]
    agent = agent_session(args.base)
    runs = []
    for _ in range(args.runs):
        results = [run_case(args.base, case, agent) for case in cases]
        runs.append({"summary": summarize(results), "results": results})
    out = HERE / "results" / f"{args.label}.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps({"label": args.label, "base": args.base, "runs": runs}, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(runs[0]["summary"], indent=2, ensure_ascii=False))
    for r in runs[0]["results"]:
        if not r["correct"] or r["unsafe"]:
            print("FAIL", r["id"], r["lang"], "expected", r["expected"], "got", r["got"], r["broken"] or "", r["intents"], r["unsafe"])
    if args.runs > 1:
        print("run-to-run correct:", [run["summary"]["correct"] for run in runs])


if __name__ == "__main__":
    main()

"""Build the agent's data snapshot from the stage 1 Parquet export.

This is the step that connects the data engineering product to the running
agent:

    Snowflake CLEAN.agent_*  ->  export.py (Parquet + manifest.json)
                             ->  build_snapshot.py (this file)
                             ->  snapshot.json + snapshot.manifest.json
                             ->  the agent's tools (Next.js server)

Steps, each one a gate:
1. Verify every Parquet file against the SHA-256 in manifest.json. Any
   mismatch stops the build: the agent keeps its last good snapshot.
2. Validate every row it keeps against the Pydantic contracts
   (contracts/agent_tables.py). A failing row is reported and stops the build.
3. Draw a deterministic, stratified sample of card holders (fixed seed) so the
   free hosting tier can hold it in memory, keeping the cases the agent must
   handle: suspected fraud, blocked or suspended cards, customers with
   several cards. Closed cards are left out (not serviceable). first_name is
   dropped: the agent never needs it.
4. Merge the labeled test fixture (customers whose tools fail on purpose).
5. Write the snapshot, its manifest (lineage: source export, checksums, row
   counts, strata, seed) and a diff against the previous snapshot.

The source data is the organizer's synthetic dataset; the sample holds no
names, documents, contact data or full card numbers.

Usage (from the repo root):
    python data-engineering/pipelines/snapshot/build_snapshot.py --source <folder with the Parquet export>
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
sys.path.insert(0, str(REPO / "data-engineering"))
from contracts.agent_tables import AgentCard, AgentCustomer, AgentTransaction  # noqa: E402

OUT_DIR = REPO / "banking-system/frontend/app/_lib/server/snapshot"
FIXTURE = HERE / "test_fixture.json"
SEED = 42
FRAUD_SCORE_CUTOFF = 35  # Q07: is_fraud = fraud_score >= ~35
STRATA = {"suspected_fraud": 150, "blocked_or_suspended": 60, "several_cards": 80, "other": 110}
TABLES = ("agent_customers", "agent_cards", "agent_transactions")
STATUS = {"Active": "active", "Blocked": "blocked", "Suspended": "suspended"}


class BuildError(RuntimeError):
    pass


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_source(source: Path) -> dict:
    manifest = json.loads((source / "manifest.json").read_text(encoding="utf-8"))
    for table in TABLES:
        expected = manifest["tables"][table]["sha256"]
        actual = sha256(source / f"{table}.parquet")
        if actual != expected:
            raise BuildError(f"{table}.parquet checksum mismatch: manifest {expected[:12]}, file {actual[:12]}")
    return manifest


def validate(frame: pd.DataFrame, model) -> None:
    errors = []
    for record in frame.to_dict("records"):
        clean = {k: (None if pd.isna(v) else v) for k, v in record.items() if not isinstance(v, (list, dict))}
        try:
            model.model_validate(clean)
        except Exception as error:  # pydantic.ValidationError
            errors.append(f"{model.__name__} {record.get('product_id') or record.get('transaction_id') or record.get('customer_id')}: {error}")
    if errors:
        raise BuildError(f"{len(errors)} contract violation(s); first: {errors[0]}")


def sample(customers: pd.DataFrame, cards: pd.DataFrame, tx: pd.DataFrame) -> tuple[pd.Series, dict]:
    serviceable = cards[cards["product_status"].isin(STATUS)]
    fraud_ids = set(tx.loc[tx["fraud_score"] >= FRAUD_SCORE_CUTOFF, "customer_id"])
    blocked_ids = set(serviceable.loc[serviceable["product_status"] != "Active", "customer_id"])
    counts = serviceable.groupby("customer_id").size()
    several_ids = set(counts[counts >= 2].index)
    pool = set(serviceable["customer_id"])
    chosen: list[str] = []
    taken: set[str] = set()
    strata = {}
    for name, candidates in (
        ("suspected_fraud", fraud_ids),
        ("blocked_or_suspended", blocked_ids),
        ("several_cards", several_ids),
        ("other", pool),
    ):
        ids = pd.Series(sorted((candidates & pool) - taken))
        pick = ids.sample(n=min(STRATA[name], len(ids)), random_state=SEED).tolist() if len(ids) else []
        chosen += pick
        taken |= set(pick)
        strata[name] = len(pick)
    return pd.Series(chosen), strata


def build(source: Path, out_dir: Path = OUT_DIR, fixture: Path = FIXTURE, built_at: str | None = None) -> dict:
    manifest = verify_source(source)
    customers = pd.read_parquet(source / "agent_customers.parquet")
    cards = pd.read_parquet(source / "agent_cards.parquet")
    tx = pd.read_parquet(source / "agent_transactions.parquet")

    ids, strata = sample(customers, cards, tx)
    c = customers[customers["customer_id"].isin(ids)].drop(columns=["first_name"]).sort_values("customer_id")
    k = cards[cards["customer_id"].isin(ids) & cards["product_status"].isin(STATUS)].sort_values("product_id")
    t = tx[tx["product_id"].isin(k["product_id"])].sort_values(["transaction_date", "transaction_id"])
    validate(c, AgentCustomer)
    validate(k, AgentCard)
    validate(t, AgentTransaction)

    def text(value):
        return None if value is None or (isinstance(value, float) and pd.isna(value)) or value == "" else str(value)

    snapshot = {
        "customers": [
            {"customer_id": r.customer_id, "country": r.country, "segment": text(r.segment),
             "customer_status": r.customer_status, "source": "dataset_sample"}
            for r in c.itertuples()
        ],
        "cards": [
            {"card_id": r.product_id, "customer_id": r.customer_id,
             "type": "credit" if r.product_category == "credit_card" else "debit",
             "last_four": r.card_last4, "status": STATUS[r.product_status],
             "expiration": str(r.expiration_date)[:7] if text(r.expiration_date) else None,
             "currency": r.currency, "dq_flags": text(r.dq_flags)}
            for r in k.itertuples()
        ],
        "transactions": [
            {"transaction_id": r.transaction_id, "card_id": r.product_id,
             "date": pd.Timestamp(r.transaction_date).isoformat(), "merchant": text(r.merchant_name),
             "city": text(r.transaction_city), "amount": float(r.amount), "currency": r.currency,
             "status": r.transaction_status,
             "fraud_score": None if pd.isna(r.fraud_score) else round(float(r.fraud_score), 2),
             "dq_flags": text(r.dq_flags)}
            for r in t.itertuples()
        ],
    }
    fixture_data = json.loads(fixture.read_text(encoding="utf-8"))
    for key in ("customers", "cards", "transactions"):
        snapshot[key] += fixture_data[key]

    out_dir.mkdir(parents=True, exist_ok=True)
    body = json.dumps(snapshot, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
    previous = out_dir / "snapshot.json"
    diff = diff_snapshots(json.loads(previous.read_text(encoding="utf-8")), snapshot) if previous.exists() else None
    (out_dir / "snapshot.json").write_bytes(body)
    snap_manifest = {
        "version": hashlib.sha256(body).hexdigest()[:12],
        "sha256": hashlib.sha256(body).hexdigest(),
        "built_at": built_at or datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": {"exported_at": manifest["exported_at"],
                   "tables": {t_: {"sha256": manifest["tables"][t_]["sha256"],
                                   "rows": manifest["tables"][t_]["rows"],
                                   "snowflake_query_id": manifest["tables"][t_]["snowflake_query_id"]} for t_ in TABLES}},
        "sample": {"seed": SEED, "strata": strata, "fraud_score_cutoff": FRAUD_SCORE_CUTOFF},
        "rows": {key: len(snapshot[key]) for key in ("customers", "cards", "transactions")},
        "rows_from_fixture": {key: len(fixture_data[key]) for key in ("customers", "cards", "transactions")},
        "changes_since_previous": diff,
    }
    (out_dir / "snapshot.manifest.json").write_text(json.dumps(snap_manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    return snap_manifest


def diff_snapshots(old: dict, new: dict) -> dict:
    """What changed between two snapshots: the record a reviewer checks after each refresh."""
    out = {}
    for key, id_field in (("customers", "customer_id"), ("cards", "card_id"), ("transactions", "transaction_id")):
        a = {r[id_field]: r for r in old.get(key, [])}
        b = {r[id_field]: r for r in new.get(key, [])}
        out[key] = {
            "added": sorted(set(b) - set(a)),
            "removed": sorted(set(a) - set(b)),
            "changed": sorted(i for i in set(a) & set(b) if a[i] != b[i]),
        }
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the agent snapshot from the Parquet export")
    parser.add_argument("--source", required=True, type=Path, help="folder with agent_*.parquet and manifest.json")
    args = parser.parse_args()
    try:
        result = build(args.source)
    except BuildError as error:
        print(f"BUILD STOPPED: {error}", file=sys.stderr)
        sys.exit(1)
    print(json.dumps({k: result[k] for k in ("version", "rows", "sample")}, indent=2))
    if result["changes_since_previous"]:
        print("changes:", {k: {kk: len(vv) for kk, vv in v.items()} for k, v in result["changes_since_previous"].items()})


if __name__ == "__main__":
    main()

"""Update-correctness tests for the snapshot step, on a LABELED TEST FIXTURE.

The hackathon data is static, so the brief asks to show that updates are
handled correctly with a clearly labeled fixture. Each test builds tiny
Parquet exports (v1, then v2 with known changes) in a temporary folder:

1. The same export always builds the same snapshot (deterministic, idempotent).
2. v2 -> v1 diff reports exactly the known changes: one card blocked, one new
   transaction, nothing else.
3. A Parquet file that no longer matches its manifest checksum stops the build.
4. A row that breaks the contract (a 5-digit card_last4) stops the build.

Run: python -m pytest data-engineering/pipelines/snapshot/test_snapshot.py -q
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pandas as pd
import pytest

import build_snapshot as bs

FIXTURE = Path(__file__).parent / "test_fixture.json"


def export(folder: Path, cards_status: str = "Active", extra_tx: bool = False, last4: str = "1111") -> Path:
    """Write a 3-customer Parquet export plus its manifest, the way export.py does."""
    folder.mkdir(parents=True, exist_ok=True)
    customers = pd.DataFrame([
        {"customer_id": f"CLI-T{i}", "first_name": f"Test{i}", "country": "Colombia", "segment": "Basic", "customer_status": "Active"}
        for i in range(3)
    ])
    cards = pd.DataFrame([
        {"product_id": f"PRD-T{i}", "customer_id": f"CLI-T{i}", "product_category": "credit_card",
         "product_type": "Tarjeta Crédito", "card_last4": last4 if i == 0 else f"{i}{i}{i}{i}", "currency": "COP",
         "current_balance": 10.0, "credit_limit": 100.0, "product_status": cards_status if i == 0 else "Active",
         "opening_date": "2024-01-01", "expiration_date": "2028-01-01", "has_linked_app": True,
         "days_past_due": None, "last_transaction_date": None, "dq_flags": ""}
        for i in range(3)
    ])
    rows = [{"transaction_id": f"TRX-T{i}", "transaction_date": pd.Timestamp("2026-06-01") + pd.Timedelta(hours=i),
             "product_id": f"PRD-T{i}", "customer_id": f"CLI-T{i}", "transaction_type": "Purchase",
             "transaction_category": "Food", "amount": 1000.0 + i, "currency": "COP", "amount_usd": 0.25,
             "amount_usd_method": "source", "channel": "POS", "merchant_name": "Tienda", "merchant_category": "Food",
             "transaction_country": "Colombia", "transaction_city": "Medellín", "transaction_status": "Approved",
             "response_code": "00", "is_fraud": i == 2, "fraud_score": 90.0 if i == 2 else 5.0, "dq_flags": ""}
            for i in range(3)]
    if extra_tx:
        rows.append({**rows[0], "transaction_id": "TRX-NEW", "transaction_date": pd.Timestamp("2026-06-02")})
    tx = pd.DataFrame(rows)
    tables = {}
    for name, frame in (("agent_customers", customers), ("agent_cards", cards), ("agent_transactions", tx)):
        path = folder / f"{name}.parquet"
        frame.to_parquet(path, index=False)
        tables[name] = {"rows": len(frame), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "snowflake_query_id": "fixture"}
    (folder / "manifest.json").write_text(json.dumps({"exported_at": "fixture", "tables": tables}), encoding="utf-8")
    return folder


@pytest.fixture(autouse=True)
def small_strata(monkeypatch):
    monkeypatch.setattr(bs, "STRATA", {"suspected_fraud": 5, "blocked_or_suspended": 5, "several_cards": 5, "other": 5})


def test_build_is_deterministic(tmp_path):
    src = export(tmp_path / "v1")
    a = bs.build(src, tmp_path / "out_a", FIXTURE, built_at="t")
    b = bs.build(src, tmp_path / "out_b", FIXTURE, built_at="t")
    assert a["sha256"] == b["sha256"]


def test_update_reports_exactly_the_known_changes(tmp_path):
    out = tmp_path / "out"
    bs.build(export(tmp_path / "v1"), out, FIXTURE, built_at="t1")
    result = bs.build(export(tmp_path / "v2", cards_status="Blocked", extra_tx=True), out, FIXTURE, built_at="t2")
    diff = result["changes_since_previous"]
    assert diff["cards"] == {"added": [], "removed": [], "changed": ["PRD-T0"]}
    assert diff["transactions"] == {"added": ["TRX-NEW"], "removed": [], "changed": []}
    assert diff["customers"] == {"added": [], "removed": [], "changed": []}
    snapshot = json.loads((out / "snapshot.json").read_text(encoding="utf-8"))
    assert next(c for c in snapshot["cards"] if c["card_id"] == "PRD-T0")["status"] == "blocked"


def test_tampered_export_is_refused(tmp_path):
    src = export(tmp_path / "v1")
    frame = pd.read_parquet(src / "agent_cards.parquet")
    frame.loc[0, "product_status"] = "Blocked"
    frame.to_parquet(src / "agent_cards.parquet", index=False)  # changed after the manifest was written
    with pytest.raises(bs.BuildError, match="checksum mismatch"):
        bs.build(src, tmp_path / "out", FIXTURE)


def test_contract_violation_is_refused(tmp_path):
    src = export(tmp_path / "v1", last4="12345")
    with pytest.raises(bs.BuildError, match="contract violation"):
        bs.build(src, tmp_path / "out", FIXTURE)

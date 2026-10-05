"""Load the full stage 1 export into the agent's operational store (PostgreSQL).

    Snowflake CLEAN.agent_*  ->  export.py (Parquet + manifest.json)
                             ->  load_postgres.py (this file)  ->  PostgreSQL (Neon)
                             ->  the agent's tools (Next.js server, DATABASE_URL)

The verified snapshot (pipelines/snapshot) stays as the agent's fallback when
the database is not configured or not reachable.

Steps, each one a gate (nothing is written unless all of them pass):
1. Verify every Parquet file against the SHA-256 and row count in manifest.json.
2. Validate every row against the Pydantic contracts (contracts/agent_tables.py).
   A failing row is reported and stops the load; rows are never repaired here.
3. Check the keys: unique ids, every card has its customer, every transaction
   its card and the same customer as the card.
4. Skip if the last load_run has the same manifest and fixture checksums
   (idempotent), unless --force.
5. In ONE transaction: apply schema.sql, COPY into temporary staging tables,
   replace the source tables from staging, record the load_run, re-count.
   Readers see the old data or the new data, never a mix. The card status
   audit (card_status_events) is never touched by a load.

first_name is dropped: the agent never needs it. The labeled test fixture
(test_fixture.json, team-generated) is loaded with source = 'test_fixture'.

Usage (from the repo root, with DATABASE_URL in an env file outside the repo):
    python data-engineering/pipelines/postgres/load_postgres.py --source <folder with the export> --env-file <path to .env>
    python data-engineering/pipelines/postgres/load_postgres.py --source ... --dry-run   # gates 1-3 only
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
sys.path.insert(0, str(REPO / "data-engineering"))
from contracts.agent_tables import AgentCard, AgentCustomer, AgentTransaction  # noqa: E402

SCHEMA = HERE / "schema.sql"
FIXTURE = REPO / "data-engineering/pipelines/snapshot/test_fixture.json"
LOADER_VERSION = "load_postgres/1"
TABLES = ("agent_customers", "agent_cards", "agent_transactions")

COLUMNS = {
    "customers": ["customer_id", "country", "segment", "customer_status", "source", "display_name", "security_answer"],
    "cards": ["product_id", "customer_id", "product_category", "product_type", "card_last4", "currency",
              "current_balance", "credit_limit", "product_status", "opening_date", "expiration_date",
              "has_linked_app", "days_past_due", "last_transaction_date", "dq_flags", "source", "test_hook"],
    "transactions": ["transaction_id", "transaction_date", "hours_ago", "product_id", "customer_id",
                     "transaction_type", "transaction_category", "amount", "currency", "amount_usd",
                     "amount_usd_method", "channel", "merchant_name", "merchant_category", "transaction_country",
                     "transaction_city", "transaction_status", "response_code", "is_fraud", "fraud_score",
                     "dq_flags", "source"],
}


class LoadError(RuntimeError):
    pass


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


# ---- Gate 1: checksums and row counts ------------------------------------------------------

def verify_source(source: Path) -> dict:
    manifest = json.loads((source / "manifest.json").read_text(encoding="utf-8"))
    for table in TABLES:
        expected = manifest["tables"][table]["sha256"]
        actual = sha256(source / f"{table}.parquet")
        if actual != expected:
            raise LoadError(f"{table}.parquet checksum mismatch: manifest {expected[:12]}, file {actual[:12]}")
    return manifest


def read_source(source: Path, manifest: dict) -> dict[str, pd.DataFrame]:
    frames = {t: pd.read_parquet(source / f"{t}.parquet") for t in TABLES}
    for table, frame in frames.items():
        expected = manifest["tables"][table]["rows"]
        if len(frame) != expected:
            raise LoadError(f"{table}: {len(frame)} rows in the file, manifest says {expected}")
    return frames


# ---- Gate 2: contracts --------------------------------------------------------------------

def clean(value):
    """Parquet/pandas missing values (None, NaN, NaT) become None; empty dq_flags too."""
    if value is None:
        return None
    if isinstance(value, np.generic):
        value = value.item()
    if not isinstance(value, (list, dict, Decimal)) and pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.to_pydatetime()
    return value


def validate(frame: pd.DataFrame, model) -> None:
    errors = []
    for record in frame.to_dict("records"):
        try:
            model.model_validate({k: clean(v) for k, v in record.items()})
        except Exception as error:  # pydantic.ValidationError
            key = record.get("transaction_id") or record.get("product_id") or record.get("customer_id")
            errors.append(f"{model.__name__} {key}: {error}".replace("\n", " "))
    if errors:
        raise LoadError(f"{len(errors)} contract violation(s) in {model.__name__}; first: {errors[0][:400]}")


# ---- Gate 3: keys -------------------------------------------------------------------------

def check_keys(customers: pd.DataFrame, cards: pd.DataFrame, tx: pd.DataFrame) -> None:
    for name, frame, key in (("customers", customers, "customer_id"), ("cards", cards, "product_id"),
                             ("transactions", tx, "transaction_id")):
        dupes = frame[key].duplicated().sum()
        if dupes:
            raise LoadError(f"{name}: {dupes} duplicated {key}")
    orphan_cards = ~cards["customer_id"].isin(customers["customer_id"])
    if orphan_cards.any():
        raise LoadError(f"cards: {orphan_cards.sum()} card(s) without a customer, e.g. {cards.loc[orphan_cards, 'product_id'].iloc[0]}")
    owner = cards.set_index("product_id")["customer_id"]
    card_owner = tx["product_id"].map(owner)
    if card_owner.isna().any():
        raise LoadError(f"transactions: {card_owner.isna().sum()} without a card, e.g. {tx.loc[card_owner.isna(), 'transaction_id'].iloc[0]}")
    mismatch = card_owner != tx["customer_id"]
    if mismatch.any():
        raise LoadError(f"transactions: {mismatch.sum()} whose customer is not the card's owner")


# ---- Rows to load -------------------------------------------------------------------------

def text(value):
    value = clean(value)
    return None if value == "" else value


def dataset_rows(frames: dict[str, pd.DataFrame]) -> dict[str, list[tuple]]:
    customers = frames["agent_customers"].drop(columns=["first_name"]).assign(
        source="dataset", display_name=None, security_answer=None)
    cards = frames["agent_cards"].assign(source="dataset", test_hook=None)
    tx = frames["agent_transactions"].assign(source="dataset", hours_ago=None)
    out = {}
    for name, frame in (("customers", customers), ("cards", cards), ("transactions", tx)):
        cols = COLUMNS[name]
        out[name] = [tuple(text(v) for v in row) for row in frame[cols].itertuples(index=False, name=None)]
    return out


def fixture_rows(fixture: dict) -> dict[str, list[tuple]]:
    """The labeled test fixture, written in the snapshot's shape, mapped onto the source columns."""
    owner = {c["card_id"]: c["customer_id"] for c in fixture["cards"]}
    customers = [
        (c["customer_id"], c["country"], c.get("segment"), c["customer_status"], "test_fixture",
         c.get("display_name"), c.get("security_answer"))
        for c in fixture["customers"]
    ]
    cards = [
        (k["card_id"], k["customer_id"], f"{k['type']}_card", "Test fixture", k["last_four"], k["currency"],
         None, None, k["status"].capitalize(), None,
         f"{k['expiration']}-01" if k.get("expiration") else None,
         None, None, None, k.get("dq_flags"), "test_fixture",
         "block_failure" if k.get("simulate_block_failure") else None)
        for k in fixture["cards"]
    ]
    tx = [
        (t["transaction_id"], None, t["hours_ago"], t["card_id"], owner[t["card_id"]], "Purchase", None,
         Decimal(str(t["amount"])), t["currency"], None, None, None, t.get("merchant"), None, None, t.get("city"),
         t["status"], None, None, t.get("fraud_score"), t.get("dq_flags"), "test_fixture")
        for t in fixture["transactions"]
    ]
    return {"customers": customers, "cards": cards, "transactions": tx}


# ---- Database -----------------------------------------------------------------------------

def database_url(env_file: Path | None) -> str:
    if env_file:
        if not env_file.exists():
            raise LoadError(f"env file not found: {env_file}")
        for line in env_file.read_text(encoding="utf-8").splitlines():
            key, _, value = line.strip().partition("=")
            if key == "DATABASE_URL" and value:
                os.environ.setdefault("DATABASE_URL", value.strip().strip('"').strip("'"))
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise LoadError("DATABASE_URL is not set (pass --env-file with a DATABASE_URL=... line)")
    return url


def last_run(conn) -> tuple | None:
    exists = conn.execute("SELECT to_regclass('load_runs') IS NOT NULL").fetchone()[0]
    if not exists:
        return None
    return conn.execute(
        "SELECT load_run_id, manifest_sha256, fixture_sha256, finished_at FROM load_runs ORDER BY load_run_id DESC LIMIT 1"
    ).fetchone()


def load(conn, rows: dict[str, list[tuple]], run: dict) -> dict:
    with conn.transaction():
        conn.execute(SCHEMA.read_text(encoding="utf-8"))
        run_id = conn.execute(
            """INSERT INTO load_runs (started_at, source_exported_at, manifest_sha256, fixture_sha256,
                                      source_tables, rows_loaded, loader_version)
               VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING load_run_id""",
            (run["started_at"], run["source_exported_at"], run["manifest_sha256"], run["fixture_sha256"],
             json.dumps(run["source_tables"]), json.dumps(run["rows_loaded"]), LOADER_VERSION),
        ).fetchone()[0]
        for name in ("customers", "cards", "transactions"):
            conn.execute(f"CREATE TEMP TABLE stage_{name} (LIKE {name} INCLUDING DEFAULTS) ON COMMIT DROP")
            conn.execute(f"ALTER TABLE stage_{name} ALTER COLUMN load_run_id SET DEFAULT {int(run_id)}")
            cols = COLUMNS[name]
            with conn.cursor().copy(f"COPY stage_{name} ({', '.join(cols)}) FROM STDIN") as copy:
                for row in rows[name]:
                    copy.write_row(row)
        # Replace the source tables in one step; card_status_events is not touched.
        conn.execute("TRUNCATE transactions, cards, customers")
        for name in ("customers", "cards", "transactions"):
            conn.execute(f"INSERT INTO {name} SELECT * FROM stage_{name}")
        counts = {name: conn.execute(f"SELECT count(*) FROM {name}").fetchone()[0]
                  for name in ("customers", "cards", "transactions")}
        expected = {name: len(rows[name]) for name in counts}
        if counts != expected:
            raise LoadError(f"row counts after load {counts} differ from the rows sent {expected}; rolled back")
    conn.execute("ANALYZE customers; ANALYZE cards; ANALYZE transactions")
    return {"load_run_id": run_id, "rows": counts}


def main() -> None:
    parser = argparse.ArgumentParser(description="Load the stage 1 export into PostgreSQL")
    parser.add_argument("--source", required=True, type=Path, help="folder with agent_*.parquet and manifest.json")
    parser.add_argument("--env-file", type=Path, help=".env outside the repo with DATABASE_URL=...")
    parser.add_argument("--force", action="store_true", help="load even if this export is already loaded")
    parser.add_argument("--dry-run", action="store_true", help="run the gates without touching the database")
    args = parser.parse_args()
    started = datetime.now(timezone.utc)
    t0 = time.time()
    try:
        manifest = verify_source(args.source)
        print(f"1/5 checksums and row counts match the manifest (exported {manifest['exported_at']})")
        frames = read_source(args.source, manifest)
        validate(frames["agent_customers"], AgentCustomer)
        validate(frames["agent_cards"], AgentCard)
        validate(frames["agent_transactions"], AgentTransaction)
        print(f"2/5 contracts: {sum(len(f) for f in frames.values()):,} rows valid ({time.time() - t0:.0f}s)")
        data = dataset_rows(frames)
        fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
        extra = fixture_rows(fixture)
        all_ids = {"customers": {r[0] for r in data["customers"]}, "cards": {r[0] for r in data["cards"]}}
        if any(r[0] in all_ids["customers"] for r in extra["customers"]) or any(r[0] in all_ids["cards"] for r in extra["cards"]):
            raise LoadError("a test fixture id collides with a dataset id")
        check_keys(frames["agent_customers"], frames["agent_cards"], frames["agent_transactions"])
        print("3/5 keys: unique ids, no orphan cards or transactions, fixture ids distinct")
        if args.dry_run:
            print("dry run: database not touched")
            return

        import psycopg  # only needed to load

        rows = {name: data[name] + extra[name] for name in data}
        run = {
            "started_at": started,
            "source_exported_at": manifest["exported_at"],
            "manifest_sha256": sha256(args.source / "manifest.json"),
            "fixture_sha256": sha256(FIXTURE),
            "source_tables": {t: {k: manifest["tables"][t][k] for k in ("sha256", "rows", "snowflake_query_id")} for t in TABLES},
            "rows_loaded": {name: {"dataset": len(data[name]), "test_fixture": len(extra[name])} for name in data},
        }
        with psycopg.connect(database_url(args.env_file), connect_timeout=20) as conn:
            previous = last_run(conn)
            if previous and previous[1] == run["manifest_sha256"] and previous[2] == run["fixture_sha256"] and not args.force:
                print(f"4/5 already loaded as load_run {previous[0]} at {previous[3]:%Y-%m-%d %H:%M} UTC; nothing to do (use --force to reload)")
                return
            print("4/5 new export or fixture: loading")
            result = load(conn, rows, run)
        print(f"5/5 loaded in one transaction: load_run {result['load_run_id']}, rows {result['rows']} ({time.time() - t0:.0f}s)")
    except LoadError as error:
        print(f"LOAD STOPPED: {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

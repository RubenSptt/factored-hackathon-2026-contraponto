"""Update-correctness tests for the Postgres load, on a LABELED TEST FIXTURE.

Needs a throwaway database: the tests drop and recreate the agent's tables.
Skipped unless TEST_DATABASE_URL is set, e.g.
    TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/scratch python -m pytest data-engineering/pipelines/postgres -q

1. A Parquet file that no longer matches its manifest is refused; the database is not touched.
2. Loading the same export twice is a no-op the second time (idempotent).
3. A v2 export (one card blocked at the source, one new transaction) replaces the source rows,
   and a block the agent recorded before the reload survives it (append-only audit).
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "snapshot"))
import test_snapshot  # noqa: E402  (writes a tiny Parquet export + manifest, as export.py does)

URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not URL, reason="TEST_DATABASE_URL not set")


def export(folder: Path, **kwargs) -> Path:
    source = test_snapshot.export(folder, **kwargs)
    manifest = json.loads((source / "manifest.json").read_text(encoding="utf-8"))
    manifest["exported_at"] = "2026-09-29T02:52:19+00:00"  # a real export carries its timestamp
    (source / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    return source


def run(source: Path, env_file: Path, *extra: str) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(HERE / "load_postgres.py"), "--source", str(source),
                           "--env-file", str(env_file), *extra], capture_output=True, text=True)


@pytest.fixture()
def db(tmp_path):
    import psycopg

    with psycopg.connect(URL, autocommit=True) as conn:
        conn.execute("DROP TABLE IF EXISTS transactions, cards, customers, card_status_events, load_runs CASCADE")
    env = tmp_path / ".env"
    env.write_text(f"DATABASE_URL={URL}\n", encoding="utf-8")
    with psycopg.connect(URL, autocommit=True) as conn:
        yield conn, env


def test_tampered_export_is_refused(tmp_path, db):
    conn, env = db
    source = export(tmp_path / "v1")
    (source / "agent_cards.parquet").write_bytes((source / "agent_cards.parquet").read_bytes() + b"x")
    result = run(source, env)
    assert result.returncode == 1 and "checksum mismatch" in result.stderr
    assert conn.execute("SELECT to_regclass('load_runs')").fetchone()[0] is None


def test_same_export_twice_is_a_no_op(tmp_path, db):
    conn, env = db
    source = export(tmp_path / "v1")
    assert run(source, env).returncode == 0
    second = run(source, env)
    assert second.returncode == 0 and "already loaded" in second.stdout
    assert conn.execute("SELECT count(*) FROM load_runs").fetchone()[0] == 1


def test_reload_replaces_source_and_keeps_the_audit(tmp_path, db):
    conn, env = db
    assert run(export(tmp_path / "v1"), env).returncode == 0
    conn.execute("INSERT INTO card_status_events (product_id, status, reason, actor) VALUES ('PRD-T1', 'blocked', 'customer_confirmed_block', 'agent')")
    assert run(export(tmp_path / "v2", cards_status="Blocked", extra_tx=True), env).returncode == 0
    assert conn.execute("SELECT product_status FROM cards WHERE product_id = 'PRD-T0'").fetchone()[0] == "Blocked"
    assert conn.execute("SELECT count(*) FROM transactions WHERE source = 'dataset'").fetchone()[0] == 4
    assert conn.execute("SELECT count(*) FROM card_status_events").fetchone()[0] == 1
    assert conn.execute("SELECT count(*) FROM load_runs").fetchone()[0] == 2

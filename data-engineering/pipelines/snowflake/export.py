"""Export the agent subset (CLEAN.agent_*) from Snowflake to Parquet files for the operational store load.

Writes data/agent/<table>.parquet plus data/agent/manifest.json with row counts, columns, SHA-256
checksums and the Snowflake query_id of each export, so the downstream load can verify it received
exactly what was exported. data/ is git-ignored: the files are rebuilt by rerunning the pipeline.

Usage (from data-engineering/, after run.py 03_clean.sql 04_agent_tables.sql):
    python pipelines/snowflake/export.py
"""
import hashlib
import json
from datetime import datetime, timezone

import pandas as pd

from run import PROJECT, connect, load_credentials

TABLES = ["agent_customers", "agent_cards", "agent_transactions", "agent_complaints"]
OUT_DIR = PROJECT / "data" / "agent"


def sha256(path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    load_credentials()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {"exported_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "tables": {}}
    conn = connect()
    try:
        for table in TABLES:
            with conn.cursor() as cur:
                cur.execute(f"SELECT * FROM DATATHON_DB.CLEAN.{table}")
                columns = [c[0].lower() for c in cur.description]
                frame = pd.DataFrame(cur.fetchall(), columns=columns)
                query_id = cur.sfqid
            path = OUT_DIR / f"{table}.parquet"
            frame.to_parquet(path, index=False)
            manifest["tables"][table] = {
                "rows": len(frame),
                "columns": columns,
                "sha256": sha256(path),
                "snowflake_query_id": query_id,
            }
            print(f"{table}: {len(frame):,} rows -> {path.relative_to(PROJECT)}")
    finally:
        conn.close()
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Manifest: {(OUT_DIR / 'manifest.json').relative_to(PROJECT)}")


if __name__ == "__main__":
    main()

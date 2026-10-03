"""Run the stage 1 Snowflake SQL files in order and keep an audit trail.

Every statement is executed in file order. For each one the runner logs the Snowflake query_id,
duration and row count to runs/<timestamp>/run_log.csv, and saves any result set to CSV in the
same folder. Credentials are read from an env file outside the project and are never printed.

Usage (from data-engineering/, with the virtual environment active):
    python pipelines/snowflake/run.py                      # 00, 01 and 02
    python pipelines/snowflake/run.py 02_profile_core.sql  # a single file
    python pipelines/snowflake/run.py 03_clean.sql 04_agent_tables.sql
"""
import csv
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import snowflake.connector
from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[1]
DEFAULT_FILES = ["00_schemas.sql", "01_landing_core.sql", "02_profile_core.sql"]
REQUIRED = ["SNOWFLAKE_ACCOUNT", "SNOWFLAKE_USER", "SNOWFLAKE_PASSWORD", "SNOWFLAKE_WAREHOUSE"]


def load_credentials() -> None:
    """Load the env file: $DATATHON_ENV, then ~/.config/datathon/.env, then the project .env."""
    candidates = [os.getenv("DATATHON_ENV"), Path.home() / ".config" / "datathon" / ".env", PROJECT / ".env"]
    for path in candidates:
        if path and Path(path).is_file():
            load_dotenv(path)
    missing = [name for name in REQUIRED if not os.getenv(name)]
    if missing:
        sys.exit(f"Missing variables: {', '.join(missing)}. Put them in ~/.config/datathon/.env")


def connect():
    """Open a Snowflake connection with the loaded credentials (shared with export.py)."""
    return snowflake.connector.connect(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        password=os.environ["SNOWFLAKE_PASSWORD"],
        warehouse=os.environ["SNOWFLAKE_WAREHOUSE"],
        role=os.getenv("SNOWFLAKE_ROLE"),
        database="DATATHON_DB",
    )


def split_statements(sql: str) -> list[tuple[str, str]]:
    """Split a file into (label, statement) pairs.

    Statements end with ';' at the end of a line (true for every file in this folder).
    The label is the last '-- Pxx' or '-- <table>:' comment seen before the statement.
    """
    statements, buffer, label = [], [], "setup"
    for line in sql.splitlines():
        match = re.match(r"--\s*(P\d{2}|Summary|[a-z_]+:)", line)
        if match and not buffer:
            label = match.group(1).rstrip(":")
        if not buffer and (not line.strip() or line.strip().startswith("--")):
            continue  # comments and blank lines between statements
        buffer.append(line)
        if line.rstrip().endswith(";"):
            statements.append((label, "\n".join(buffer).strip()))
            buffer = []
    if "\n".join(buffer).strip():
        statements.append((label, "\n".join(buffer).strip()))
    return statements


def main() -> None:
    files = sys.argv[1:] or DEFAULT_FILES
    load_credentials()
    out_dir = PROJECT / "runs" / datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir.mkdir(parents=True)
    log_rows = []

    conn = connect()
    try:
        for file_name in files:
            sql = (HERE / file_name).read_text(encoding="utf-8")
            for number, (label, statement) in enumerate(split_statements(sql), start=1):
                first_line = statement.splitlines()[0][:80]
                print(f"[{file_name} #{number:02d} {label}] {first_line}")
                started = time.time()
                with conn.cursor() as cur:
                    cur.execute(statement)
                    rows = cur.fetchall() if cur.description else []
                    columns = [c[0] for c in cur.description] if cur.description else []
                    query_id = cur.sfqid
                elapsed = round(time.time() - started, 1)
                result_file = ""
                if rows and not statement.upper().startswith(("USE", "CREATE", "COPY", "SET")):
                    result_file = f"{Path(file_name).stem}_{number:02d}_{label}.csv"
                    with open(out_dir / result_file, "w", newline="", encoding="utf-8") as fh:
                        writer = csv.writer(fh)
                        writer.writerow(columns)
                        writer.writerows(rows)
                print(f"    ok · {elapsed}s · {len(rows)} rows · query_id {query_id}")
                log_rows.append([file_name, number, label, query_id, elapsed, len(rows), result_file, first_line])
    finally:
        conn.close()
        with open(out_dir / "run_log.csv", "w", newline="", encoding="utf-8") as fh:
            writer = csv.writer(fh)
            writer.writerow(["file", "statement", "label", "query_id", "seconds", "rows", "result_file", "first_line"])
            writer.writerows(log_rows)
        print(f"Run log and results: {out_dir}")


if __name__ == "__main__":
    main()

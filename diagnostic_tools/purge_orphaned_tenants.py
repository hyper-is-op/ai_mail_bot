#!/usr/bin/env python3
"""
scripts/purge_orphaned_tenant_data.py

Scans all MySQL tables, Qdrant vector collections, and disk fallback files
for orphaned data belonging to client IDs that no longer exist in the `users` table.

Usage:
  # Dry-run inspection (default):
  python3 scripts/purge_orphaned_tenant_data.py

  # Perform live purge of orphaned tenant data:
  python3 scripts/purge_orphaned_tenant_data.py --purge

  # Target a specific orphaned client_id:
  python3 scripts/purge_orphaned_tenant_data.py --client CLI-4159FFCF --purge
"""

import os
import sys
import argparse

_script_dir = os.path.dirname(os.path.realpath(__file__))
if os.path.isdir(os.path.join(_script_dir, "app")):
    PROJECT_ROOT = _script_dir
else:
    PROJECT_ROOT = os.path.abspath(os.path.join(_script_dir, ".."))

if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

VENV_PYTHON = "/home/hyper_is_op/.venv/bin/python"
if os.path.exists(VENV_PYTHON) and sys.executable != VENV_PYTHON:
    try:
        import pymysql
    except ImportError:
        os.execv(VENV_PYTHON, [VENV_PYTHON] + sys.argv)

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(PROJECT_ROOT, ".env"))
except ImportError:
    pass

import pymysql
import pymysql.cursors


def get_db():
    db_port = int(os.getenv("DB_PORT", "3306"))
    return pymysql.connect(
        host=os.getenv("DB_HOST", "172.16.3.215"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASS"),
        database=os.getenv("DB_NAME", "ai_mail_bot_v2"),
        port=db_port,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        connect_timeout=10,
        autocommit=False
    )


def scan_and_purge(purge_mode: bool = False, specific_client: str = None):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            # 1. Fetch all valid active client IDs from users
            cur.execute("SELECT client_id, email, status FROM users")
            users = cur.fetchall()
            active_cids = {u["client_id"] for u in users if u["client_id"]}
            print(f"\n[ACTIVE USERS] Found {len(active_cids)} registered clients in `users`:")
            for u in users:
                print(f"  • {u['client_id']} ({u['email']}) - status: {u['status']}")

            # 2. Discover all tables with client_id
            cur.execute("""
                SELECT DISTINCT table_name
                FROM information_schema.columns
                WHERE table_schema = DATABASE() AND column_name = 'client_id'
            """)
            tables = sorted([r["TABLE_NAME"] if "TABLE_NAME" in r else r["table_name"] for r in cur.fetchall()])
            tables = [t for t in tables if t != "users"]

            print(f"\n[SCHEMA] Discovered {len(tables)} tables containing `client_id` column.")

            # 3. Find orphaned client_ids per table
            orphans_by_client = {}
            for t in tables:
                cur.execute(f"SELECT DISTINCT client_id FROM `{t}`")
                cids = {r["client_id"] for r in cur.fetchall() if r["client_id"]}
                orphans = cids - active_cids
                # Exclude pseudo-clients
                orphans = {c for c in orphans if c not in ("GLOBAL", "SYSTEM", "NONE", "null")}
                if specific_client:
                    orphans = {c for c in orphans if c == specific_client}

                for orphan in orphans:
                    cur.execute(f"SELECT count(*) as cnt FROM `{t}` WHERE client_id = %s", (orphan,))
                    count = cur.fetchone()["cnt"]
                    if count > 0:
                        orphans_by_client.setdefault(orphan, {})[t] = count

            if not orphans_by_client:
                print("\n✅ No orphaned tenant records found across any database tables.")
            else:
                print(f"\n⚠️  Found orphaned records across {len(orphans_by_client)} unregistered client IDs:")
                total_orphaned_rows = 0
                for cid, tbls in sorted(orphans_by_client.items()):
                    cid_rows = sum(tbls.values())
                    total_orphaned_rows += cid_rows
                    print(f"\n  Client ID: {cid} (Total rows: {cid_rows})")
                    for t, cnt in sorted(tbls.items()):
                        print(f"    - {t:<30}: {cnt:>5} rows")

                print(f"\nTotal orphaned rows across database: {total_orphaned_rows}")

                if purge_mode:
                    print("\n[PURGING DATABASE RECORDS]")
                    for cid, tbls in sorted(orphans_by_client.items()):
                        print(f"  Purging client {cid}...")
                        for t in tbls.keys():
                            if t == "client_email_disclaimers":
                                cur.execute("DELETE FROM `client_email_disclaimers` WHERE client_id = %s AND client_id != 'GLOBAL'", (cid,))
                            else:
                                cur.execute(f"DELETE FROM `{t}` WHERE client_id = %s", (cid,))
                        print(f"  ✔ Purged {sum(tbls.values())} rows for {cid}")
                    conn.commit()
                    print("\n✅ Successfully purged all orphaned database rows.")
                else:
                    print("\n[DRY RUN ONLY] No database changes made. Pass '--purge' to delete these records.")

            # 4. Check disk fallback files
            fallback_dir = os.path.join(PROJECT_ROOT, "knowledge_fallback")
            if os.path.exists(fallback_dir):
                print(f"\n[INSPECTING DISK FALLBACK FILES] in {fallback_dir}:")
                for fname in os.listdir(fallback_dir):
                    if fname.startswith("fallback_") and fname.endswith(".json") and fname != "fallback_db.json":
                        extracted_cid = fname.replace("fallback_", "").replace(".json", "")
                        # Match case-insensitively against active_cids
                        is_active = any(extracted_cid.lower() == c.lower() for c in active_cids)
                        if not is_active:
                            fpath = os.path.join(fallback_dir, fname)
                            size = os.path.getsize(fpath)
                            print(f"  • Orphaned fallback file: {fname} ({size} bytes)")
                            if purge_mode:
                                try:
                                    os.remove(fpath)
                                    print(f"    ✔ Deleted {fname}")
                                except Exception as fe:
                                    print(f"    ❌ Could not delete {fname}: {fe}")

            # 5. Check Qdrant vectors
            if purge_mode:
                try:
                    from app.vector_store import delete_client_data
                    for cid in orphans_by_client.keys():
                        res = delete_client_data(cid)
                        if res:
                            print(f"  ✔ Purged Qdrant vectors for {cid}")
                except Exception as qe:
                    print(f"  ⚠️ Qdrant vector purge note: {qe}")

    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="Purge orphaned tenant data across MySQL, Qdrant, and disk.")
    parser.add_argument("--purge", action="store_true", help="Execute the deletion of orphaned data (default is dry-run)")
    parser.add_argument("--client", type=str, default=None, help="Purge only a specific orphaned client_id")

    args = parser.parse_args()
    scan_and_purge(purge_mode=args.purge, specific_client=args.client)


if __name__ == "__main__":
    main()

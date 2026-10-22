#!/usr/bin/env python3
"""
scripts/restore_connector_configs.py

Autonomous restoration tool for connector configurations.
Contains pre-packaged connector templates exported from deleted tenant CLI-4159FFCF
and restores them to any specified client ID (default: CLI-4B46C071).

Handles tenant cryptographic isolation automatically:
Re-encrypts authentication secrets using HKDF derived keys for the target client_id.
"""

import os
import sys
import json
import argparse
from datetime import datetime

# ---------------------------------------------------------------------------
# 1. Environment & Virtualenv Bootstrap
# ---------------------------------------------------------------------------
_script_dir = os.path.dirname(os.path.realpath(__file__))
# If script is in scripts/ or diagnostic_tools/, parent is PROJECT_ROOT. If in root, it is PROJECT_ROOT.
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
        import cryptography
    except ImportError:
        os.execv(VENV_PYTHON, [VENV_PYTHON] + sys.argv)

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(PROJECT_ROOT, ".env"))
except ImportError:
    pass

import pymysql
import pymysql.cursors
from app.secrets_crypto import encrypt_secret, decrypt_secret

# ---------------------------------------------------------------------------
# 2. Embedded Connector Configurations (Source: CLI-4159FFCF Zoho Desk)
# ---------------------------------------------------------------------------
EXPORTED_CONFIGS = [
    {
        "trigger_type": "ticket_create",
        "http_method": "POST",
        "url": "https://desk.zoho.in/api/v1/tickets",
        "headers_template": {
            "orgId": "60085497089",
            "Content-Type": "application/json"
        },
        "request_template": {
            "contact": {
                "email": "{{from_email}}",
                "lastName": "{{customer_name}}"
            },
            "subject": "{{subject}}",
            "description": "{{conversation_history}}",
            "departmentId": "275424000000010772"
        },
        "response_mapping": {
            "ticket_id": "id",
            "priority_name": "priority",
            "ticket_status": "status"
        },
        "auth_type": "oauth2_client_credentials",
        "auth_field_name": None,
        "payload_encoding": "plain",
        "base64_query_param_name": None,
        "status": "live",
        "version": 1,
        "auth_secret_raw": json.dumps({
            "token_url": "https://accounts.zoho.in/oauth/v2/token",
            "client_id": "1000.FKAE8VQAUCH3ELY8PIXWVGLUK7S3ZG",
            "client_secret": "47bf077295ef7afcabbf52d24bf0733731c81fa101",
            "refresh_token": "1000.f94500db9694610ae3927aa58ca5ca0b.ea48a88fbab0d855293cd874116ccdd7",
            "grant_type": "refresh_token",
            "header_prefix": "Zoho-oauthtoken",
            "scope": "Desk.tickets.CREATE,Desk.tickets.READ",
            "token_auth_method": "client_secret_post"
        })
    },
    {
        "trigger_type": "ticket_status",
        "http_method": "GET",
        "url": "https://desk.zoho.in/api/v1/tickets/{{ticket_id}}",
        "headers_template": {
            "orgId": "60085497089",
            "Content-Type": "application/json"
        },
        "request_template": {},
        "response_mapping": {
            "fields": [
                {
                    "path": "ticketNumber || data[0].ticketNumber",
                    "field": "docket_no",
                    "extract_regex": None
                },
                {
                    "path": "status || data[0].status",
                    "field": "ticket_status",
                    "extract_regex": None
                },
                {
                    "path": "subject || data[0].subject",
                    "field": "subject",
                    "extract_regex": None
                },
                {
                    "path": "assignee.name || data[0].assignee.name",
                    "field": "assignee",
                    "extract_regex": None
                }
            ]
        },
        "auth_type": "oauth2_client_credentials",
        "auth_field_name": None,
        "payload_encoding": "plain",
        "base64_query_param_name": None,
        "status": "live",
        "version": 1,
        "auth_secret_raw": json.dumps({
            "token_url": "https://accounts.zoho.in/oauth/v2/token",
            "client_id": "1000.FKAE8VQAUCH3ELY8PIXWVGLUK7S3ZG",
            "client_secret": "47bf077295ef7afcabbf52d24bf0733731c81fa101",
            "refresh_token": "1000.e42311c3703c81f9d858c6e0c0055d7c.57404dc53e60e4735c34dcf6129f79ee",
            "grant_type": "refresh_token",
            "header_prefix": "Zoho-oauthtoken",
            "scope": "Desk.tickets.READ",
            "token_auth_method": "client_secret_post"
        })
    }
]


def get_db_connection():
    db_port = int(os.getenv("DB_PORT", "3306"))
    return pymysql.connect(
        host=os.getenv("DB_HOST", "172.16.3.215"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASS", "sqladmin"),
        database=os.getenv("DB_NAME", "ai_mail_bot_v2"),
        port=db_port,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False
    )


def restore_connectors(target_client_id: str, overwrite: bool = True, dry_run: bool = False):
    target_client_id = target_client_id.strip()
    if not target_client_id:
        print("❌ Error: Target Client ID cannot be empty.")
        sys.exit(1)

    print(f"\n=======================================================")
    print(f"  Connector Configuration Restore Utility")
    print(f"=======================================================")
    print(f"Target Client ID : {target_client_id}")
    print(f"Dry Run Mode     : {'YES (No changes will be saved)' if dry_run else 'NO (Live database write)'}")
    print(f"Overwrite Mode   : {overwrite}")

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # 1. Verify target client existence in users table
            cur.execute("SELECT id, client_id, email, name, status, role FROM users WHERE client_id = %s", (target_client_id,))
            user_row = cur.fetchone()
            if not user_row:
                print(f"\n⚠️  WARNING: Client ID '{target_client_id}' does not exist in 'users' table!")
                confirm = input("Proceed anyway? (y/N): ").strip().lower()
                if confirm != 'y':
                    print("Aborted.")
                    sys.exit(1)
            else:
                print(f"Target User Found: {user_row['name']} ({user_row['email']}) - Role: {user_row['role']}, Status: {user_row['status']}")

            # 2. Check existing connector configs for target client
            cur.execute("SELECT id, trigger_type, status FROM connector_configs WHERE client_id = %s", (target_client_id,))
            existing = {r["trigger_type"]: r for r in cur.fetchall()}
            if existing:
                print(f"\nFound existing connector configs for {target_client_id}:")
                for tt, info in existing.items():
                    print(f"  - {tt}: ID {info['id']}, status: {info['status']}")
                if not overwrite:
                    print("\n❌ Overwrite is set to False. Aborting to avoid collisions.")
                    sys.exit(1)
                print("Existing rows will be updated/replaced in-place.")

            # 3. Process each connector config with cryptographic re-encryption
            restored_count = 0
            for cfg in EXPORTED_CONFIGS:
                trigger_type = cfg["trigger_type"]
                print(f"\n[Processing '{trigger_type}']")

                # Encrypt secret with tenant-derived HKDF key for the target client_id
                auth_secret_raw = cfg["auth_secret_raw"]
                encrypted_secret = encrypt_secret(auth_secret_raw, client_id=target_client_id)

                # Self-test decryption immediately to prove cryptographic validity
                decrypted_check = decrypt_secret(encrypted_secret, client_id=target_client_id)
                if decrypted_check != auth_secret_raw:
                    raise RuntimeError(f"Cryptographic self-check failed for {trigger_type}!")
                print(f"  ✔ Secret successfully re-encrypted with tenant-derived HKDF key for '{target_client_id}'")

                headers_json = json.dumps(cfg["headers_template"])
                request_json = json.dumps(cfg["request_template"])
                response_json = json.dumps(cfg["response_mapping"])
                status = cfg["status"]

                if trigger_type in existing:
                    # Update existing record
                    existing_id = existing[trigger_type]["id"]
                    print(f"  Updating existing connector record ID {existing_id}...")
                    if not dry_run:
                        cur.execute("""
                            UPDATE connector_configs
                            SET http_method = %s,
                                url = %s,
                                headers_template = %s,
                                request_template = %s,
                                response_mapping = %s,
                                auth_type = %s,
                                auth_secret_encrypted = %s,
                                auth_field_name = %s,
                                payload_encoding = %s,
                                base64_query_param_name = %s,
                                status = %s,
                                version = version + 1,
                                created_by = %s,
                                approved_by = 'CLI-EE3A2268',
                                approved_at = NOW()
                            WHERE id = %s
                        """, (
                            cfg["http_method"],
                            cfg["url"],
                            headers_json,
                            request_json,
                            response_json,
                            cfg["auth_type"],
                            encrypted_secret,
                            cfg["auth_field_name"],
                            cfg["payload_encoding"],
                            cfg["base64_query_param_name"],
                            status,
                            target_client_id,
                            existing_id
                        ))
                else:
                    # Insert new record
                    print(f"  Inserting new {status} connector record...")
                    if not dry_run:
                        cur.execute("""
                            INSERT INTO connector_configs (
                                client_id, trigger_type, http_method, url,
                                headers_template, request_template, response_mapping,
                                auth_type, auth_secret_encrypted, auth_field_name,
                                payload_encoding, base64_query_param_name, status,
                                version, created_by, approved_by, approved_at
                            ) VALUES (
                                %s, %s, %s, %s,
                                %s, %s, %s,
                                %s, %s, %s,
                                %s, %s, %s,
                                %s, %s, 'CLI-EE3A2268', NOW()
                            )
                        """, (
                            target_client_id,
                            trigger_type,
                            cfg["http_method"],
                            cfg["url"],
                            headers_json,
                            request_json,
                            response_json,
                            cfg["auth_type"],
                            encrypted_secret,
                            cfg["auth_field_name"],
                            cfg["payload_encoding"],
                            cfg["base64_query_param_name"],
                            status,
                            cfg["version"],
                            target_client_id
                        ))

                restored_count += 1
                print(f"  ✔ {trigger_type} restored successfully.")

            if dry_run:
                print(f"\n[DRY RUN COMPLETE] {restored_count} connector configurations simulated. Database untouched.")
            else:
                conn.commit()
                print(f"\n[COMMITTED] Successfully restored {restored_count} connector configurations to '{target_client_id}'.")

                # Verify from DB
                cur.execute("""
                    SELECT id, client_id, trigger_type, http_method, url, status, auth_secret_encrypted
                    FROM connector_configs
                    WHERE client_id = %s
                """, (target_client_id,))
                verified_rows = cur.fetchall()
                print(f"\nVerification from MySQL Database:")
                for r in verified_rows:
                    sec_test = decrypt_secret(r["auth_secret_encrypted"], client_id=target_client_id)
                    print(f"  • ID {r['id']} | Trigger: {r['trigger_type']} | Status: {r['status']} | Decryption Verified: {'YES' if len(sec_test) > 0 else 'NO'}")

    except Exception as e:
        conn.rollback()
        print(f"\n❌ ERROR during restoration: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="Restore Zoho Desk Connector Configs to a specific Client ID")
    parser.add_argument("--target", "-t", type=str, default="CLI-4B46C071", help="Target Client ID (default: CLI-4B46C071)")
    parser.add_argument("--no-overwrite", action="store_true", help="Do not overwrite existing triggers if already present")
    parser.add_argument("--dry-run", action="store_true", help="Simulate restoration without writing to database")

    args = parser.parse_args()

    target_id = args.target
    if not target_id:
        target_id = input("Enter target client_id [CLI-4B46C071]: ").strip() or "CLI-4B46C071"

    restore_connectors(
        target_client_id=target_id,
        overwrite=not args.no_overwrite,
        dry_run=args.dry_run
    )


if __name__ == "__main__":
    main()

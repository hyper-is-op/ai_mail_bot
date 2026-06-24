import hashlib
import pymysql
import uuid
import secrets
import json
import os
from app.db import get_db

def ensure_users_table():
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    client_id VARCHAR(50) UNIQUE NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    role ENUM('admin', 'client') DEFAULT 'client',
                    status VARCHAR(20) DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
        conn.commit()
    finally:
        conn.close()

def hash_password(password: str) -> str:
    # unsalted SHA256 — fine for now, flag separately if you want it hardened later
    return hashlib.sha256(password.encode()).hexdigest()

def register_user(email, password):
    """
    Public self-registration. Role is ALWAYS 'client' — no caller-controlled role,
    no magic email, no auto-approval. Every account starts pending.
    """
    ensure_users_table()
    conn = get_db()
    client_id = "CLI-" + uuid.uuid4().hex[:8].upper()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT id FROM users WHERE email=%s", (email,))
            if cursor.fetchone():
                return {"success": False, "error": "Email already registered"}

            p_hash = hash_password(password)
            cursor.execute(
                "INSERT INTO users (client_id, email, password_hash, role, status) VALUES (%s, %s, %s, 'client', 'pending')",
                (client_id, email, p_hash)
            )
        conn.commit()

        try:
            admin_email = os.getenv("REGISTRATION_EMAIL", "monishrazammr@gmail.com")
            from app.mailer import send_email
            subject = "New User Registration Approval Request"
            body = (
                f"Hello Admin,\n\nA new user registered and is pending approval:\n"
                f"Email: {email}\n\nApprove from the admin panel (login required).\n"
            )
            send_email("registration", admin_email, subject, body)
        except Exception as mail_err:
            print(f"Error sending approval request email: {mail_err}")

        return {"success": True, "message": "Registration successful. Pending admin approval.", "client_id": client_id, "status": "pending"}
    finally:
        conn.close()

def register_admin_by_admin(email, password, creator_client_id):
    """
    The ONLY way to create an admin account: an existing admin creates one.
    No self-service admin registration exists anymore.
    """
    ensure_users_table()
    conn = get_db()
    client_id = "CLI-" + uuid.uuid4().hex[:8].upper()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT id FROM users WHERE email=%s", (email,))
            if cursor.fetchone():
                return {"success": False, "error": "Email already registered"}
            p_hash = hash_password(password)
            cursor.execute(
                "INSERT INTO users (client_id, email, password_hash, role, status) VALUES (%s, %s, %s, 'admin', 'approved')",
                (client_id, email, p_hash)
            )
        conn.commit()
        return {"success": True, "client_id": client_id}
    finally:
        conn.close()

def login_user(email, password):
    ensure_users_table()
    conn = get_db()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT id, client_id, email, role, password_hash, status FROM users WHERE email=%s", (email,))
            user = cursor.fetchone()
            if not user:
                return {"success": False, "error": "Invalid email or password"}
            if user.get("status") == "pending":
                return {"success": False, "error": "Your registration is pending approval from the admin."}
            if user["password_hash"] != hash_password(password):
                return {"success": False, "error": "Invalid email or password"}

            user_payload = {"id": user["id"], "client_id": user["client_id"], "email": user["email"], "role": user["role"]}
            token = create_session(user_payload)
            return {"success": True, "user": user_payload, "token": token}
    finally:
        conn.close()


# ==============================
# Redis-backed sessions
# ==============================
import redis as _redis

_SESSION_TTL = 7 * 24 * 3600  # 7 days

def _session_redis():
    url = os.getenv("REDIS_SESSION_URL", "redis://mail_ai_redis:6379/2")
    return _redis.from_url(url, decode_responses=True)

def create_session(user_payload: dict) -> str:
    token = secrets.token_urlsafe(32)
    r = _session_redis()
    r.set(f"session:{token}", json.dumps(user_payload), ex=_SESSION_TTL)
    return token

def get_session(token: str) -> dict | None:
    if not token:
        return None
    r = _session_redis()
    raw = r.get(f"session:{token}")
    return json.loads(raw) if raw else None

def destroy_session(token: str):
    r = _session_redis()
    r.delete(f"session:{token}")


def create_client_atomic(login_email, login_password, imap_email, imap_password,
                          score_threshold=80, response_tone="Formal"):
    """
    Admin-only: creates the login account (users, role=client, status=approved)
    AND the IMAP/feature config (email_accounts) under one new client_id,
    in a single transaction. No separate approval step needed.
    """
    ensure_users_table()
    conn = get_db()
    client_id = "CLI-" + uuid.uuid4().hex[:8].upper()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT id FROM users WHERE email=%s", (login_email,))
            if cursor.fetchone():
                return {"success": False, "error": "Login email already registered"}

            p_hash = hash_password(login_password)
            cursor.execute(
                "INSERT INTO users (client_id, email, password_hash, role, status) VALUES (%s, %s, %s, 'client', 'approved')",
                (client_id, login_email, p_hash)
            )
            cursor.execute("""
                INSERT INTO email_accounts (client_id, email, password, score_threshold, response_tone, flag)
                VALUES (%s, %s, %s, %s, %s, 1)
            """, (client_id, imap_email, imap_password, score_threshold, response_tone))
        conn.commit()

        try:
            from app.mailer import send_email
            subject = "Your Mail AI Account Has Been Created"
            body = (
                f"Hello,\n\nAn administrator has created your account.\n\n"
                f"Login email: {login_email}\nPassword: {login_password}\n\n"
                f"Log in at: http://172.16.3.215:1947/login\n\nThanks,\nMail AI Team"
            )
            send_email("registration", login_email, subject, body)
        except Exception as mail_err:
            print(f"Error sending new-client credentials email: {mail_err}")

        return {"success": True, "client_id": client_id}
    except Exception as e:
        conn.rollback()
        return {"success": False, "error": str(e)}
    finally:
        conn.close()


def get_pending_users():
    ensure_users_table()
    conn = get_db()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT id, client_id, email, role, created_at FROM users WHERE status='pending' ORDER BY created_at ASC")
            return cursor.fetchall()
    finally:
        conn.close()
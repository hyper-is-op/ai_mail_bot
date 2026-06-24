import imaplib
import email
import os
import re
import time
import logging
import sys
import threading
from email.header import decode_header as _decode_header

# Ensure /app is on sys.path when running the script directly
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app.db import get_db
from worker.tasks import process_email_task

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Active listener threads tracking
# {client_id: {"thread": Thread, "stop_event": Event, "email": str, "password": str}}
active_listeners = {}
listeners_lock = threading.Lock()


def decode_subject(raw_subject: str) -> str:
    """Decode MIME-encoded email subjects to plain text."""
    try:
        parts = _decode_header(raw_subject)
        decoded = []
        for part, encoding in parts:
            if isinstance(part, bytes):
                decoded.append(part.decode(encoding or "utf-8", errors="ignore"))
            else:
                decoded.append(part)
        return " ".join(decoded)
    except Exception:
        return raw_subject


def poll_inbox(client_id, email_user, email_pass, stop_event):
    logger.info(f"📬 Starting IMAP poll thread for Client: {client_id} ({email_user})")
    
    while not stop_event.is_set():
        try:
            logger.info(f"📡 [Client {client_id}] Connecting to Gmail IMAP...")
            mail = imaplib.IMAP4_SSL("imap.gmail.com")
            mail.login(email_user, email_pass)
            mail.select("inbox")
            logger.info(f"✅ [Client {client_id}] Connected and authenticated ({email_user})")

            while not stop_event.is_set():
                try:
                    mail.noop()
                    status, messages = mail.search(None, 'UNSEEN')
                    
                    if messages[0]:
                        unseen_count = len(messages[0].split())
                        logger.info(f"📬 [Client {client_id}] Found {unseen_count} unseen email(s)")

                        for num in messages[0].split():
                            if stop_event.is_set():
                                break
                            try:
                                status, data = mail.fetch(num, "(RFC822)")
                                if status != "OK" or not data:
                                    continue

                                raw_email = next(
                                    (item[1] for item in data if isinstance(item, tuple)),
                                    None
                                )
                                if raw_email is None:
                                    continue

                                # Mark seen before queueing
                                mail.store(num, '+FLAGS', '\\Seen')
                                msg = email.message_from_bytes(raw_email)

                                # Decode MIME-encoded subject
                                subject = decode_subject(msg.get("subject", ""))
                                from_email = msg.get("from", "")

                                # extract actual email
                                match = re.search(r'<([^>]+)>', from_email)
                                if match:
                                    from_email = match.group(1)
                                else:
                                    match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', from_email)
                                    if match:
                                        from_email = match.group(0)

                                body = ""
                                if msg.is_multipart():
                                    for part in msg.walk():
                                        if part.get_content_type() == "text/plain":
                                            body = part.get_payload(decode=True).decode(errors="ignore")
                                            break
                                else:
                                    body = msg.get_payload(decode=True).decode(errors="ignore")

                                logger.info(f"📧 [Client {client_id}] NEW EMAIL: From={from_email} Subject={subject}")
                                task_result = process_email_task.delay({
                                    "client_id": client_id,
                                    "from_email": from_email,
                                    "subject": subject,
                                    "body": body
                                })
                                logger.info(f"✅ [Client {client_id}] Task queued: {task_result.id}")

                            except Exception as e:
                                logger.error(f"Error processing single email: {e}", exc_info=True)

                    # Poll interval
                    for _ in range(10):
                        if stop_event.is_set():
                            break
                        time.sleep(1)

                except Exception as e:
                    logger.error(f"Mail polling error for Client {client_id}: {e}", exc_info=True)
                    break
            
            try:
                mail.logout()
            except:
                pass

        except Exception as e:
            logger.error(f"IMAP connection failed for Client {client_id}: {e}", exc_info=True)
            for _ in range(30):
                if stop_event.is_set():
                    break
                time.sleep(1)

    logger.info(f"🛑 Thread stopped for Client: {client_id} ({email_user})")

def fetch_db_accounts():
    """Queries all email accounts from the database."""
    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS email_accounts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                client_id VARCHAR(50) NOT NULL,
                email VARCHAR(255) NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("SELECT client_id, email, password FROM email_accounts")
        rows = cursor.fetchall()
        db.close()
        return {row[0]: {"email": row[1], "password": row[2]} for row in rows}
    except Exception as e:
        logger.error(f"Failed to fetch accounts from DB: {e}", exc_info=True)
        return {}

def manage_listeners():
    logger.info("🚀 Starting Dynamic Email Listener Manager...")
    
    while True:
        db_accounts = fetch_db_accounts()
        
        with listeners_lock:
            # Stop threads no longer in DB or credentials changed
            to_stop = []
            for client_id, active_info in active_listeners.items():
                if client_id not in db_accounts:
                    logger.info(f"⚠️ Account for {client_id} was deleted from UI. Stopping listener...")
                    to_stop.append(client_id)
                else:
                    db_info = db_accounts[client_id]
                    if (active_info["email"] != db_info["email"]) or (active_info["password"] != db_info["password"]):
                        logger.info(f"🔄 Credentials for {client_id} changed in UI. Restarting listener...")
                        to_stop.append(client_id)
            
            for client_id in to_stop:
                active_listeners[client_id]["stop_event"].set()
                active_listeners.pop(client_id)

            # Start threads for new or updated accounts
            for client_id, db_info in db_accounts.items():
                if client_id not in active_listeners:
                    stop_event = threading.Event()
                    t = threading.Thread(
                        target=poll_inbox,
                        args=(client_id, db_info["email"], db_info["password"], stop_event),
                        daemon=True
                    )
                    t.start()
                    active_listeners[client_id] = {
                        "thread": t,
                        "stop_event": stop_event,
                        "email": db_info["email"],
                        "password": db_info["password"]
                    }
                    logger.info(f"✅ Started new listener for Client {client_id}")

        time.sleep(10)

if __name__ == "__main__":
    manage_listeners()
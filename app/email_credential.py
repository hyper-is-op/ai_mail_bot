# following by hyper_is_op

import uuid
from app.db import get_db
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def save_email_account(user_id: int, email: str, password: str):
    logger.info(f"💾 Saving email account for user_id={user_id} email={email}")
    db = get_db()
    cursor = db.cursor()
    try:
        logger.info("🛠 Ensuring email_accounts table exists")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS email_accounts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                email VARCHAR(255) NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        logger.info(f"📝 Inserting record for user_id={user_id}")
        cursor.execute("""
            INSERT INTO email_accounts (user_id, email, password)
            VALUES (%s, %s, %s)
        """, (user_id, email, password))
        db.commit()
        logger.info(f"✅ Email account saved successfully for user_id={user_id}")
    except Exception as e:
        logger.error(f"❌ Failed to save email account for user_id={user_id}: {str(e)}", exc_info=True)
        raise e
    finally:
        cursor.close()
        db.close()
        logger.info("🔒 DB connection closed")


def get_email_account(user_id: int) -> dict:
    logger.info(f"🔎 Fetching email account for user_id={user_id}")
    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute("""
            SELECT user_id, email, password FROM email_accounts WHERE user_id = %s LIMIT 1
        """, (user_id,))
        row = cursor.fetchone()
        logger.info(f"📦 Query result for user_id={user_id}: {row}")
        if not row:
            logger.warning(f"⚠️ No account found for user_id={user_id}")
            return {}
        logger.info(f"✅ Account found for user_id={user_id} email={row[1]}")
        return {
            "user_id": row[0],
            "email": row[1],
            "password": row[2]
        }
    except Exception as e:
        logger.error(f"❌ Failed to fetch email account for user_id={user_id}: {str(e)}", exc_info=True)
        raise e
    finally:
        cursor.close()
        db.close()
        logger.info("🔒 DB connection closed")


def _ensure_table(cursor):
    """
    Creates ticket_record table if it does not exist.
    ticket_id is a random unique UUID.
    """
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ticket_record (
            ticket_id  VARCHAR(36)  NOT NULL PRIMARY KEY,
            user_id    INT          NOT NULL,
            mail_id    VARCHAR(100) NOT NULL,
            subject    TEXT         NOT NULL,
            body       TEXT         NOT NULL,
            status     VARCHAR(50)  NOT NULL,
            created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
    """)


def create_email_record_db(data: dict) -> dict:
    """
    Inserts one email record into ticket_record.
    Args:
        data: dict with keys user_id, mail_id, subject, body, status
    Returns:
        {"success": True,  "ticket_id": "<uuid>"}
        {"success": False, "error": <str>}
    """
    db = None
    try:
        db = get_db()
        cursor = db.cursor()
        _ensure_table(cursor)
        ticket_id = str(uuid.uuid4())  # random, unique e.g. "3f2a1b4c-..."
        cursor.execute("""
            INSERT INTO ticket_record (ticket_id, user_id, mail_id, subject, body, status)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            ticket_id,
            data["user_id"],
            data["mail_id"],
            data["subject"],
            data["body"],
            data["status"],
        ))
        db.commit()
        logger.info(f"✅ Ticket created — ticket_id={ticket_id}")
        return {"success": True, "ticket_id": ticket_id, "user_id":data["user_id"],"mail_id":data["mail_id"]}
    except Exception as e:
        logger.error(f"❌ DB insert failed: {e}", exc_info=True)
        if db:
            db.rollback()
        return {"success": False, "error": str(e)}
    finally:
        if db:
            db.close()

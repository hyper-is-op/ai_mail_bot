# following by hyper_is_op

import uuid
from app.db import get_db
import logging
from typing import Any
import json

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def save_email_account(client_id: str, email: str, password: str, score_threshold: int = 80, response_tone: str = "Formal"):
    logger.info(f"💾 Saving email account for client_id={client_id} email={email} score_threshold={score_threshold} response_tone={response_tone}")
    db = get_db()
    cursor = db.cursor()
    try:
        _ensure_accounts_table(cursor)
        logger.info(f"📝 Checking duplicate records for client_id={client_id}")
        cursor.execute("SELECT id FROM email_accounts WHERE client_id = %s LIMIT 1", (client_id,))
        row = cursor.fetchone()
        
        if row:
            logger.info(f"📝 Updating existing credentials for client_id={client_id}")
            cursor.execute("""
                UPDATE email_accounts 
                SET email = %s, password = %s, score_threshold = %s, response_tone = %s
                WHERE client_id = %s
            """, (email, password, score_threshold, response_tone, client_id))
        else:
            logger.info(f"📝 Inserting new record for client_id={client_id}")
            cursor.execute("""
                INSERT INTO email_accounts (client_id, email, password, score_threshold, response_tone)
                VALUES (%s, %s, %s, %s, %s)
            """, (client_id, email, password, score_threshold, response_tone))
            
        db.commit()
        logger.info(f"✅ Email account saved successfully for client_id={client_id}")
    except Exception as e:
        logger.error(f"❌ Failed to save email account for client_id={client_id}: {str(e)}", exc_info=True)
        raise e
    finally:
        cursor.close()
        db.close()
        logger.info("🔒 DB connection closed")


def get_email_account(client_id: str) -> dict:
    logger.info(f"🔎 Fetching email account for client_id={client_id}")
    db = get_db()
    cursor = db.cursor()
    try:
        _ensure_accounts_table(cursor)
        cursor.execute("""
            SELECT client_id, email, password, score_threshold, response_tone,
                   agent_type, department_name, company_name
            FROM email_accounts WHERE client_id = %s LIMIT 1
        """, (client_id,))
        row = cursor.fetchone()
        if not row:
            logger.warning(f"⚠️ No account found for client_id={client_id}")
            return {}
        return {
            "client_id":       row[0],
            "email":           row[1],
            "password":        row[2],
            "score_threshold": row[3] if row[3] is not None else 80,
            "response_tone":   row[4] if row[4] is not None else "Formal",
            "agent_type":      row[5] if row[5] is not None else "customer_support_agent",
            "department_name": row[6] if row[6] is not None else None,
            "company_name":    row[7] if row[7] is not None else None,
        }
    except Exception as e:
        logger.error(f"❌ Failed to fetch email account for client_id={client_id}: {str(e)}", exc_info=True)
        raise e
    finally:
        cursor.close()
        db.close()


def _ensure_accounts_table(cursor):
    pass
    # """
    # Creates email_accounts table if it does not exist.
    # """
    # cursor.execute("""
    #     CREATE TABLE IF NOT EXISTS email_accounts (
    #         id INT AUTO_INCREMENT PRIMARY KEY,
    #         client_id VARCHAR(50) NOT NULL,
    #         email VARCHAR(255) NOT NULL,
    #         password VARCHAR(255) NOT NULL,
    #         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    #     )
    # """)
    # # Deduplicate existing entries so only the latest remains
    # try:
    #     cursor.execute("""
    #         DELETE t1 FROM email_accounts t1
    #         INNER JOIN email_accounts t2 
    #         WHERE t1.id < t2.id AND t1.client_id = t2.client_id
    #     """)
    # except Exception as e:
    #     logger.warning(f"⚠️ Deduplication warning: {str(e)}")
        
    # try:
    #     cursor.execute("ALTER TABLE email_accounts CHANGE user_id client_id VARCHAR(50) NOT NULL")
    # except:
    #     pass

    # try:
    #     cursor.execute("ALTER TABLE email_accounts ADD UNIQUE INDEX (client_id)")
    # except:
    #     pass

    # try:
    #     cursor.execute("ALTER TABLE email_accounts ADD COLUMN score_threshold INT DEFAULT 80")
    # except:
    #     pass

    # try:
    #     cursor.execute("ALTER TABLE email_accounts ADD COLUMN response_tone VARCHAR(50) DEFAULT 'Formal'")
    # except:
    #     pass

def ensure_accounts_table_startup(cursor):
    """
    One-time startup call only. Creates table, adds columns, 
    adds unique index. Never called in hot path.
    """
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS email_accounts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            client_id VARCHAR(50) NOT NULL,
            email VARCHAR(255) NOT NULL,
            password VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    try:
        cursor.execute("ALTER TABLE email_accounts CHANGE user_id client_id VARCHAR(50) NOT NULL")
    except:
        pass

    try:
        cursor.execute("ALTER TABLE email_accounts ADD UNIQUE INDEX (client_id)")
    except:
        pass

    try:
        cursor.execute("ALTER TABLE email_accounts ADD COLUMN score_threshold INT DEFAULT 80")
    except:
        pass

    try:
        cursor.execute("ALTER TABLE email_accounts ADD COLUMN response_tone VARCHAR(50) DEFAULT 'Formal'")
    except:
        pass
    
    try:
        cursor.execute("ALTER TABLE email_accounts ADD COLUMN agent_type VARCHAR(50) DEFAULT 'customer_support_agent'")
    except:
        pass

    try:
        cursor.execute("ALTER TABLE email_accounts ADD COLUMN department_name VARCHAR(100) DEFAULT NULL")
    except:
        pass
    
    try:
        cursor.execute("ALTER TABLE email_accounts ADD COLUMN company_name VARCHAR(100) DEFAULT NULL")
    except:
        pass

def _ensure_table(cursor):
    """
    Creates ticket_record table if it does not exist.
    ticket_id is a random unique UUID.
    """
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ticket_record (
            ticket_id  VARCHAR(36)  NOT NULL PRIMARY KEY,
            client_id  VARCHAR(50)  NOT NULL,
            mail_id    VARCHAR(100) NOT NULL,
            subject    TEXT         NOT NULL,
            body       TEXT         NOT NULL,
            status     VARCHAR(50)  NOT NULL,
            created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
    """)
    try:
        cursor.execute("ALTER TABLE ticket_record CHANGE user_id client_id VARCHAR(50) NOT NULL")
    except:
        pass


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
            INSERT INTO ticket_record (ticket_id, client_id, mail_id, subject, body, status)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            ticket_id,
            data["client_id"],
            data["mail_id"],
            data["subject"],
            data["body"],
            data["status"],
        ))
        db.commit()
        logger.info(f"✅ Ticket created — ticket_id={ticket_id}")
        return {"success": True, "ticket_id": ticket_id, "client_id":data["client_id"],"mail_id":data["mail_id"]}
    except Exception as e:
        logger.error(f"❌ DB insert failed: {e}", exc_info=True)
        if db:
            db.rollback()
        return {"success": False, "error": str(e)}
    finally:
        if db:
            db.close()



#on 15 May 2025 by hyper_is_op


# def ensure_create_payload_table():
#     """
#     Creates the `create_payload_table` table if it doesn't already exist.
#     Safe to call multiple times (uses IF NOT EXISTS).
#     """
#     db = get_db()
#     try:
#         with db.cursor() as cursor:
#             cursor.execute("""
#                 CREATE TABLE IF NOT EXISTS create_payload_table (
#                     id               INT AUTO_INCREMENT PRIMARY KEY,
#                     client_id        VARCHAR(50) NOT NULL,
#                     url       VARCHAR(255),
#                     paylod      TEXT,
#                     created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
#                 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
#             """)
#             # Deduplicate existing entries
#             try:
#                 cursor.execute("""
#                     DELETE t1 FROM create_payload_table t1
#                     INNER JOIN create_payload_table t2 
#                     WHERE t1.id < t2.id AND t1.client_id = t2.client_id
#                 """)
#             except:
#                 pass
            
#             try:
#                 cursor.execute("ALTER TABLE create_payload_table CHANGE user_id client_id VARCHAR(50) NOT NULL, DROP PRIMARY KEY, ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST")
#             except:
#                 pass
            
#             try:
#                 cursor.execute("ALTER TABLE create_payload_table ADD UNIQUE INDEX (client_id)")
#             except:
#                 pass
#         db.commit()
#         logger.info("✅ create_payload_table table ensured")
#     except Exception as e:
#         logger.error(f"❌ Failed to create create_payload_table table: {e}", exc_info=True)
#         raise
#     finally:
#         db.close()
def ensure_create_payload_table():
    db = get_db()
    try:
        with db.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS create_payload_table (
                    id          INT AUTO_INCREMENT PRIMARY KEY,
                    client_id   VARCHAR(50) NOT NULL,
                    url         VARCHAR(255),
                    paylod      TEXT,
                    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            try:
                cursor.execute("ALTER TABLE create_payload_table ADD UNIQUE INDEX (client_id)")
            except:
                pass
        db.commit()
        logger.info("✅ create_payload_table ensured")
    except Exception as e:
        logger.error(f"❌ Failed to ensure create_payload_table: {e}", exc_info=True)
        raise
    finally:
        db.close()

def insert_create_payload_ticket(client_id: str, url: str, paylod: dict[str, Any]) -> str:
    db = get_db()
    try:
        ensure_create_payload_table()
        with db.cursor() as cursor:
            cursor.execute("SELECT id FROM create_payload_table WHERE client_id = %s LIMIT 1", (client_id,))
            row = cursor.fetchone()
            if row:
                cursor.execute("""
                    UPDATE create_payload_table 
                    SET url = %s, paylod = %s
                    WHERE client_id = %s
                """, (url, json.dumps(paylod), client_id))
            else:
                cursor.execute("""
                    INSERT INTO create_payload_table (client_id, url, paylod)
                    VALUES (%s, %s, %s)
                """, (client_id, url, json.dumps(paylod)))
            db.commit()
            logger.info(f"✅ create_payload_table inserted — client_id={client_id}")
            return client_id
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Failed to insert payload: {e}", exc_info=True)
        raise
    finally:
        db.close()
        
        
def get_create_payload_table(client_id: str) -> dict:
    db = get_db()
    try:
        with db.cursor() as cursor:
            cursor.execute("""
                SELECT url, paylod 
                FROM create_payload_table WHERE client_id = %s LIMIT 1
            """, (client_id,))
            row = cursor.fetchone()
        if not row:
            logger.warning(f"⚠️ No create_payload_table found for client_id={client_id}")
            return {}
        return {
            "url":      row[0],
            "paylod":     json.loads(row[1])
        }
    except Exception as e:
        logger.error(f"❌ Failed to fetch payload: {e}", exc_info=True)
        raise
    finally:
        db.close()
        
#on 19 May 2025 by hyper_is_op
        

# def ensure_payload_get_ticket_table():
#     """
#     Creates the `payload_get_table` table if it doesn't already exist.
#     Safe to call multiple times (uses IF NOT EXISTS).
#     """
#     db = get_db()
#     try:
#         with db.cursor() as cursor:
#             cursor.execute("""
#                 CREATE TABLE IF NOT EXISTS payload_get_table (
#                     id               INT AUTO_INCREMENT PRIMARY KEY,
#                     client_id        VARCHAR(50) NOT NULL,
#                     url       VARCHAR(255),
#                     paylod      TEXT,
#                     created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
#                 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
#             """)
#             # Deduplicate existing entries
#             try:
#                 cursor.execute("""
#                     DELETE t1 FROM payload_get_table t1
#                     INNER JOIN payload_get_table t2 
#                     WHERE t1.id < t2.id AND t1.client_id = t2.client_id
#                 """)
#             except:
#                 pass
                
#             try:
#                 cursor.execute("ALTER TABLE payload_get_table CHANGE user_id client_id VARCHAR(50) NOT NULL, DROP PRIMARY KEY, ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST")
#             except:
#                 pass
                
#             try:
#                 cursor.execute("ALTER TABLE payload_get_table ADD UNIQUE INDEX (client_id)")
#             except:
#                 pass
#         db.commit()
#         logger.info("✅ payload_get_table table ensured")
#     except Exception as e:
#         logger.error(f"❌ Failed to create payload_get_table table: {e}", exc_info=True)
#         raise
#     finally:
#         db.close()
def ensure_payload_get_ticket_table():
    db = get_db()
    try:
        with db.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS payload_get_table (
                    id          INT AUTO_INCREMENT PRIMARY KEY,
                    client_id   VARCHAR(50) NOT NULL,
                    url         VARCHAR(255),
                    paylod      TEXT,
                    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            try:
                cursor.execute("ALTER TABLE payload_get_table ADD UNIQUE INDEX (client_id)")
            except:
                pass
        db.commit()
        logger.info("✅ payload_get_table ensured")
    except Exception as e:
        logger.error(f"❌ Failed to ensure payload_get_table: {e}", exc_info=True)
        raise
    finally:
        db.close()


def insert_payload_get_ticket(client_id: str, url: str, paylod: dict[str, Any]) -> str:
    db = get_db()
    try:
        ensure_payload_get_ticket_table()
        with db.cursor() as cursor:
            cursor.execute("SELECT id FROM payload_get_table WHERE client_id = %s LIMIT 1", (client_id,))
            row = cursor.fetchone()
            if row:
                cursor.execute("""
                    UPDATE payload_get_table 
                    SET url = %s, paylod = %s
                    WHERE client_id = %s
                """, (url, json.dumps(paylod), client_id))
            else:
                cursor.execute("""
                    INSERT INTO payload_get_table (client_id, url, paylod)
                    VALUES (%s, %s, %s)
                """, (client_id, url, json.dumps(paylod)))
            db.commit()
            logger.info(f"✅ payload_get_table inserted — client_id={client_id}")
            return client_id
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Failed to insert payload: {e}", exc_info=True)
        raise
    finally:
        db.close()


def get_payload_get_ticket_table(client_id: str) -> dict:
    db = get_db()
    try:
        with db.cursor() as cursor:
            cursor.execute("""
                SELECT url, paylod 
                FROM payload_get_table WHERE client_id = %s LIMIT 1
            """, (client_id,))
            row = cursor.fetchone()
        if not row:
            logger.warning(f"⚠️ No payload_get_table found for client_id={client_id}")
            return {}
        return {
            "url":      row[0],
            "paylod":     json.loads(row[1])
        }
    except Exception as e:
        logger.error(f"❌ Failed to fetch payload: {e}", exc_info=True)
        raise
    finally:
        db.close()


def get_budget_status(client_id, cursor):
    """
    Returns current-month spend vs budget for a client.
    status: 'unlimited' (no budget set) | 'ok' | 'warning' (>=90%) | 'exceeded' (>=100%)
    Never blocks anything — purely informational.
    """
    cursor.execute("SELECT monthly_budget_usd FROM email_accounts WHERE client_id=%s", (client_id,))
    row = cursor.fetchone()
    budget = float(row[0]) if row and row[0] is not None else None

    cursor.execute("""
        SELECT COALESCE(SUM(billed_cost), 0) FROM llm_logs
        WHERE client_id=%s AND MONTH(created_at)=MONTH(CURDATE()) AND YEAR(created_at)=YEAR(CURDATE())
    """, (client_id,))
    spent = float(cursor.fetchone()[0] or 0)

    if budget is None:
        return {"budget": None, "spent": round(spent, 4), "percent": None, "status": "unlimited"}

    percent = (spent / budget * 100) if budget > 0 else 0
    if percent >= 100:
        status = "exceeded"
    elif percent >= 90:
        status = "warning"
    else:
        status = "ok"

    return {"budget": budget, "spent": round(spent, 4), "percent": round(percent, 1), "status": status}


def get_all_create_payloads() -> list[dict]:
    db = get_db()
    try:
        with db.cursor() as cursor:
            cursor.execute("""
                SELECT p.client_id, p.url, p.paylod, a.email 
                FROM create_payload_table p
                LEFT JOIN email_accounts a ON p.client_id = a.client_id
            """)
            rows = cursor.fetchall()
        result = []
        for r in rows:
            try:
                pay = json.loads(r[2]) if r[2] else {}
            except Exception:
                pay = r[2]
            result.append({
                "client_id": r[0],
                "url": r[1],
                "paylod": pay,
                "email": r[3] or r[0]
            })
        return result
    except Exception as e:
        logger.error(f"❌ Failed to fetch all create payloads: {e}", exc_info=True)
        return []
    finally:
        db.close()


def get_all_get_payloads() -> list[dict]:
    db = get_db()
    try:
        with db.cursor() as cursor:
            cursor.execute("""
                SELECT p.client_id, p.url, p.paylod, a.email 
                FROM payload_get_table p
                LEFT JOIN email_accounts a ON p.client_id = a.client_id
            """)
            rows = cursor.fetchall()
        result = []
        for r in rows:
            try:
                pay = json.loads(r[2]) if r[2] else {}
            except Exception:
                pay = r[2]
            result.append({
                "client_id": r[0],
                "url": r[1],
                "paylod": pay,
                "email": r[3] or r[0]
            })
        return result
    except Exception as e:
        logger.error(f"❌ Failed to fetch all get payloads: {e}", exc_info=True)
        return []
    finally:
        db.close()
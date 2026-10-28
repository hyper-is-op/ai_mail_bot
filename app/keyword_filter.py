import re
import logging

logger = logging.getLogger(__name__)


def _ensure_blocked_keywords_table(cursor):
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS blocked_keywords (
            id INT AUTO_INCREMENT PRIMARY KEY,
            client_id VARCHAR(50) NOT NULL,
            keyword VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_client_keyword (client_id, keyword)
        )
    """)


def _ensure_blocked_keyword_exceptions_table(cursor):
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS blocked_keyword_exceptions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            client_id VARCHAR(50) NOT NULL,
            keyword VARCHAR(255) NOT NULL,
            allowed_phrase VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_client_kw_phrase (client_id, keyword, allowed_phrase),
            INDEX idx_kw_exceptions_client (client_id, keyword)
        )
    """)


def _ensure_reply_blocked_table(cursor):
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reply_blocked_by_keyword (
            id INT AUTO_INCREMENT PRIMARY KEY,
            client_id VARCHAR(50) NOT NULL,
            from_email VARCHAR(255) NOT NULL,
            subject TEXT,
            body TEXT,
            matched_keyword VARCHAR(255) NOT NULL,
            status ENUM('pending_review', 'ignored', 'replied') DEFAULT 'pending_review',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    """)


def get_blocked_keywords(cursor, client_id: str) -> list:
    cursor.execute(
        "SELECT keyword FROM blocked_keywords WHERE client_id = %s",
        (client_id,)
    )
    return [r[0] for r in cursor.fetchall()]


def get_blocked_keyword_exceptions(cursor, client_id: str) -> dict:
    """Returns {keyword_lower: [allowed_phrase_lower, ...]} for this client."""
    cursor.execute(
        "SELECT keyword, allowed_phrase FROM blocked_keyword_exceptions WHERE client_id = %s",
        (client_id,)
    )
    res = {}
    for kw, phrase in cursor.fetchall():
        if kw and kw.strip() and phrase and phrase.strip():
            res.setdefault(kw.lower().strip(), []).append(phrase.lower().strip())
    return res


def is_blocked(text: str, keywords: list, exceptions: dict = None) -> str | None:
    """Returns the matched keyword using word-boundary matching, unless an allowed phrase matches."""
    text_lower = text.lower()
    for kw in keywords:
        pattern = r'\b' + re.escape(kw.lower()) + r'\b'
        if re.search(pattern, text_lower):
            if exceptions and kw.lower() in exceptions:
                allowed_phrases = exceptions[kw.lower()]
                if any(phrase and phrase.strip() and phrase.strip().lower() in text_lower for phrase in allowed_phrases):
                    logger.info(f"ℹ️ Keyword '{kw}' matched but bypassed due to allowed exception phrase in text")
                    continue
            return kw
    return None


def insert_blocked_email(cursor, client_id, from_email, subject, body, matched_keyword, status='pending_review'):
    """Inserts a blocked email record with status."""
    cursor.execute("""
        INSERT INTO reply_blocked_by_keyword
            (client_id, from_email, subject, body, matched_keyword, status)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (client_id, from_email, subject, body, matched_keyword, status))
    return cursor.lastrowid



_ensure_table = _ensure_blocked_keywords_table


def ensure_keyword_filter_tables(cursor):
    _ensure_blocked_keywords_table(cursor)
    _ensure_blocked_keyword_exceptions_table(cursor)
    _ensure_reply_blocked_table(cursor)
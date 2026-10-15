"""
app/prompt_service.py

Service layer for fetching, persisting, resetting, and formatting
client-specific LLM prompts with fail-safe fallbacks.
"""

import logging
from typing import Dict, Any, List, Optional
from app.db import get_db_ctx
from app.prompt_defaults import PROMPT_DEFINITIONS, MULTILINGUAL_DIRECTIVE

logger = logging.getLogger(__name__)


def ensure_client_prompt_configs_table():
    """Ensure the client_prompt_configs MySQL table exists."""
    try:
        with get_db_ctx() as db:
            with db.cursor() as cursor:
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS client_prompt_configs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    client_id VARCHAR(64) NOT NULL,
                    prompt_key VARCHAR(64) NOT NULL,
                    prompt_text MEDIUMTEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_client_prompt (client_id, prompt_key)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                """)
            db.commit()
        logger.info("✅ client_prompt_configs table verified successfully")
    except Exception as e:
        logger.error(f"❌ Failed to ensure client_prompt_configs table: {e}")


def get_prompt_template(client_id: Optional[str], prompt_key: str) -> str:
    """
    Retrieves the raw prompt template for a given prompt_key.
    Checks MySQL for client-specific overrides; falls back to PROMPT_DEFINITIONS.
    """
    default_entry = PROMPT_DEFINITIONS.get(prompt_key)
    default_text = default_entry["default"] if default_entry else ""

    if not client_id or client_id == "SYSTEM":
        return default_text

    try:
        with get_db_ctx() as db:
            with db.cursor() as cursor:
                cursor.execute(
                    "SELECT prompt_text FROM client_prompt_configs WHERE client_id = %s AND prompt_key = %s LIMIT 1",
                    (client_id, prompt_key)
                )
                row = cursor.fetchone()
                if row and row[0] and row[0].strip():
                    return row[0].strip()
    except Exception as e:
        logger.warning(f"⚠️ Could not load custom prompt '{prompt_key}' for client '{client_id}': {e}. Using code default.")

    return default_text


def format_prompt(client_id: Optional[str], prompt_key: str, **kwargs) -> str:
    """
    Loads prompt template and safely formats it with provided kwargs.
    If a variable is missing or formatting fails, returns a safe representation.
    """
    raw_template = get_prompt_template(client_id, prompt_key)
    if not raw_template:
        return ""

    try:
        # Format safely allowing missing keys to remain or be empty
        class SafeDict(dict):
            def __missing__(self, key):
                return f"{{{key}}}"

        formatted = raw_template.format_map(SafeDict(**kwargs))
        return formatted
    except Exception as e:
        logger.error(f"❌ Error formatting prompt '{prompt_key}': {e}")
        return raw_template


def list_prompts_for_client(client_id: Optional[str]) -> List[Dict[str, Any]]:
    """
    Returns the catalog of all 11 prompts with current text and custom status.
    """
    custom_overrides = {}
    if client_id and client_id != "SYSTEM":
        try:
            with get_db_ctx() as db:
                with db.cursor() as cursor:
                    cursor.execute(
                        "SELECT prompt_key, prompt_text, updated_at FROM client_prompt_configs WHERE client_id = %s",
                        (client_id,)
                    )
                    rows = cursor.fetchall()
                    for r in rows:
                        custom_overrides[r[0]] = {
                            "text": r[1],
                            "updated_at": str(r[2]) if r[2] else None
                        }
        except Exception as e:
            logger.error(f"❌ Error reading custom prompts for client '{client_id}': {e}")

    result = []
    for key, item in PROMPT_DEFINITIONS.items():
        custom_data = custom_overrides.get(key)
        is_custom = custom_data is not None and bool(custom_data.get("text"))
        active_text = custom_data["text"] if is_custom else item["default"]

        result.append({
            "key": key,
            "title": item["title"],
            "description": item["description"],
            "variables": item["variables"],
            "default_text": item["default"],
            "active_text": active_text,
            "is_custom": is_custom,
            "updated_at": custom_data.get("updated_at") if custom_data else None
        })
    return result


def save_client_prompt(client_id: str, prompt_key: str, prompt_text: str) -> bool:
    """
    Saves or updates a custom prompt override for a client in MySQL.
    """
    if prompt_key not in PROMPT_DEFINITIONS:
        raise ValueError(f"Unknown prompt key: '{prompt_key}'")

    if not prompt_text or not prompt_text.strip():
        # Empty text resets to default
        return reset_client_prompt(client_id, prompt_key)

    try:
        with get_db_ctx() as db:
            with db.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO client_prompt_configs (client_id, prompt_key, prompt_text)
                    VALUES (%s, %s, %s)
                    ON DUPLICATE KEY UPDATE prompt_text = VALUES(prompt_text), updated_at = CURRENT_TIMESTAMP
                """, (client_id, prompt_key, prompt_text.strip()))
            db.commit()
        logger.info(f"✅ Successfully saved custom prompt '{prompt_key}' for client '{client_id}'")
        return True
    except Exception as e:
        logger.error(f"❌ Failed saving custom prompt '{prompt_key}' for client '{client_id}': {e}")
        raise


def reset_client_prompt(client_id: str, prompt_key: str) -> bool:
    """
    Resets a single prompt to default by deleting the MySQL override record.
    """
    try:
        with get_db_ctx() as db:
            with db.cursor() as cursor:
                cursor.execute(
                    "DELETE FROM client_prompt_configs WHERE client_id = %s AND prompt_key = %s",
                    (client_id, prompt_key)
                )
            db.commit()
        logger.info(f"🔄 Successfully reset prompt '{prompt_key}' to default for client '{client_id}'")
        return True
    except Exception as e:
        logger.error(f"❌ Failed resetting prompt '{prompt_key}' for client '{client_id}': {e}")
        raise


def reset_all_client_prompts(client_id: str) -> bool:
    """
    Resets all prompts to factory default for a given client.
    """
    try:
        with get_db_ctx() as db:
            with db.cursor() as cursor:
                cursor.execute(
                    "DELETE FROM client_prompt_configs WHERE client_id = %s",
                    (client_id,)
                )
            db.commit()
        logger.info(f"🔄 Successfully reset ALL prompts to default for client '{client_id}'")
        return True
    except Exception as e:
        logger.error(f"❌ Failed resetting all prompts for client '{client_id}': {e}")
        raise

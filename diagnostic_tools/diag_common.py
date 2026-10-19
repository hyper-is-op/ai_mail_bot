#!/usr/bin/env python3
"""
Common utilities and environment bootstrap for diagnostic tools.
Handles dual-mode execution (host .venv vs container), database connectivity,
Redis inspection, and rich ANSI terminal formatting.
"""

import os
import sys
import json
import subprocess
import re
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple
from contextlib import contextmanager

# ---------------------------------------------------------------------------
# 1. Environment and Interpreter Bootstrap
# ---------------------------------------------------------------------------
def ensure_venv():
    """
    If running on host under system Python lacking dependencies, transparently
    re-execute using the project's virtualenv.
    """
    venv_python = "/home/hyper_is_op/.venv/bin/python"
    if os.path.exists(venv_python) and sys.executable != venv_python:
        try:
            import pymysql
            import dbutils
        except ImportError:
            if sys.argv and not sys.argv[0].startswith("-"):
                os.execv(venv_python, [venv_python] + sys.argv)



# Locate and load .env file
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

try:
    from dotenv import load_dotenv
    env_path = os.path.join(PROJECT_ROOT, ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)
    else:
        load_dotenv()
except ImportError:
    pass

# ---------------------------------------------------------------------------
# 2. Database Connectivity
# ---------------------------------------------------------------------------
@contextmanager
def get_db_cursor():
    """
    Yields a cursor connected to the database with fallback options.
    Prefers project's app.db.get_db_ctx() if available, else direct pymysql.
    """
    try:
        from app.db import get_db_ctx
        with get_db_ctx() as conn:
            with conn.cursor() as cur:
                yield cur
    except Exception:
        # Fallback to direct pymysql connection using environment variables
        import pymysql
        host = os.getenv("DB_HOST", "172.16.3.215")
        user = os.getenv("DB_USER", "root")
        password = os.getenv("DB_PASS", "sqladmin")
        dbname = os.getenv("DB_NAME", "ai_mail_bot_v2")
        port = int(os.getenv("DB_PORT", "3306"))
        
        conn = pymysql.connect(
            host=host,
            user=user,
            password=password,
            database=dbname,
            port=port,
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor if False else pymysql.cursors.Cursor
        )
        try:
            with conn.cursor() as cur:
                yield cur
        finally:
            conn.close()

# ---------------------------------------------------------------------------
# 3. Redis Connectivity & Inspection
# ---------------------------------------------------------------------------
def query_redis_keys(pattern: str, db_num: int = 1) -> List[str]:
    """
    Queries Redis keys matching pattern on given DB index.
    Attempts direct redis-py first; falls back to docker exec if Redis port is isolated.
    """
    # Attempt 1: Direct redis library
    try:
        import redis
        redis_host = os.getenv("REDIS_HOST", "127.0.0.1")
        r = redis.Redis(host=redis_host, port=6379, db=db_num, socket_timeout=1.0)
        keys = r.keys(pattern)
        return [k.decode("utf-8", errors="replace") if isinstance(k, bytes) else str(k) for k in keys]
    except Exception:
        pass

    # Attempt 2: docker exec mail_ai_redis redis-cli
    try:
        res = subprocess.run(
            ["docker", "exec", "mail_ai_redis", "redis-cli", "-n", str(db_num), "keys", pattern],
            capture_output=True, text=True, timeout=3
        )
        if res.returncode == 0:
            lines = [line.strip() for line in res.stdout.strip().splitlines() if line.strip()]
            return lines
    except Exception:
        pass

    return []

def get_redis_thread_history(client_id: str, thread_id: str) -> Dict[str, Any]:
    """
    Retrieves cached conversation history and TTL for a thread from Redis DB 1.
    """
    tid = thread_id if thread_id.startswith("th_") else f"th_{thread_id}"
    key = f"chat_history:{client_id}:{tid}"
    
    # Try redis-py
    try:
        import redis
        redis_host = os.getenv("REDIS_HOST", "127.0.0.1")
        r = redis.Redis(host=redis_host, port=6379, db=1, socket_timeout=1.0)
        if r.exists(key):
            ttl = r.ttl(key)
            raw = r.get(key)
            data = json.loads(raw) if raw else []
            return {"found": True, "key": key, "ttl_seconds": ttl, "messages": data}
    except Exception:
        pass

    # Try docker exec
    try:
        res = subprocess.run(
            ["docker", "exec", "mail_ai_redis", "redis-cli", "-n", "1", "TTL", key],
            capture_output=True, text=True, timeout=3
        )
        ttl = int(res.stdout.strip()) if res.returncode == 0 and res.stdout.strip().lstrip("-").isdigit() else -2
        
        if ttl >= 0:
            res_val = subprocess.run(
                ["docker", "exec", "mail_ai_redis", "redis-cli", "-n", "1", "GET", key],
                capture_output=True, text=True, timeout=3
            )
            val = res_val.stdout.strip()
            data = json.loads(val) if val and val != "(nil)" else []
            return {"found": True, "key": key, "ttl_seconds": ttl, "messages": data}
    except Exception:
        pass

    return {"found": False, "key": key, "ttl_seconds": -2, "messages": []}

# ---------------------------------------------------------------------------
# 4. ANSI Styling & Formatting
# ---------------------------------------------------------------------------
class Color:
    RESET   = "\033[0m"
    BOLD    = "\033[1m"
    DIM     = "\033[2m"
    ITALIC  = "\033[3m"
    UNDER   = "\033[4m"

    # Foreground
    BLACK   = "\033[30m"
    RED     = "\033[31m"
    GREEN   = "\033[32m"
    YELLOW  = "\033[33m"
    BLUE    = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN    = "\033[36m"
    WHITE   = "\033[37m"

    # Bright Foreground
    BRIGHT_RED     = "\033[91m"
    BRIGHT_GREEN   = "\033[92m"
    BRIGHT_YELLOW  = "\033[93m"
    BRIGHT_BLUE    = "\033[94m"
    BRIGHT_MAGENTA = "\033[95m"
    BRIGHT_CYAN    = "\033[96m"
    BRIGHT_WHITE   = "\033[97m"

    # Background
    BG_BLUE    = "\033[44m"
    BG_MAGENTA = "\033[45m"
    BG_DARK    = "\033[40m"


def header(title: str, width: int = 80) -> str:
    """Formats a full-width section header."""
    bar = "=" * width
    return f"\n{Color.BOLD}{Color.BRIGHT_CYAN}{bar}\n  {title}\n{bar}{Color.RESET}"

def subheader(title: str, width: int = 80) -> str:
    """Formats a subsection header."""
    bar = "-" * width
    return f"\n{Color.BOLD}{Color.BRIGHT_BLUE}── {title} {'─' * max(0, width - len(title) - 4)}{Color.RESET}"

def badge(text: str, color_code: str) -> str:
    """Returns a highlighted tag badge."""
    return f"{color_code}{Color.BOLD}[ {text} ]{Color.RESET}"

def status_badge(status: str) -> str:
    """Returns a color-coded status badge."""
    s = (status or "").lower()
    if s in ("sent", "auto_send", "completed", "resolved", "approved"):
        return badge(status.upper(), Color.BRIGHT_GREEN)
    elif s in ("ticket_created_and_sent", "escalated", "ticket_created"):
        return badge(status.upper(), Color.BRIGHT_YELLOW)
    elif s in ("no_action_needed", "dropped", "discarded", "rejected"):
        return badge(status.upper(), Color.BRIGHT_RED)
    elif s in ("pending", "processing", "draft_pending"):
        return badge(status.upper(), Color.BRIGHT_CYAN)
    else:
        return badge(status.upper(), Color.WHITE)

def format_datetime(dt) -> str:
    """Formats datetime gracefully."""
    if not dt:
        return "-"
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    return str(dt)

def truncate(text: str, length: int = 120) -> str:
    """Truncates text with ellipsis."""
    if not text:
        return "-"
    t = str(text).replace("\r", " ").replace("\n", " ").strip()
    return t if len(t) <= length else t[:length - 3] + "..."

_ANSI_RE = re.compile(r'\033\[[0-9;]*m')

def strip_ansi(text: str) -> str:
    """Strips ANSI escape sequences from text for accurate visible length calculation."""
    return _ANSI_RE.sub('', text)

def ljust_ansi(text: str, width: int) -> str:
    """Left-aligns text to width, accounting for non-printable ANSI escape sequences."""
    visible_len = len(strip_ansi(text))
    padding = max(0, width - visible_len)
    return text + (" " * padding)

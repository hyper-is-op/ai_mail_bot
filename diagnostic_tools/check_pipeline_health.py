#!/usr/bin/env python3
"""
Diagnostic Pipeline Health Auditor CLI for Email Bot.
Probes and benchmarks every operational subsystem:
- MySQL database pool & table counts
- Redis DB 0 (Celery broker) and Redis DB 1 (Chat history)
- Qdrant Vector Store & collection points
- Embedding service (port 8500) latency & vector dimensions
- Celery worker & listener container health
"""

import sys
import os
import time
import subprocess

# Early environment and interpreter bootstrap before custom/third-party imports
_VENV_PYTHON = "/home/hyper_is_op/.venv/bin/python"
if os.path.exists(_VENV_PYTHON) and sys.executable != _VENV_PYTHON:
    try:
        import requests
        import pymysql
    except ImportError:
        if sys.argv and not sys.argv[0].startswith("-"):
            os.execv(_VENV_PYTHON, [_VENV_PYTHON] + sys.argv)

import requests
from typing import Dict, Any

# Ensure project root is in sys.path
_HERE = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.abspath(os.path.join(_HERE, ".."))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from diagnostic_tools.diag_common import (
    ensure_venv,
    get_db_cursor,
    query_redis_keys,
    Color,
    header,
    subheader,
    badge
)

def check_mysql() -> Dict[str, Any]:
    res = {"name": "MySQL Database", "status": "FAIL", "latency_ms": 0.0, "details": {}}
    start = time.perf_counter()
    try:
        with get_db_cursor() as cur:
            cur.execute("SELECT 1")
            res["latency_ms"] = round((time.perf_counter() - start) * 1000, 2)
            res["status"] = "PASS"

            # Table counts
            for tbl in ["email_logs", "llm_logs", "draft_emails", "action_logs", "chat_history"]:
                try:
                    cur.execute(f"SELECT COUNT(*) FROM {tbl}")
                    res["details"][tbl] = cur.fetchone()[0]
                except Exception:
                    res["details"][tbl] = "error"
    except Exception as e:
        res["error"] = str(e)
    return res


def check_redis() -> Dict[str, Any]:
    res = {
        "name": "Redis (Broker & History)",
        "db0_status": "FAIL",
        "db1_status": "FAIL",
        "cached_threads": 0
    }
    # Check DB 0 via redis-cli / docker exec
    try:
        r0 = subprocess.run(
            ["docker", "exec", "mail_ai_redis", "redis-cli", "-n", "0", "PING"],
            capture_output=True, text=True, timeout=2
        )
        if r0.returncode == 0 and "PONG" in r0.stdout:
            res["db0_status"] = "PASS"
    except Exception:
        pass

    # Check DB 1
    try:
        r1 = subprocess.run(
            ["docker", "exec", "mail_ai_redis", "redis-cli", "-n", "1", "PING"],
            capture_output=True, text=True, timeout=2
        )
        if r1.returncode == 0 and "PONG" in r1.stdout:
            res["db1_status"] = "PASS"
            keys = query_redis_keys("chat_history:*", db_num=1)
            res["cached_threads"] = len(keys)
    except Exception:
        pass

    return res


def check_qdrant() -> Dict[str, Any]:
    res = {"name": "Qdrant Vector DB", "status": "FAIL", "points": 0, "url": ""}
    for url in ["http://localhost:6333", "http://mail_ai_qdrant:6333"]:
        try:
            r = requests.get(f"{url}/collections/mail_ai_knowledge", timeout=2.0)
            if r.status_code == 200:
                res["status"] = "PASS"
                res["url"] = url
                info = r.json().get("result", {})
                res["points"] = info.get("points_count", 0)
                break
        except Exception:
            pass
    return res


def check_embed_service() -> Dict[str, Any]:
    res = {"name": "Embedding Microservice", "status": "FAIL", "latency_ms": 0.0, "dim": 0, "model": ""}
    for url in ["http://localhost:8500", "http://mail_ai_embed_service:8500"]:
        try:
            start = time.perf_counter()
            r = requests.post(f"{url}/embed", json={"texts": ["query: healthcheck"]}, timeout=3.0)
            ms = round((time.perf_counter() - start) * 1000, 2)
            if r.status_code == 200:
                data = r.json()
                res["status"] = "PASS"
                res["latency_ms"] = ms
                res["dim"] = data.get("dim", 0)
                res["model"] = data.get("model", "")
                break
        except Exception:
            pass
    return res


def check_containers() -> Dict[str, Any]:
    res = {"name": "Docker Containers", "containers": {}}
    target_names = ["mail_ai_api", "mail_ai_worker", "mail_ai_listener", "mail_ai_redis", "mail_ai_qdrant", "mail_ai_embed_service"]
    try:
        proc = subprocess.run(
            ["docker", "ps", "--format", "{{.Names}}\t{{.Status}}"],
            capture_output=True, text=True, timeout=3
        )
        if proc.returncode == 0:
            lines = proc.stdout.strip().splitlines()
            running = {}
            for line in lines:
                parts = line.split("\t")
                if len(parts) >= 2:
                    running[parts[0]] = parts[1]
            for t in target_names:
                res["containers"][t] = running.get(t, "NOT RUNNING")
    except Exception as e:
        res["error"] = str(e)
    return res


def main():
    ensure_venv()
    print(header("AI EMAIL AUTOMATION ── PIPELINE & SUBSYSTEM HEALTH AUDIT"))

    # 1. Containers
    c_info = check_containers()
    print(subheader("CORE DOCKER CONTAINERS"))
    all_containers_up = True
    for c_name, status in c_info.get("containers", {}).items():
        if "Up" in status:
            b = badge("RUNNING", Color.BRIGHT_GREEN)
        else:
            b = badge("DOWN", Color.BRIGHT_RED)
            all_containers_up = False
        print(f"  {b} {Color.BOLD}{c_name:<28}{Color.RESET} {Color.DIM}{status}{Color.RESET}")

    # 2. MySQL
    m_info = check_mysql()
    print(subheader("MYSQL DATABASE"))
    if m_info["status"] == "PASS":
        print(f"  {badge('CONNECTED', Color.BRIGHT_GREEN)} Latency: {m_info['latency_ms']}ms")
        counts = [f"{k}: {v}" for k, v in m_info.get("details", {}).items()]
        print(f"    {Color.DIM}Record Counts: {', '.join(counts)}{Color.RESET}")
    else:
        print(f"  {badge('FAILED', Color.BRIGHT_RED)} Error: {m_info.get('error')}")

    # 3. Redis
    r_info = check_redis()
    print(subheader("REDIS BROKER & HISTORY CACHE"))
    b0 = badge("ACTIVE", Color.BRIGHT_GREEN) if r_info["db0_status"] == "PASS" else badge("DOWN", Color.BRIGHT_RED)
    b1 = badge("ACTIVE", Color.BRIGHT_GREEN) if r_info["db1_status"] == "PASS" else badge("DOWN", Color.BRIGHT_RED)
    print(f"  {b0} DB 0 (Celery Message Broker)")
    print(f"  {b1} DB 1 (Chat History Session Cache) ── Cached Threads: {r_info['cached_threads']}")

    # 4. Qdrant
    q_info = check_qdrant()
    print(subheader("QDRANT VECTOR DATABASE"))
    if q_info["status"] == "PASS":
        print(f"  {badge('READY', Color.BRIGHT_GREEN)} Collection: mail_ai_knowledge | Indexed Points: {q_info['points']}")
    else:
        print(f"  {badge('DOWN', Color.BRIGHT_RED)} Failed to query Qdrant collection on port 6333")

    # 5. Embed Service
    e_info = check_embed_service()
    print(subheader("EMBEDDING MICROSERVICE (PORT 8500)"))
    if e_info["status"] == "PASS":
        print(f"  {badge('HEALTHY', Color.BRIGHT_GREEN)} Model: {e_info['model']} ({e_info['dim']} dims) | Ping: {e_info['latency_ms']}ms")
    else:
        print(f"  {badge('DOWN', Color.BRIGHT_RED)} Embedding service is unreachable on port 8500")

    # Overall Summary
    print(subheader("SYSTEM OPERATIONAL STATUS SUMMARY"))
    critical_ok = (
        all_containers_up and
        m_info["status"] == "PASS" and
        r_info["db0_status"] == "PASS" and
        r_info["db1_status"] == "PASS" and
        q_info["status"] == "PASS" and
        e_info["status"] == "PASS"
    )

    if critical_ok:
        print(f"  {badge('ALL SYSTEMS OPERATIONAL', Color.BG_BLUE + Color.BRIGHT_WHITE)} 100% of pipeline subsystems are healthy.")
    else:
        print(f"  {badge('DEGRADED STATE DETECTED', Color.BG_MAGENTA + Color.BRIGHT_WHITE)} One or more subsystems require attention.")

    print("\n" + "=" * 80 + "\n")


if __name__ == "__main__":
    main()

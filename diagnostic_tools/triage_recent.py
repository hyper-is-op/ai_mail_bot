#!/usr/bin/env python3
"""
Diagnostic Triage CLI for Email Bot.
Rapidly lists, filters, and summarizes recent email logs to identify
anomalies, drops, escalations, low scores, or pending drafts.
"""

import sys
import os
import json
import argparse
from typing import List, Dict, Any

# Early environment and interpreter bootstrap before custom/third-party imports
_VENV_PYTHON = "/home/hyper_is_op/.venv/bin/python"
if os.path.exists(_VENV_PYTHON) and sys.executable != _VENV_PYTHON:
    try:
        import pymysql
        import dbutils
    except ImportError:
        if sys.argv and not sys.argv[0].startswith("-"):
            os.execv(_VENV_PYTHON, [_VENV_PYTHON] + sys.argv)

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
    Color,
    header,
    badge,
    status_badge,
    format_datetime,
    truncate,
    ljust_ansi
)

def fetch_recent_logs(
    limit: int = 15,
    client_id: str = None,
    filter_type: str = "all"
) -> List[Dict[str, Any]]:
    where_clauses = []
    params = []

    if client_id:
        where_clauses.append("client_id = %s")
        params.append(client_id)

    if filter_type == "dropped":
        where_clauses.append("(status = 'no_action_needed' OR intent IN ('off_topic_nonsense', 'marketing_promotional'))")
    elif filter_type == "escalated":
        where_clauses.append("(status LIKE '%ticket%' OR execution_steps LIKE '%create_ticket%')")
    elif filter_type == "sent":
        where_clauses.append("status = 'sent'")
    elif filter_type == "low_score":
        where_clauses.append("(score IS NOT NULL AND score < 80 AND score > 0)")
    elif filter_type == "zero_score":
        where_clauses.append("(score = 0)")

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    query = f"""
        SELECT 
            id, client_id, from_email, subject, status, score,
            intent, troubleshooting_step, is_resolved, thread_id,
            created_at
        FROM email_logs
        {where_sql}
        ORDER BY id DESC
        LIMIT %s
    """
    params.append(limit)

    with get_db_cursor() as cur:
        cur.execute(query, tuple(params))
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]


def render_triage_table(logs: List[Dict[str, Any]], filter_name: str):
    print(header(f"EMAIL BOT RECENT LOGS TRIAGE ── [FILTER: {filter_name.upper()}]"))
    
    if not logs:
        print(f"\n  {Color.YELLOW}No email logs matched the specified filter.{Color.RESET}\n")
        return

    print(f"  {Color.BOLD}{'ID':<6} {'Thread ID':<16} {'Client':<15} {'Status':<16} {'Score':<7} {'Intent':<20} {'Sender / Subject':<40}{Color.RESET}")
    print(f"  {'-'*6} {'-'*16} {'-'*15} {'-'*16} {'-'*7} {'-'*20} {'-'*40}")

    for log in logs:
        lid = log["id"]
        tid = log.get("thread_id") or "-"
        cid = log.get("client_id") or "-"
        st = log.get("status") or "-"
        sc = str(log.get("score") if log.get("score") is not None else "-")
        intent = log.get("intent") or "-"
        sender = log.get("from_email") or ""
        subj = log.get("subject") or ""
        time_str = format_datetime(log.get("created_at"))

        # Compact summary line
        status_styled = st
        if st in ("sent", "auto_send"):
            status_styled = f"{Color.GREEN}{st}{Color.RESET}"
        elif "ticket" in st or "escalat" in st:
            status_styled = f"{Color.YELLOW}{st}{Color.RESET}"
        elif "no_action" in st or "drop" in st:
            status_styled = f"{Color.RED}{st}{Color.RESET}"

        score_styled = sc
        if sc.isdigit():
            val = int(sc)
            if val >= 80:
                score_styled = f"{Color.GREEN}{sc}{Color.RESET}"
            elif val > 0:
                score_styled = f"{Color.YELLOW}{sc}{Color.RESET}"
            else:
                score_styled = f"{Color.RED}{sc}{Color.RESET}"

        sender_subj = f"{sender}: {subj}"
        print(f"  {Color.BOLD}#{lid:<5}{Color.RESET} {Color.CYAN}{tid:<16}{Color.RESET} {cid:<15} {ljust_ansi(status_styled, 18)} {ljust_ansi(score_styled, 7)} {intent:<20} {truncate(sender_subj, 40)}")

    print(f"  {'-'*6} {'-'*16} {'-'*15} {'-'*18} {'-'*7} {'-'*20} {'-'*40}")
    print(f"\n  {Color.BOLD}Quick Diagnostic Tip:{Color.RESET}")
    print(f"  To inspect any thread in depth, run:")
    sample_tid = logs[0].get("thread_id") or f"th_{logs[0]['id']}"
    print(f"    {Color.BRIGHT_CYAN}python3 diagnostic_tools/inspect_thread.py {sample_tid}{Color.RESET}  or  "
          f"{Color.BRIGHT_CYAN}python3 diagnostic_tools/inspect_thread.py {logs[0]['id']}{Color.RESET}\n")


def main():
    ensure_venv()
    parser = argparse.ArgumentParser(description="Triage recent email logs, filter by anomalies, and inspect threads.")
    parser.add_argument("-n", "--limit", type=int, default=15, help="Number of records to show (default: 15)")
    parser.add_argument("-c", "--client-id", dest="client_id", help="Filter by Client ID")
    parser.add_argument("--dropped", action="store_true", help="Show dropped / no-action emails only")
    parser.add_argument("--escalated", action="store_true", help="Show CRM escalated / ticket emails only")
    parser.add_argument("--sent", action="store_true", help="Show autonomous auto-sent emails only")
    parser.add_argument("--low-score", action="store_true", help="Show emails with low evaluation scores (< 80)")
    parser.add_argument("--zero-score", action="store_true", help="Show emails with 0 score")
    parser.add_argument("--json", action="store_true", help="Output raw triage results as structured JSON")

    args = parser.parse_args()

    filter_type = "all"
    if args.dropped:
        filter_type = "dropped"
    elif args.escalated:
        filter_type = "escalated"
    elif args.sent:
        filter_type = "sent"
    elif args.low_score:
        filter_type = "low_score"
    elif args.zero_score:
        filter_type = "zero_score"

    logs = fetch_recent_logs(
        limit=args.limit,
        client_id=args.client_id,
        filter_type=filter_type
    )

    if args.json:
        def default_serializer(obj):
            if hasattr(obj, "isoformat"):
                return obj.isoformat()
            from decimal import Decimal
            if isinstance(obj, Decimal):
                return float(obj)
            return str(obj)

        print(json.dumps(logs, indent=2, default=default_serializer))
    else:
        render_triage_table(logs, filter_type)


if __name__ == "__main__":
    main()

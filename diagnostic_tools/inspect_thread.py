#!/usr/bin/env python3
"""
Diagnostic Inspector CLI for Email Bot Threads and Email Logs.
Deep-dives into a conversation thread, email log, or both to reveal:
- Complete conversation timeline
- Step-by-step pipeline execution flow (execution_steps)
- Intent classification, sentiment, and evaluator scores
- LLM call telemetry (models, tokens, latencies, costs)
- Draft generation and human-in-the-loop review status
- External CRM actions (Zoho tickets) and SMTP outbox logs
- Active Redis sliding-window session cache
- Automated root-cause diagnostic findings
"""

import sys
import os
import re
import json
import hashlib
import argparse
from typing import Dict, Any, List, Optional

# Early environment and interpreter bootstrap before custom/third-party imports
_VENV_PYTHON = "/home/hyper_is_op/.venv/bin/python"
if os.path.exists(_VENV_PYTHON) and sys.executable != _VENV_PYTHON:
    try:
        import pymysql
        import dbutils
    except ImportError:
        if sys.argv and not sys.argv[0].startswith("-"):
            os.execv(_VENV_PYTHON, [_VENV_PYTHON] + sys.argv)

# Ensure project root and diagnostic_tools directory are in sys.path
_HERE = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.abspath(os.path.join(_HERE, ".."))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

# Bootstrap environment and path via diag_common
from diagnostic_tools.diag_common import (
    ensure_venv,
    get_db_cursor,
    get_redis_thread_history,
    Color,
    header,
    subheader,
    badge,
    status_badge,
    format_datetime,
    truncate
)

def parse_identifier(val: str) -> Dict[str, Optional[str]]:
    """
    Intelligently identifies the type of an input string:
    - Numeric (e.g. '371', '#371') -> mail_id
    - 'th_' prefix or 12 hex chars -> thread_id
    - '<...>' or contains '@' -> msg_id or email
    """
    v = val.strip()
    if not v:
        return {"mail_id": None, "thread_id": None, "msg_id": None}
    
    if v.startswith("#"):
        v = v[1:]
        
    if v.isdigit():
        return {"mail_id": v, "thread_id": None, "msg_id": None}
        
    if v.startswith("th_"):
        return {"mail_id": None, "thread_id": v, "msg_id": None}
        
    if len(v) == 12 and re.match(r"^[0-9a-fA-F]{12}$", v):
        return {"mail_id": None, "thread_id": f"th_{v}", "msg_id": None}
        
    if v.startswith("<") and v.endswith(">") or "@" in v:
        return {"mail_id": None, "thread_id": None, "msg_id": v}
        
    # Default fallback: treat as thread_id if contains letters/numbers
    return {"mail_id": None, "thread_id": v, "msg_id": None}


def fetch_thread_data(
    thread_id: Optional[str] = None,
    mail_id: Optional[int] = None,
    msg_id: Optional[str] = None,
    client_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Queries all relevant database tables across email_logs, llm_logs, draft_emails,
    action_logs, and Redis cache.
    """
    result: Dict[str, Any] = {
        "query": {
            "thread_id": thread_id,
            "mail_id": mail_id,
            "msg_id": msg_id,
            "client_id": client_id
        },
        "resolved_thread_id": thread_id,
        "resolved_client_id": client_id,
        "emails": [],
        "llm_logs": [],
        "drafts": [],
        "action_logs": [],
        "redis_cache": None,
        "diagnostic_findings": []
    }

    with get_db_cursor() as cur:
        # 1. Resolve email_logs
        where_clauses = []
        params = []

        if mail_id:
            where_clauses.append("id = %s")
            params.append(mail_id)
        elif thread_id:
            tid = thread_id if thread_id.startswith("th_") else f"th_{thread_id}"
            where_clauses.append("(thread_id = %s OR thread_id = %s)")
            params.extend([tid, tid.replace("th_", "")])
        elif msg_id:
            where_clauses.append("(message_id = %s OR in_reply_to = %s)")
            params.extend([msg_id, msg_id])

        if client_id:
            where_clauses.append("client_id = %s")
            params.append(client_id)

        if not where_clauses:
            return result

        query_sql = f"""
            SELECT 
                id, client_id, from_email, subject, body, reply, status, score,
                rag_id, sentiment, priority, execution_steps, summary,
                message_id, in_reply_to, thread_id, is_resolved,
                troubleshooting_step, intent, escalation_reason, conversation_closed,
                created_at
            FROM email_logs
            WHERE {" AND ".join(where_clauses)}
            ORDER BY id ASC
        """
        cur.execute(query_sql, tuple(params))
        cols = [d[0] for d in cur.description]
        rows = cur.fetchall()

        emails = [dict(zip(cols, r)) for r in rows]

        # If we initially queried by mail_id or msg_id and found a thread_id,
        # fetch the entire thread so the user gets full chronological context!
        if emails and not thread_id and emails[0].get("thread_id"):
            found_tid = emails[0]["thread_id"]
            result["resolved_thread_id"] = found_tid
            cur.execute(f"""
                SELECT 
                    id, client_id, from_email, subject, body, reply, status, score,
                    rag_id, sentiment, priority, execution_steps, summary,
                    message_id, in_reply_to, thread_id, is_resolved,
                    troubleshooting_step, intent, escalation_reason, conversation_closed,
                    created_at
                FROM email_logs
                WHERE thread_id = %s
                ORDER BY id ASC
            """, (found_tid,))
            emails = [dict(zip(cols, r)) for r in cur.fetchall()]

        result["emails"] = emails

        if emails:
            # Set resolved identifiers
            primary = emails[0]
            result["resolved_client_id"] = primary.get("client_id")
            if not result["resolved_thread_id"]:
                result["resolved_thread_id"] = primary.get("thread_id")

        active_tid = result["resolved_thread_id"]
        email_ids = [e["id"] for e in emails]

        # 2. Query LLM Logs
        llm_conditions = []
        llm_params = []
        if active_tid:
            llm_conditions.append("thread_id = %s")
            llm_params.append(active_tid)
        if email_ids:
            fmt_placeholders = ",".join(["%s"] * len(email_ids))
            llm_conditions.append(f"email_log_id IN ({fmt_placeholders})")
            llm_params.extend(email_ids)

        if llm_conditions:
            cur.execute(f"""
                SELECT 
                    id, client_id, provider, model_name, caller_function,
                    prompt_tokens, completion_tokens, latency_ms, cost,
                    billed_cost, email_log_id, thread_id, created_at
                FROM llm_logs
                WHERE {" OR ".join(llm_conditions)}
                ORDER BY id ASC
            """, tuple(llm_params))
            l_cols = [d[0] for d in cur.description]
            result["llm_logs"] = [dict(zip(l_cols, r)) for r in cur.fetchall()]

        # 3. Query Draft Emails
        draft_conditions = []
        draft_params = []
        if active_tid:
            draft_conditions.append("thread_id = %s")
            draft_params.append(active_tid)
        if email_ids:
            fmt_placeholders = ",".join(["%s"] * len(email_ids))
            draft_conditions.append(f"email_log_id IN ({fmt_placeholders})")
            draft_params.extend(email_ids)

        if draft_conditions:
            cur.execute(f"""
                SELECT 
                    id, client_id, email_log_id, thread_id, from_email,
                    to_email, subject, original_body, draft_reply,
                    confidence_score, intent, sentiment, priority, ticket_id,
                    status, rejection_reason, reviewed_by, reviewed_at,
                    sent_at, created_at
                FROM draft_emails
                WHERE {" OR ".join(draft_conditions)}
                ORDER BY id ASC
            """, tuple(draft_params))
            d_cols = [d[0] for d in cur.description]
            result["drafts"] = [dict(zip(d_cols, r)) for r in cur.fetchall()]

        # 4. Query Action Logs
        action_keys = []
        action_types = ["smtp_send_reply", "send_email", "crm_ticket_create", "create_ticket"]
        for em in emails:
            m_id = em.get("message_id")
            c_id = (em.get("client_id") or result["resolved_client_id"] or "").strip().lower()
            if m_id and c_id:
                for act in action_types:
                    raw_k = f"{c_id}:{m_id.strip()}:{act}"
                    action_keys.append(hashlib.sha256(raw_k.encode("utf-8")).hexdigest())

        if action_keys:
            placeholders = ",".join(["%s"] * len(action_keys))
            cur.execute(f"""
                SELECT 
                    idempotency_key, client_id, action_type, status,
                    external_ref, error_message, created_at, updated_at
                FROM action_logs
                WHERE idempotency_key IN ({placeholders})
                ORDER BY created_at ASC
            """, tuple(action_keys))
            a_cols = [d[0] for d in cur.description]
            result["action_logs"] = [dict(zip(a_cols, r)) for r in cur.fetchall()]

    # 5. Query Redis History Cache
    if result["resolved_client_id"] and result["resolved_thread_id"]:
        result["redis_cache"] = get_redis_thread_history(
            result["resolved_client_id"],
            result["resolved_thread_id"]
        )

    # 6. Analyze Root-Cause Findings
    result["diagnostic_findings"] = analyze_findings(result)

    return result


def analyze_findings(data: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    Evaluates telemetry across email, LLM, and action logs to flag anomalies,
    drops, escalations, or bottlenecks.
    """
    findings = []
    emails = data.get("emails", [])
    llms = data.get("llm_logs", [])
    actions = data.get("action_logs", [])
    drafts = data.get("drafts", [])

    if not emails:
        findings.append({
            "level": "ERROR",
            "title": "No Records Found",
            "message": "No matching email logs found for the provided identifier(s)."
        })
        return findings

    for email in emails:
        eid = email["id"]
        status = email.get("status")
        score = email.get("score")
        intent = email.get("intent")
        raw_steps = email.get("execution_steps")
        steps = []
        if raw_steps:
            try:
                steps = json.loads(raw_steps) if isinstance(raw_steps, str) else raw_steps
            except Exception:
                steps = [str(raw_steps)]

        # Check Intent Drop
        if intent in ("off_topic_nonsense", "marketing_promotional") or status == "no_action_needed":
            findings.append({
                "level": "INFO",
                "title": f"Email #{eid} Dropped By Intent Filter",
                "message": f"Classified as '{intent}'. Early-exited without drafting or sending (Step 108 suppression rule)."
            })

        # Check Knowledge Search Empty
        if "Knowledge_Search_Empty" in steps:
            findings.append({
                "level": "WARN",
                "title": f"Email #{eid} RAG Retrieval Returned Empty",
                "message": "Knowledge base search yielded 0 documents above score floor (0.52). Check query keywords in inspect_rag.py."
            })

        # Check Ticket Escalation
        if "ticket_created_and_sent" in (status or "") or any("Agent_Score:" in s and ":create_ticket" in s for s in steps):
            reason = email.get("escalation_reason") or "Evaluator low score or troubleshooting ceiling reached"
            findings.append({
                "level": "WARN",
                "title": f"Email #{eid} Escalated To CRM Ticket",
                "message": f"Status: {status} | Score: {score}/100 | Escalation Reason: {reason}"
            })

        # Check Auto-send
        if status == "sent" and score and score >= 80:
            findings.append({
                "level": "OK",
                "title": f"Email #{eid} Autonomous Auto-Send",
                "message": f"Passed evaluation threshold (Score: {score}/100). Dispatched via SMTP cleanly."
            })

    # Check Draft Status
    for draft in drafts:
        if draft.get("status") == "pending":
            findings.append({
                "level": "INFO",
                "title": f"Draft #{draft['id']} Pending Human Review",
                "message": f"Confidence: {draft.get('confidence_score')}% | Subject: {draft.get('subject')} | Waiting in Drafts inbox."
            })

    # Check Action Failures
    for act in actions:
        if act.get("status") == "failed":
            findings.append({
                "level": "ERROR",
                "title": f"Action Failed: {act.get('action_type')}",
                "message": f"External ref: {act.get('external_ref')} | Error: {act.get('error_message')}"
            })

    # Check LLM Latencies
    total_tokens = sum(l.get("prompt_tokens", 0) + l.get("completion_tokens", 0) for l in llms)
    total_cost = sum(float(l.get("cost") or 0.0) for l in llms)
    slow_llms = [l for l in llms if (l.get("latency_ms") or 0) > 4000]
    if slow_llms:
        findings.append({
            "level": "WARN",
            "title": f"{len(slow_llms)} Slow LLM Invocations (>4s)",
            "message": ", ".join([f"{l['caller_function']} ({l['latency_ms']}ms)" for l in slow_llms])
        })

    return findings


def render_cli_report(data: Dict[str, Any], show_full: bool = False, verbose: bool = False):
    """
    Renders high-visibility ANSI terminal report.
    """
    emails = data.get("emails", [])
    llms = data.get("llm_logs", [])
    drafts = data.get("drafts", [])
    actions = data.get("action_logs", [])
    redis_info = data.get("redis_cache")
    findings = data.get("diagnostic_findings", [])

    print(header("AI EMAIL AUTOMATION ── DIAGNOSTIC INSPECTOR"))

    # Summary bar
    tid = data.get("resolved_thread_id") or "None"
    cid = data.get("resolved_client_id") or "None"
    total_emails = len(emails)
    print(f" {Color.BOLD}Thread ID:{Color.RESET}  {Color.BRIGHT_CYAN}{tid}{Color.RESET}    "
          f"{Color.BOLD}Client ID:{Color.RESET}  {Color.BRIGHT_MAGENTA}{cid}{Color.RESET}    "
          f"{Color.BOLD}Total Emails In Thread:{Color.RESET} {Color.BRIGHT_WHITE}{total_emails}{Color.RESET}")

    # 1. Findings / Root Cause Section
    if findings:
        print(subheader("DIAGNOSTIC FINDINGS & ROOT CAUSE TRIAGE"))
        for f in findings:
            lvl = f["level"]
            if lvl == "OK":
                b = badge("PASSED", Color.BRIGHT_GREEN)
            elif lvl == "WARN":
                b = badge("WARNING", Color.BRIGHT_YELLOW)
            elif lvl == "ERROR":
                b = badge("FAILURE", Color.BRIGHT_RED)
            else:
                b = badge("INFO", Color.BRIGHT_BLUE)

            print(f"  {b} {Color.BOLD}{f['title']}{Color.RESET}")
            print(f"         {Color.DIM}↳ {f['message']}{Color.RESET}")

    # 2. Email Logs Timeline
    if emails:
        print(subheader("CONVERSATION & EMAIL LIFECYCLE TIMELINE"))
        for idx, em in enumerate(emails, 1):
            eid = em["id"]
            st = em.get("status")
            sc = em.get("score")
            step = em.get("troubleshooting_step", 0)
            res = "RESOLVED" if em.get("is_resolved") else "OPEN"
            time_str = format_datetime(em.get("created_at"))
            sender = em.get("from_email")
            subj = em.get("subject")
            intent = em.get("intent") or "-"

            print(f"\n  {Color.BOLD}{Color.BRIGHT_YELLOW}#{idx} [Email Log #{eid}]{Color.RESET} {status_badge(st)}  "
                  f"Score: {Color.BOLD}{sc if sc is not None else '-'}{Color.RESET}/100  "
                  f"Step: {Color.BOLD}{step}{Color.RESET}  "
                  f"State: {Color.BOLD}{res}{Color.RESET}  "
                  f"Time: {Color.DIM}{time_str}{Color.RESET}")

            print(f"     {Color.BOLD}From:{Color.RESET}    {sender}")
            print(f"     {Color.BOLD}Subject:{Color.RESET} {subj}")
            print(f"     {Color.BOLD}Intent:{Color.RESET}  {intent}  |  "
                  f"{Color.BOLD}Sentiment:{Color.RESET} {em.get('sentiment') or '-'}  |  "
                  f"{Color.BOLD}Priority:{Color.RESET} {em.get('priority') or '-'}")

            # Execution pipeline flow
            raw_steps = em.get("execution_steps")
            if raw_steps:
                try:
                    step_list = json.loads(raw_steps) if isinstance(raw_steps, str) else raw_steps
                    if isinstance(step_list, list):
                        formatted_steps = []
                        for s in step_list:
                            s_str = str(s)
                            if "Success" in s_str or "auto_send" in s_str or "SMTP_Send" in s_str:
                                formatted_steps.append(f"{Color.GREEN}{s_str}{Color.RESET}")
                            elif "Empty" in s_str or "create_ticket" in s_str or "Drop" in s_str:
                                formatted_steps.append(f"{Color.RED}{s_str}{Color.RESET}")
                            else:
                                formatted_steps.append(f"{Color.CYAN}{s_str}{Color.RESET}")
                        print(f"     {Color.BOLD}Pipeline Steps:{Color.RESET}")
                        print(f"       {' ➔ '.join(formatted_steps)}")
                except Exception:
                    print(f"     {Color.BOLD}Pipeline Steps:{Color.RESET} {raw_steps}")

            # Inbound body & Generated reply
            body = em.get("body") or ""
            reply = em.get("reply") or ""

            if show_full:
                print(f"     {Color.BOLD}Inbound Content:{Color.RESET}")
                for b_line in body.strip().splitlines():
                    print(f"       {Color.DIM}│ {b_line}{Color.RESET}")
                if reply:
                    print(f"     {Color.BOLD}Outbound Reply:{Color.RESET}")
                    for r_line in reply.strip().splitlines():
                        print(f"       {Color.BRIGHT_GREEN}│ {r_line}{Color.RESET}")
            else:
                print(f"     {Color.BOLD}Body Preview:{Color.RESET}  {truncate(body, 140)}")
                if reply:
                    print(f"     {Color.BOLD}Reply Preview:{Color.RESET} {truncate(reply, 140)}")

    # 3. LLM Logs & Telemetry
    if llms:
        print(subheader("LLM INVOCATIONS & TOKEN TELEMETRY"))
        total_p_tokens = sum(l.get("prompt_tokens") or 0 for l in llms)
        total_c_tokens = sum(l.get("completion_tokens") or 0 for l in llms)
        total_cost = sum(float(l.get("cost") or 0.0) for l in llms)
        total_ms = sum(l.get("latency_ms") or 0 for l in llms)

        print(f"  {Color.BOLD}{'ID':<6} {'Function':<22} {'Model':<20} {'Prompt':<8} {'Compl':<8} {'Latency':<10} {'Cost ($)':<10} {'Time':<19}{Color.RESET}")
        print(f"  {'-'*6} {'-'*22} {'-'*20} {'-'*8} {'-'*8} {'-'*10} {'-'*10} {'-'*19}")
        for l in llms:
            lid = l["id"]
            fn = l.get("caller_function") or "-"
            m = l.get("model_name") or "-"
            if len(m) > 19:
                m = m.split("/")[-1][:19]
            pt = l.get("prompt_tokens") or 0
            ct = l.get("completion_tokens") or 0
            lat = f"{l.get('latency_ms') or 0}ms"
            c = f"${float(l.get('cost') or 0.0):.6f}"
            t = format_datetime(l.get("created_at"))
            print(f"  {lid:<6} {fn:<22} {m:<20} {pt:<8} {ct:<8} {lat:<10} {c:<10} {t:<19}")
        print(f"  {'-'*6} {'-'*22} {'-'*20} {'-'*8} {'-'*8} {'-'*10} {'-'*10} {'-'*19}")
        print(f"  {Color.BOLD}{'TOTAL':<29} {total_p_tokens:<8} {total_c_tokens:<8} {total_ms}ms     ${total_cost:.6f}{Color.RESET}")

    # 4. Drafts & Review Queue
    if drafts:
        print(subheader("DRAFTS & HUMAN-IN-THE-LOOP REVIEW QUEUE"))
        for d in drafts:
            did = d["id"]
            st = d.get("status")
            conf = d.get("confidence_score")
            t_id = d.get("ticket_id") or "-"
            rev = d.get("reviewed_by") or "-"
            print(f"  {badge(f'Draft #{did}', Color.BRIGHT_MAGENTA)} {status_badge(st)}  "
                  f"Confidence: {conf}%  Ticket ID: {t_id}  Reviewed By: {rev}")
            if d.get("rejection_reason"):
                print(f"    {Color.RED}Rejection Reason: {d['rejection_reason']}{Color.RESET}")
            if show_full and d.get("draft_reply"):
                print(f"    {Color.BOLD}Draft Content:{Color.RESET}")
                for line in d["draft_reply"].strip().splitlines():
                    print(f"      {Color.DIM}│ {line}{Color.RESET}")

    # 5. Outbox & CRM Action Logs
    if actions:
        print(subheader("OUTBOX & EXTERNAL CRM ACTION LOGS"))
        for a in actions:
            act_type = a.get("action_type")
            st = a.get("status")
            ref = a.get("external_ref") or "-"
            err = a.get("error_message")
            t = format_datetime(a.get("created_at"))
            print(f"  {badge(act_type, Color.BRIGHT_CYAN)} {status_badge(st)}  Ref: {ref}  Time: {t}")
            if err:
                print(f"    {Color.RED}Error: {err}{Color.RESET}")

    # 6. Redis History State
    if redis_info:
        print(subheader("ACTIVE REDIS SLIDING WINDOW CACHE (DB 1)"))
        if redis_info.get("found"):
            ttl = redis_info.get("ttl_seconds", -1)
            msg_count = len(redis_info.get("messages", []))
            print(f"  {Color.GREEN}● Active Key:{Color.RESET} {redis_info.get('key')}")
            print(f"    {Color.BOLD}Messages In Memory:{Color.RESET} {msg_count}")
            print(f"    {Color.BOLD}TTL Remaining:{Color.RESET}      {ttl}s ({ttl // 60}m {ttl % 60}s)")
        else:
            print(f"  {Color.DIM}○ No active Redis cache key found (either expired or not yet initialized){Color.RESET}")

    print("\n" + "=" * 80 + "\n")


def main():
    ensure_venv()
    parser = argparse.ArgumentParser(
        description="Deep diagnostic inspection tool for Email Bot threads, email logs, and multi-subsystem telemetry."
    )
    parser.add_argument(
        "identifier",
        nargs="*",
        help="Thread ID (e.g. th_e3897a2164b8), Email Log ID (e.g. 371 or #371), or Message-ID"
    )
    parser.add_argument("-t", "--thread-id", dest="thread_id", help="Explicit Thread ID to inspect")
    parser.add_argument("-m", "--mail-id", dest="mail_id", type=int, help="Explicit Email Log ID (e.g. 371)")
    parser.add_argument("--msg-id", dest="msg_id", help="Explicit RFC Message-ID header")
    parser.add_argument("-c", "--client-id", dest="client_id", help="Filter by Client ID (e.g. CLI-4B46C071)")
    parser.add_argument("-f", "--full", action="store_true", help="Print full email body and draft text without truncation")
    parser.add_argument("--json", action="store_true", help="Output raw telemetry as structured JSON")
    parser.add_argument("-v", "--verbose", action="store_true", help="Include verbose debug details")

    args = parser.parse_args()

    # Parse positional identifiers if supplied
    thread_id = args.thread_id
    mail_id = args.mail_id
    msg_id = args.msg_id
    client_id = args.client_id

    if args.identifier:
        for ident in args.identifier:
            parsed = parse_identifier(ident)
            if parsed["mail_id"] and not mail_id:
                mail_id = int(parsed["mail_id"])
            elif parsed["thread_id"] and not thread_id:
                thread_id = parsed["thread_id"]
            elif parsed["msg_id"] and not msg_id:
                msg_id = parsed["msg_id"]

    if not thread_id and not mail_id and not msg_id:
        parser.print_help()
        print(f"\n{Color.RED}Error: You must provide at least one identifier (thread ID, mail ID, or message ID).{Color.RESET}")
        print(f"Example:\n  python3 diagnostic_tools/inspect_thread.py th_e3897a2164b8")
        print(f"  python3 diagnostic_tools/inspect_thread.py 371\n")
        sys.exit(1)

    data = fetch_thread_data(
        thread_id=thread_id,
        mail_id=mail_id,
        msg_id=msg_id,
        client_id=client_id
    )

    if args.json:
        # Custom serializer for datetime and Decimal
        def default_serializer(obj):
            if hasattr(obj, "isoformat"):
                return obj.isoformat()
            from decimal import Decimal
            if isinstance(obj, Decimal):
                return float(obj)
            return str(obj)

        print(json.dumps(data, indent=2, default=default_serializer))
    else:
        render_cli_report(data, show_full=args.full, verbose=args.verbose)


if __name__ == "__main__":
    main()

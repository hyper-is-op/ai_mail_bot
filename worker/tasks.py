import logging
import json
import re
import os
import random
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, Tuple

from worker.celery_worker import celery
from app.db import get_db_ctx
from app.llm import current_client_id, current_thread_id, extract_ticket_and_order_ids, extract_entities_categorized, generate_summary_llm, generate_off_topic_reply
from app.text_cleaning import strip_quoted_reply, strip_disclaimers, extract_clean_text_from_html, is_html_content
from app.email_disclaimers import get_active_disclaimer_texts
from app.mailer import send_email
from app.chat_history import push_message, get_history, upsert_ticket_history
from app.pipeline.context import PipelineContext
from app.pipeline.filters import apply_deterministic_filters
from app.pipeline.agent import run_support_agent
from app.pipeline.dispatcher import dispatch_or_draft_reply, create_ticket_and_reply

logger = logging.getLogger(__name__)


def extract_order_id(text: str):
    return extract_ticket_and_order_ids(text)


def generate_ticket_id() -> str:
    date_part = datetime.now().strftime("%y%m%d")
    random_part = str(random.randint(0, 99999)).zfill(5)
    return f"T-{date_part}-{random_part}"


class ThreadResolution(tuple):
    """
    Tuple representing (thread_id, prior_step) with optional is_rfc_match metadata.
    Backward-compatible with standard 2-tuple unpacking: thread_id, prior_step = resolve_thread_id(...)
    """
    def __new__(cls, thread_id: str, prior_step: int, is_rfc_match: bool = False):
        return super().__new__(cls, (thread_id, prior_step))

    def __init__(self, thread_id: str, prior_step: int, is_rfc_match: bool = False):
        self.thread_id = thread_id
        self.prior_step = prior_step
        self.is_rfc_match = is_rfc_match


def is_prior_turn_clarification(history: list) -> bool:
    """Returns True if the most recent support message in this thread was an automated clarification request."""
    for entry in reversed(history or []):
        if entry.get("role") == "support":
            meta = entry.get("meta") or ""
            body = entry.get("body", "").lower()
            if "clarification_sent" in meta or "clarify which" in body or "which inquiry" in body or "which ticket you would like" in body:
                return True
            return False
    return False


def resolve_thread_id(client_id: str, from_email: str, subject: str, in_reply_to: str = "", references: str = "", cursor=None) -> ThreadResolution:
    """
    Resolves or initiates a conversation thread and returns ThreadResolution(thread_id, prior_step, is_rfc_match).
    Respects client inactivity_timeout_hours (default: 72h) - if previous interaction
    exceeds timeout, a fresh thread_id is initiated to keep past closed metrics clean.
    1. Matches via in_reply_to against message_id in email_logs (is_rfc_match=True).
    2. Matches via references against message_id (is_rfc_match=True).
    3. Fallback: Matches same sender + normalized subject within timeout window on active threads (is_rfc_match=False).
    4. Default: Generates new thread_id 'th_' + uuid4().hex[:12].
    """
    def _do_lookup(cur):
        timeout_hours = 72
        try:
            cur.execute("SELECT inactivity_timeout_hours FROM email_accounts WHERE client_id = %s LIMIT 1", (client_id,))
            acc_row = cur.fetchone()
            if acc_row and acc_row[0] is not None:
                timeout_hours = max(1, int(acc_row[0]))
        except Exception:
            pass

        # 1. Match via in_reply_to
        if in_reply_to and in_reply_to.strip():
            cur.execute("""
                SELECT thread_id, troubleshooting_step, created_at 
                FROM email_logs 
                WHERE client_id = %s AND message_id = %s AND thread_id IS NOT NULL 
                ORDER BY id DESC LIMIT 1
            """, (client_id, in_reply_to.strip()))
            row = cur.fetchone()
            if row and row[0]:
                created_at = row[2] if len(row) > 2 else None
                if created_at:
                    cur.execute("SELECT TIMESTAMPDIFF(HOUR, %s, NOW())", (created_at,))
                    diff = cur.fetchone()
                    if diff and diff[0] is not None and diff[0] > timeout_hours:
                        logger.info(f"⏳ Thread {row[0]} timed out ({diff[0]}h > {timeout_hours}h) — initiating new thread")
                        return None, 0, False
                return row[0], int(row[1] or 0), True

        # 2. Match via references
        if references and references.strip():
            ref_tokens = re.findall(r'<[^>]+>', references)
            for ref in ref_tokens:
                cur.execute("""
                    SELECT thread_id, troubleshooting_step, created_at 
                    FROM email_logs 
                    WHERE client_id = %s AND message_id = %s AND thread_id IS NOT NULL 
                    ORDER BY id DESC LIMIT 1
                """, (client_id, ref))
                row = cur.fetchone()
                if row and row[0]:
                    created_at = row[2] if len(row) > 2 else None
                    if created_at:
                        cur.execute("SELECT TIMESTAMPDIFF(HOUR, %s, NOW())", (created_at,))
                        diff = cur.fetchone()
                        if diff and diff[0] is not None and diff[0] > timeout_hours:
                            logger.info(f"⏳ Thread {row[0]} timed out ({diff[0]}h > {timeout_hours}h) — initiating new thread")
                            return None, 0, False
                    return row[0], int(row[1] or 0), True

        # 3. Subject-based thread matching within inactivity timeout window
        # Only apply if the incoming email is an explicit reply/forward (e.g. Re: / Fwd:)
        # and has a descriptive, non-generic subject. Freshly composed emails must start a new thread.
        is_reply_subject = bool(re.match(r'^(re|fwd|fw):\s*', subject or '', flags=re.IGNORECASE))
        clean_subj = re.sub(r'^(re|fwd|fw):\s*', '', subject or '', flags=re.IGNORECASE).strip()
        GENERIC_SUBJECTS = {
            "support request", "no subject", "(no subject)", "facing problem",
            "problem", "issue", "help", "query", "question", "urgent",
            "support", "error", "trouble", "assistance", "request", "bug"
        }
        if is_reply_subject and clean_subj and clean_subj.lower() not in GENERIC_SUBJECTS:
            cur.execute("""
                SELECT thread_id, troubleshooting_step 
                FROM email_logs 
                WHERE client_id = %s AND from_email = %s 
                  AND subject LIKE %s
                  AND created_at >= NOW() - INTERVAL %s HOUR
                  AND is_resolved = 0
                  AND thread_id IS NOT NULL
                ORDER BY id DESC LIMIT 1
            """, (client_id, from_email, f"%{clean_subj[:50]}%", timeout_hours))
            row = cur.fetchone()
            if row and row[0]:
                return row[0], int(row[1] or 0), False

        return None, 0, False

    thread_id = None
    prior_step = 0
    is_rfc = False
    try:
        if cursor is not None:
            thread_id, prior_step, is_rfc = _do_lookup(cursor)
        else:
            with get_db_ctx() as db:
                with db.cursor() as cur:
                    thread_id, prior_step, is_rfc = _do_lookup(cur)
    except Exception as e:
        logger.warning(f"⚠️ Thread resolution failed: {e}")

    if not thread_id:
        thread_id = f"th_{uuid.uuid4().hex[:12]}"
        is_rfc = False

    return ThreadResolution(thread_id, prior_step, is_rfc)


def check_and_resolve_thread_entanglement(
    client_id: str,
    from_email: str,
    current_thread_id: str,
    subject: str,
    body: str,
    cursor=None,
    is_rfc_match: bool = False
) -> Optional[Dict[str, Any]]:
    """
    Detects cross-thread entanglement when a customer with multiple parallel active threads
    accidentally replies into Thread A with content/entities belonging to Thread B.
    Option A: Automatically re-anchors to Thread B and returns details to prepend notification note.
    Bypasses immediately (0ms overhead) if sender has <= 1 active thread.
    Direct RFC replies (matched via In-Reply-To/References) are protected from topic-keyword
    hijacking and will only re-anchor on explicit candidate ticket/order ID citations.
    """
    def _do_check(cur):
        timeout_hours = 72
        try:
            cur.execute("SELECT inactivity_timeout_hours FROM email_accounts WHERE client_id = %s LIMIT 1", (client_id,))
            acc_row = cur.fetchone()
            if acc_row and acc_row[0] is not None:
                timeout_hours = max(1, int(acc_row[0]))
        except Exception:
            pass

        # Fast Gate: Find all active, unresolved threads for this sender within the timeout window
        cur.execute("""
            SELECT thread_id, subject, troubleshooting_step
            FROM email_logs
            WHERE client_id = %s AND from_email = %s
              AND created_at >= NOW() - INTERVAL %s HOUR
              AND is_resolved = 0
              AND thread_id IS NOT NULL
              AND status NOT IN ('no_action_needed', 'system_bounce_dropped', 'rate_limited', 'automation_halted')
              AND (intent IS NULL OR intent NOT IN ('marketing_promotional', 'off_topic_nonsense'))
            ORDER BY id DESC
        """, (client_id, from_email, timeout_hours))
        rows = cur.fetchall()
        if not rows:
            return None

        # Group by thread_id to identify distinct active candidate threads
        threads_by_id: Dict[str, Dict[str, Any]] = {}
        for r in rows:
            th_id = r[0]
            if th_id not in threads_by_id:
                cand_subj = r[1] or ""
                extracted_tids = extract_ticket_and_order_ids(cand_subj)
                cand_ticket = extracted_tids[0] if extracted_tids else ""
                threads_by_id[th_id] = {
                    "thread_id": th_id,
                    "subject": cand_subj,
                    "troubleshooting_step": int(r[2] or 0),
                    "ticket_id": cand_ticket
                }

        # Fast Gate: If sender has 0 or 1 active thread, there is NO entanglement risk
        if len(threads_by_id) <= 1:
            return None

        # Clean quoted reply chains so that quoted prior threads and disclaimers do not pollute topic matching
        clean_body = strip_quoted_reply(body)
        email_text = f"{subject} {clean_body}".lower()
        candidates = [t for th_id, t in threads_by_id.items() if th_id != current_thread_id]

        for cand in candidates:
            cand_ticket = (cand.get("ticket_id") or "").strip()
            # 1. Direct Ticket ID match: customer email quotes candidate's ticket ID
            if cand_ticket and cand_ticket.lower() in email_text:
                topic = f"Ticket #{cand_ticket}"
                clean_subj = re.sub(r'^(re|fwd|fw):\s*', '', cand.get("subject", ""), flags=re.IGNORECASE).strip()
                if clean_subj:
                    topic = f"{clean_subj} ({topic})"
                return {
                    "reanchored": True,
                    "target_thread_id": cand["thread_id"],
                    "target_step": cand["troubleshooting_step"],
                    "target_topic": topic,
                    "target_ticket_id": cand_ticket
                }

            # Direct RFC replies (In-Reply-To / References) are strictly protected against fuzzy topic hijacking.
            # Only explicit ticket ID citations can re-anchor a verified direct reply.
            if is_rfc_match:
                continue

            # 2. Distinct topic / subject keywords match (only for non-RFC-matched messages)
            cand_subj = cand.get("subject") or ""
            clean_cand_subj = re.sub(r'^(re|fwd|fw):\s*', '', cand_subj, flags=re.IGNORECASE).strip()
            stopwords = {
                # Support & Meta
                "support", "request", "issue", "problem", "question", "update", "hello",
                "urgent", "facing", "please", "thank", "thanks", "regards", "query", "ticket",
                "inquiry", "email", "message", "reply", "followup", "follow-up",
                # Conversational verbs, prepositions & generic qualifiers
                "tell", "about", "what", "more", "give", "know", "have", "need", "want",
                "like", "also", "with", "from", "this", "that", "there", "here", "some",
                "which", "could", "would", "should", "does", "done", "will", "show",
                "help", "details", "features", "overview", "information", "regarding"
            }
            cand_tokens = {
                tok for tok in re.findall(r'[a-zA-Z0-9_\-#]+', clean_cand_subj.lower())
                if len(tok) >= 4 and tok not in stopwords
            }
            if cand_tokens:
                matched_tokens = {tok for tok in cand_tokens if tok in email_text}
                current_subj = threads_by_id.get(current_thread_id, {}).get("subject", "")
                clean_cur_subj = re.sub(r'^(re|fwd|fw):\s*', '', current_subj, flags=re.IGNORECASE).strip()
                cur_tokens = {
                    tok for tok in re.findall(r'[a-zA-Z0-9_\-#]+', clean_cur_subj.lower())
                    if len(tok) >= 4 and tok not in stopwords
                }
                if matched_tokens and not matched_tokens.intersection(cur_tokens):
                    strong_match = any(len(tok) >= 6 for tok in matched_tokens)
                    if (len(matched_tokens) >= 2 or strong_match) and len(matched_tokens) >= max(1, len(cand_tokens) // 2):
                        return {
                            "reanchored": True,
                            "target_thread_id": cand["thread_id"],
                            "target_step": cand["troubleshooting_step"],
                            "target_topic": clean_cand_subj or cand["thread_id"],
                            "target_ticket_id": cand_ticket
                        }

        return None

    try:
        if cursor is not None:
            return _do_check(cursor)
        else:
            with get_db_ctx() as db:
                with db.cursor() as cur:
                    return _do_check(cur)
    except Exception as e:
        logger.warning(f"⚠️ Entanglement resolution check error: {e}")
        return None


def get_client_features(cursor=None, client_id: str = "") -> Dict[str, Any]:
    defaults = {
        "feature_ticket_creation": True, "feature_auto_send": True,
        "feature_rag": True, "feature_order_tracking": True, "feature_manual_reply": True,
        "feature_strip_disclaimers": True, "feature_compound_triage": True,
        "admin_bot_enabled": True, "client_bot_enabled": True,
    }
    def _query(cur):
        cur.execute("""
            SELECT feature_ticket_creation, feature_auto_send, feature_rag,
                   feature_order_tracking, feature_manual_reply,
                   COALESCE(feature_strip_disclaimers, 1),
                   COALESCE(admin_bot_enabled, 1), COALESCE(client_bot_enabled, 1)
            FROM email_accounts WHERE client_id = %s
        """, (client_id,))
        row = cur.fetchone()
        if row:
            return {
                "feature_ticket_creation": bool(row[0]), "feature_auto_send": bool(row[1]),
                "feature_rag": bool(row[2]), "feature_order_tracking": bool(row[3]),
                "feature_manual_reply": bool(row[4]),
                "feature_strip_disclaimers": bool(row[5]) if row[5] is not None else True,
                "admin_bot_enabled": bool(row[6]) if row[6] is not None else True,
                "client_bot_enabled": bool(row[7]) if row[7] is not None else True,
            }
        return defaults

    try:
        if cursor is not None:
            return _query(cursor)
        else:
            with get_db_ctx() as db:
                with db.cursor() as cur:
                    return _query(cur)
    except Exception as e:
        logger.warning(f"⚠️ Failed to fetch client features for {client_id}, using defaults: {e}")
    return defaults


def publish_email_update(client_id: str, extra_payload: Optional[Dict[str, Any]] = None):
    try:
        from app.redis_pool import get_redis_main
        r = get_redis_main()
        msg = {"type": "NEW_EMAIL", "client_id": client_id}
        if extra_payload:
            msg.update(extra_payload)
        r.publish("email_updates", json.dumps(msg))
        logger.info(f"📡 Published real-time update to 'email_updates' channel for client {client_id}")
    except Exception as e:
        logger.warning(f"⚠️ Failed to publish real-time notification: {e}")


def generate_and_save_summary(
    log_id: int, 
    data: Dict[str, Any], 
    context_text: str = "", 
    db=None, 
    cursor=None
):
    """
    Generates an LLM summary of the issue without holding open a long-lived database connection.
    1. Short DB read: Prior 5 emails from same sender.
    2. LLM inference: generate_summary_llm() with ZERO DB connection held.
    3. Short DB write: UPDATE email_logs SET summary = %s.
    """
    try:
        client_id = data.get("client_id")
        from_email = data.get("from_email")
        body = data.get("body")

        thread_id = data.get("thread_id")

        # Step 1: Read prior rows in discrete transaction
        def _read_prior(cur):
            if thread_id:
                cur.execute("""
                    SELECT body, reply, summary 
                    FROM email_logs 
                    WHERE client_id = %s 
                      AND thread_id = %s 
                      AND id < %s
                    ORDER BY id DESC LIMIT 5
                """, (client_id, thread_id, log_id))
            else:
                cur.execute("""
                    SELECT body, reply, summary 
                    FROM email_logs 
                    WHERE client_id = %s 
                      AND from_email = %s 
                      AND id < %s
                    ORDER BY id DESC LIMIT 5
                """, (client_id, from_email, log_id))
            return cur.fetchall()

        if cursor is not None:
            prior_rows = _read_prior(cursor)
        else:
            with get_db_ctx() as db_conn:
                with db_conn.cursor() as cur:
                    prior_rows = _read_prior(cur)

        old_summary = ""
        history_list = []
        for r in prior_rows:
            if r[2] and not old_summary:
                old_summary = r[2]
            history_list.insert(0, {"role": "customer", "body": r[0]})
            if r[1]:
                history_list.insert(1, {"role": "support", "body": r[1]})

        # Step 2: LLM inference with ZERO database connection held
        summary = generate_summary_llm(
            context=context_text,
            customer_body=body,
            history=history_list,
            old_summary=old_summary
        )

        # Step 3: Write summary in discrete transaction
        def _write_summary(cur, conn):
            cur.execute("UPDATE email_logs SET summary = %s WHERE id = %s", (summary, log_id))
            conn.commit()

        if cursor is not None and db is not None:
            _write_summary(cursor, db)
        else:
            with get_db_ctx() as db_conn:
                with db_conn.cursor() as cur:
                    _write_summary(cur, db_conn)

        logger.info(f"📊 Summary generated & updated for ID {log_id}: {summary}")
    except Exception as e:
        logger.warning(f"⚠️ Failed to generate/save summary: {e}")


def _finalize_task_and_log(ctx: PipelineContext, task_id: str, cursor=None, db=None):
    """
    Standardized persistence helper:
    1. Inserts execution metadata and response into email_logs in a short discrete transaction.
    2. Auto-populates draft_emails if pending manual review.
    3. Updates celery_task_log to 'completed'.
    4. Commits DB transaction immediately.
    5. Asynchronously generates summary (if applicable).
    6. Publishes real-time notification to Redis.
    """
    def _execute_persistence(cur, conn):
        is_closed = 1 if (ctx.is_resolved or ctx.status in ('ticket_created_and_sent', 'ticket_created_draft_pending') or ctx.conversation_closed) else 0
        if getattr(ctx, "retry_log_id", None):
            cur.execute("""
                UPDATE email_logs SET
                    client_id = %s, from_email = %s, subject = %s, body = %s, body_html = %s, reply = %s, score = %s,
                    status = %s, rag_id = %s, sentiment = %s, priority = %s, execution_steps = %s, summary = %s,
                    message_id = %s, in_reply_to = %s, thread_id = %s, troubleshooting_step = %s, is_resolved = %s,
                    intent = %s, escalation_reason = %s, conversation_closed = %s,
                    created_at = NOW()
                WHERE id = %s
            """, (
                ctx.client_id,
                ctx.from_email,
                ctx.subject,
                ctx.body,
                ctx.body_html or None,
                ctx.draft_reply,
                ctx.score,
                ctx.status,
                ctx.rag_id,
                ctx.sentiment,
                ctx.priority,
                json.dumps(ctx.execution_steps),
                ctx.summary or "",
                ctx.message_id or None,
                ctx.in_reply_to or None,
                ctx.thread_id or None,
                ctx.troubleshooting_step or 0,
                1 if ctx.is_resolved else 0,
                ctx.intent or "general_support",
                ctx.escalation_reason,
                is_closed,
                ctx.retry_log_id
            ))
            log_id = ctx.retry_log_id
        else:
            cur.execute("""
                INSERT INTO email_logs (
                    client_id, from_email, subject, body, body_html, reply, score,
                    status, rag_id, sentiment, priority, execution_steps, summary,
                    message_id, in_reply_to, thread_id, troubleshooting_step, is_resolved,
                    intent, escalation_reason, conversation_closed
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                ctx.client_id,
                ctx.from_email,
                ctx.subject,
                ctx.body,
                ctx.body_html or None,
                ctx.draft_reply,
                ctx.score,
                ctx.status,
                ctx.rag_id,
                ctx.sentiment,
                ctx.priority,
                json.dumps(ctx.execution_steps),
                ctx.summary or "",
                ctx.message_id or None,
                ctx.in_reply_to or None,
                ctx.thread_id or None,
                ctx.troubleshooting_step or 0,
                1 if ctx.is_resolved else 0,
                ctx.intent or "general_support",
                ctx.escalation_reason,
                is_closed
            ))
            log_id = cur.lastrowid

        # Discrete backfill of email_log_id onto llm_logs for this thread
        if ctx.thread_id and log_id:
            try:
                cur.execute("""
                    UPDATE llm_logs 
                    SET email_log_id = %s 
                    WHERE client_id = %s 
                      AND thread_id = %s 
                      AND email_log_id IS NULL 
                      AND created_at >= NOW() - INTERVAL 2 MINUTE
                """, (log_id, ctx.client_id, ctx.thread_id))
            except Exception as bf_err:
                logger.warning(f"⚠️ llm_logs backfill failed: {bf_err}")

        # Auto-populate Pending Review in draft_emails if manual review is required
        if ctx.status == "pending_manual_review":
            try:
                from app.draft_service import create_draft
                create_draft(
                    client_id=ctx.client_id,
                    email_log_id=log_id,
                    from_email=ctx.from_email,
                    to_email=ctx.from_email,
                    subject=ctx.subject,
                    original_body=ctx.body,
                    draft_reply=ctx.draft_reply or (
                        f"Hello,\n\n"
                        f"Thank you for reaching out regarding '{ctx.subject}'.\n"
                        f"Your inquiry has been received and escalated for specialist assistance. A support engineer will update you shortly.\n\n"
                        f"Best regards,\nSupport Team"
                    ),
                    confidence_score=ctx.score,
                    intent=ctx.intent or "ticket_creation_failed",
                    sentiment=ctx.sentiment,
                    priority=ctx.priority,
                    ticket_id=ctx.ticket_id,
                    in_reply_to=ctx.message_id,
                    message_id=ctx.message_id,
                    sender_name=ctx.sender_name,
                    thread_id=ctx.thread_id,
                )
                logger.info(f"📝 Auto-created Pending Review draft in draft_emails for log_id {log_id}")
            except Exception as draft_err:
                logger.error(f"⚠️ Failed to create draft for pending manual review: {draft_err}")

        cur.execute("UPDATE celery_task_log SET status = 'completed' WHERE task_id = %s", (task_id,))
        conn.commit()
        return log_id

    db_log_id = None
    if cursor is not None and db is not None:
        db_log_id = _execute_persistence(cursor, db)
    else:
        with get_db_ctx() as db_conn:
            with db_conn.cursor() as cur:
                db_log_id = _execute_persistence(cur, db_conn)

    # Post-commit summary generation (runs outside main transaction without holding connection during LLM inference)
    if db_log_id and not ctx.summary and ctx.status not in ("system_bounce_dropped", "rate_limited", "automation_halted", "no_action_needed"):
        try:
            generate_and_save_summary(
                log_id=db_log_id,
                data={
                    "client_id": ctx.client_id,
                    "from_email": ctx.from_email,
                    "subject": ctx.subject,
                    "body": ctx.body,
                    "thread_id": ctx.thread_id
                },
                context_text=ctx.context_text
            )
        except Exception as sum_err:
            logger.warning(f"⚠️ Summary generation skipped: {sum_err}")

    extra_payload = {}
    if ctx.priority in ("Critical", "Urgent") and ctx.escalation_reason == "Hostile_Legal_Threat":
        extra_payload = {
            "escalation_alert": True,
            "escalation_reason": "Hostile_Legal_Threat",
            "priority": "Critical",
            "thread_id": ctx.thread_id,
            "from_email": ctx.from_email
        }
    publish_email_update(ctx.client_id, extra_payload=extra_payload if extra_payload else None)
    logger.info(f"✅ [Task {task_id}] Finalized with status='{ctx.status}', log_id={db_log_id}")


# Backward-compatible aliases
_create_ticket_and_reply = create_ticket_and_reply
_dispatch_or_draft_reply = dispatch_or_draft_reply


@celery.task(bind=True, max_retries=2, default_retry_delay=10)
def process_email_task(self, data: Dict[str, Any]):
    task_id = self.request.id or str(uuid.uuid4())
    client_id = data.get("client_id", "SYSTEM") or "SYSTEM"
    from_email = (data.get("from_email") or "").strip()
    logger.info(f"📥 Received email task [{task_id}]: from={from_email} subject={data.get('subject')}")

    # Set context token for tenant isolation
    ctx_token = current_client_id.set(client_id)
    token_thread = None
    ctx = PipelineContext.from_task_data(task_id, data)

    try:
        # ====================================================================
        # Phase A: Short Pre-Flight Gate (~10ms DB checkout)
        # ====================================================================
        with get_db_ctx() as db:
            with db.cursor() as cursor:
                # 1. Idempotency Check
                cursor.execute("SELECT status FROM celery_task_log WHERE task_id = %s", (task_id,))
                existing = cursor.fetchone()
                if existing:
                    if existing[0] == "completed":
                        logger.info(f"⏭ Task {task_id} already completed — skipping to prevent duplicate")
                        return
                    elif existing[0] == "processing":
                        logger.warning(f"🔄 Task {task_id} is a retry — continuing carefully")
                else:
                    cursor.execute(
                        "INSERT INTO celery_task_log (task_id, client_id, from_email, status) VALUES (%s, %s, %s, 'processing')",
                        (task_id, client_id, from_email)
                    )
                    db.commit()

                if data.get("__test_fatal_error__"):
                    raise RuntimeError("Deliberate poison pill test error")

                features = get_client_features(cursor, client_id)
                ctx.features = features

                # Resolve Thread ID and prior troubleshooting step
                thread_res = resolve_thread_id(
                    client_id=client_id,
                    from_email=from_email,
                    subject=data.get("subject") or "",
                    in_reply_to=data.get("in_reply_to") or "",
                    references=data.get("references") or "",
                    cursor=cursor
                )
                thread_id = thread_res[0]
                prior_step = thread_res[1]
                is_rfc_match = getattr(thread_res, "is_rfc_match", False)
                ctx.thread_id = thread_id
                ctx.troubleshooting_step = prior_step
                logger.info(f"🧵 [Thread Resolved] ID: {thread_id} | Prior Step: {prior_step} | RFC Match: {is_rfc_match}")

                # Level 0 Fast Deterministic Gates (bounces, broadcast senders, paused emails)
                if apply_deterministic_filters(ctx, cursor):
                    _finalize_task_and_log(ctx, task_id=task_id, cursor=cursor, db=db)
                    return

                # Check for Thread Entanglement across active threads (Option A)
                entanglement = check_and_resolve_thread_entanglement(
                    client_id=client_id,
                    from_email=from_email,
                    current_thread_id=thread_id,
                    subject=data.get("subject") or "",
                    body=ctx.body,
                    cursor=cursor,
                    is_rfc_match=is_rfc_match
                )
                if entanglement and entanglement.get("reanchored"):
                    old_th = ctx.thread_id
                    ctx.thread_id = entanglement["target_thread_id"]
                    ctx.troubleshooting_step = entanglement["target_step"]
                    ctx.context_data["reanchored_target_topic"] = entanglement["target_topic"]
                    ctx.context_data["reanchored_original_thread"] = old_th
                    ctx.log_step(f"Thread_Entanglement_Reanchored:{old_th}->{ctx.thread_id}")
                    logger.info(f"🔀 [Thread Entanglement] Re-anchored email from {old_th} to {ctx.thread_id} (topic: '{entanglement['target_topic']}')")

        # Bind thread context for all subsequent LLM telemetry logging
        token_thread = current_thread_id.set(ctx.thread_id or "")

        # ====================================================================
        # Phase B: Network, AI & Tools Execution (ZERO DB connection held)
        # ====================================================================
        # Strip quoted reply chains if present so downstream agent/evaluator/RAG only sees the new text
        ctx.body = strip_quoted_reply(ctx.body)

        # Normalize subject: derive from first line of body if blank
        from app.utils import normalize_subject
        ctx.subject = normalize_subject(ctx.subject, ctx.body)
        logger.info(f"🏷️ Subject normalized to: '{ctx.subject}'")
        data["subject"] = ctx.subject

        # Strip disclaimers if enabled
        if ctx.features.get("feature_strip_disclaimers", True):
            try:
                active_disclaimers = get_active_disclaimer_texts(client_id)
                ctx.body = strip_disclaimers(ctx.body, active_disclaimers)
            except Exception as e:
                logger.warning(f"⚠️ Failed to strip disclaimers: {e}")

        # Load Conversation History from Redis (with SQL fallback and continuation-gated prior thread carryover)
        ctx.history = get_history(client_id, ctx.from_email, last_n=10, thread_id=ctx.thread_id)
        if not ctx.history:
            combined_text = f"{ctx.subject} {ctx.body}".lower()
            followup_cues = (
                "previous", "earlier", "yesterday", "last email", "update on", "update regarding",
                "still not", "as discussed", "ticket", "following up", "status of", "any update",
                "same issue", "not working yet"
            )
            is_continuation = (
                ctx.subject.lower().startswith("re:")
                or bool(ctx.ticket_id)
                or any(cue in combined_text for cue in followup_cues)
            )
            if is_continuation:
                prior_history = get_history(client_id, ctx.from_email, last_n=3)
                if prior_history:
                    logger.info(f"📜 Carried over {len(prior_history)} background context messages from prior thread for follow-up from {ctx.from_email}")
                    ctx.history = prior_history
        logger.info(f"📜 Loaded {len(ctx.history)} history messages (thread={ctx.thread_id}, step={ctx.troubleshooting_step})")

        # Deterministic Multi-Ticket / Multi-Order Check with Custom Tenant Regex Support
        email_query = f"Subject: {ctx.subject}\n\n{ctx.body}"
        from app.connector_config import get_live_config
        cfg_order = get_live_config(client_id, "order_status")
        cfg_ticket = get_live_config(client_id, "ticket_status")
        custom_order_regex = cfg_order.get("id_pattern_regex") if cfg_order else None
        custom_ticket_regex = cfg_ticket.get("id_pattern_regex") if cfg_ticket else None

        entities = extract_entities_categorized(
            email_query,
            custom_order_regex=custom_order_regex,
            custom_ticket_regex=custom_ticket_regex
        )
        order_ids = entities["orders"]
        ticket_ids = entities["tickets"]
        all_ids = entities.get("all") or list(dict.fromkeys(order_ids + ticket_ids))

        # Only trigger clarification if multiple IDs are detected and not already clarified on prior turn
        if len(all_ids) > 1:
            conflicting_ids = all_ids
            if is_prior_turn_clarification(ctx.history):
                ctx.ticket_id = ticket_ids[0] if ticket_ids else order_ids[0]
                if order_ids:
                    ctx.order_id = order_ids[0]
                ctx.log_step(f"Clarification_Loop_Bypassed:Prioritized_{ctx.ticket_id}")
                logger.info(f"🔄 [Multi-ID Clarification Loop Bypassed] Prior turn was clarification — prioritizing {ctx.ticket_id}")
            else:
                logger.warning(f"⚠️ Multiple entity IDs in email: {conflicting_ids}")
                ctx.log_step("Clarification_Request")
                id_list = "\n".join(f"  - {tid}" for tid in conflicting_ids)
                clarification_reply = (
                    f"Dear Customer,\n\n"
                    f"Thank you for reaching out. We noticed your email mentions multiple ticket/order IDs:\n\n"
                    f"{id_list}\n\n"
                    f"Could you please clarify which ticket you would like us to look into? "
                    f"Replying with a single ticket ID will help us assist you faster.\n\n"
                    f"Thanks & Regards,\n"
                    f"Support Team"
                )
                send_email(
                    ctx.client_id,
                    ctx.from_email,
                    "Re: " + ctx.subject,
                    clarification_reply,
                    in_reply_to=ctx.message_id
                )
                push_message(client_id=ctx.client_id, from_email=ctx.from_email, role="customer",
                             subject=ctx.subject, body=ctx.body, thread_id=ctx.thread_id)
                push_message(client_id=ctx.client_id, from_email=ctx.from_email, role="support",
                             subject="Re: " + ctx.subject, body=clarification_reply,
                             meta=json.dumps({"action": "clarification_sent"}), thread_id=ctx.thread_id)
                ctx.draft_reply = clarification_reply
                ctx.status = "clarification_sent"
                ctx.summary = f"Multiple ticket IDs referenced ({', '.join(conflicting_ids)}). Sent clarification request."
                ctx.score = 0
                _finalize_task_and_log(ctx, task_id=task_id)
                return

        if order_ids:
            ctx.order_id = order_ids[0]
        if ticket_ids:
            ctx.ticket_id = ticket_ids[0]
        elif order_ids:
            ctx.ticket_id = order_ids[0]

        # Route Intent & Entities via classification
        try:
            from app.pipeline.router import route_intent_and_entities
            route_intent_and_entities(ctx, email_query)
        except Exception as route_err:
            logger.warning(f"⚠️ Intent routing failed, using defaults: {route_err}")
            ctx.intent = "general_support"

        # Promotional emails and standalone greetings must never have diagnostic counters
        if ctx.intent in ("marketing_promotional", "greeting"):
            ctx.troubleshooting_step = 0
        elif ctx.intent == "general_query" and not ctx.troubleshooting_step and not ctx.history:
            ctx.troubleshooting_step = 0

        # Compound Intent Triage Gate: handle one issue at a time (with loop protection)
        if ctx.is_compound_intent and len(ctx.intents) > 1 and ctx.features.get("feature_compound_triage", True):
            if is_prior_turn_clarification(ctx.history):
                INTENT_PRIORITY = {
                    "technical_support": 1,
                    "ticket_create": 2,
                    "ticket_status": 3,
                    "billing": 4,
                    "refund": 5,
                    "general_query": 6,
                    "issue_resolved": 7,
                    "marketing_promotional": 8
                }
                sorted_intents = sorted(ctx.intents, key=lambda i: INTENT_PRIORITY.get(i, 99))
                dominant_intent = sorted_intents[0]
                ctx.intent = dominant_intent
                ctx.is_compound_intent = False
                ctx.log_step(f"Compound_Triage_Bypassed:Prioritized_{dominant_intent}")
                logger.info(f"🔄 [Compound Triage Loop Bypassed] Prior turn was clarification — proceeding with dominant intent {dominant_intent}")
            else:
                INTENT_LABELS = {
                    "technical_support": "Technical troubleshooting / system malfunction",
                    "general_query": "Technical troubleshooting / product inquiry",
                    "ticket_status": "Status tracking for an existing ticket or order",
                    "ticket_create": "New ticket logging / specialist escalation",
                    "issue_resolved": "Issue resolution confirmation",
                    "marketing_promotional": "Promotional inquiry",
                    "billing": "Billing / subscription inquiry",
                    "refund": "Refund / payment dispute"
                }
                issue_items = [INTENT_LABELS.get(i, f"{i.replace('_', ' ').capitalize()} request") for i in ctx.intents[:3]]
                id_list = "\n".join(f"  - {item}" for item in issue_items)
                clarification_reply = (
                    f"Dear Customer,\n\n"
                    f"Thank you for reaching out. We noticed your message contains multiple distinct inquiries:\n\n"
                    f"{id_list}\n\n"
                    f"To ensure each matter is handled thoroughly and accurately, could you please let us know which inquiry you would like us to resolve first? "
                    f"Replying with your choice will help us assist you faster.\n\n"
                    f"Thanks & Regards,\n"
                    f"Support Team"
                )
                logger.info(f"🔀 [Compound Triage] Multi-intent inquiry detected ({ctx.intents}) — sending triage clarification to handle one issue at a time")
                send_email(
                    ctx.client_id,
                    ctx.from_email,
                    "Re: " + ctx.subject,
                    clarification_reply,
                    in_reply_to=ctx.message_id
                )
                push_message(client_id=ctx.client_id, from_email=ctx.from_email, role="customer",
                             subject=ctx.subject, body=ctx.body, thread_id=ctx.thread_id)
                push_message(client_id=ctx.client_id, from_email=ctx.from_email, role="support",
                             subject="Re: " + ctx.subject, body=clarification_reply,
                             meta=json.dumps({"action": "clarification_sent"}), thread_id=ctx.thread_id)
                ctx.draft_reply = clarification_reply
                ctx.status = "clarification_sent"
                ctx.summary = f"Multiple distinct inquiries ({', '.join(ctx.intents)}). Sent triage clarification to handle one issue at a time."
                ctx.score = 0
                _finalize_task_and_log(ctx, task_id=task_id)
                return

        # Early exit for marketing promotional blasts without explicit support inquiry or ticket
        if ctx.intent == "marketing_promotional" and not ticket_ids and not ctx.troubleshooting_step:
            logger.info(f"🛑 [Client {client_id}] Inbound email classified as 'marketing_promotional' — dropping without automated ticket or reply")
            ctx.summary = f"Automated marketing/promotional message ({ctx.subject}). Dropped without reply."
            ctx.priority = "Low"
            ctx.is_resolved = True
            ctx.halt("no_action_needed", "Classified as marketing_promotional", "Intent_Drop:marketing_promotional")
            _finalize_task_and_log(ctx, task_id=task_id)
            return

        if ctx.intent == "off_topic_nonsense" and not ticket_ids and not ctx.troubleshooting_step and not ctx.history:
            # Standalone off-topic inquiry or gibberish with zero history or ticket reference
            # RAG safety net: if knowledge base has high-confidence match, override and serve it
            _rag_override = False
            try:
                from app.rag import retrieve_knowledge
                _rag_query = f"{ctx.subject} {ctx.body}".strip()
                _rag_results = retrieve_knowledge(client_id, _rag_query, top_k=1, min_score=0.75)
                if _rag_results and float(_rag_results[0].get("score", 0)) >= 0.75:
                    logger.info(
                        f"🔁 [Client {client_id}] RAG score {_rag_results[0]['score']:.4f} ≥ 0.75 on "
                        f"'off_topic_nonsense' email — overriding to general_query and routing to agent"
                    )
                    ctx.intent = "general_query"
                    ctx.log_step("Intent_Override_RAG_Match")
                    _rag_override = True
            except Exception as _rag_err:
                logger.warning(f"⚠️ RAG override check failed: {_rag_err}")

            if not _rag_override:
                # Still off-topic — send polite redirect (NOT silent drop)
                logger.info(f"🛑 [Client {client_id}] Confirmed off_topic_nonsense — sending polite redirect reply")
                try:
                    off_topic_text = generate_off_topic_reply(
                        from_email=ctx.from_email,
                        subject=ctx.subject,
                        query=ctx.body,
                        history=[]
                    )
                    send_email(
                        ctx.client_id,
                        ctx.from_email,
                        "Re: " + ctx.subject,
                        off_topic_text,
                        in_reply_to=ctx.message_id
                    )
                    ctx.draft_reply = off_topic_text
                    ctx.log_step("Off_Topic_Reply_Sent")
                except Exception as _ot_err:
                    logger.warning(f"⚠️ Failed to send off_topic redirect reply: {_ot_err}")
                ctx.summary = f"Off-topic message with no product match ({ctx.subject}). Polite redirect sent."
                ctx.priority = "Low"
                ctx.halt("no_action_needed", "Classified as off_topic_nonsense", "Intent_Drop:off_topic_nonsense")
                _finalize_task_and_log(ctx, task_id=task_id)
                return

        # Autonomous Support Agent Loop (No DB held across 10-30s LLM / Tool execution)
        ctx = run_support_agent(ctx, cursor=None)

        # Post-Agent Dispatch & Outbox
        if ctx.status in ("ticket_created_and_sent", "ticket_created_draft_pending"):
            logger.info(f"🎫 Ticket escalation finalized by agent tool ({ctx.status})")
        elif ctx.response_action == "draft_mode":
            is_threat = bool(ctx.context_data.get("sentiment_velocity_breach"))
            if is_threat:
                ctx.status = "pending_manual_review"
                ctx.priority = "Critical"
                ctx.escalation_reason = "Hostile_Legal_Threat"
                ctx.log_step("Routed_To_Pending_Review:Hostile_Legal_Threat")
                logger.warning(f"🚨 [Client {client_id}] Hostile/legal threat routed to pending_manual_review with Critical priority")
            else:
                logger.info(f"📝 [Client {client_id}] Evaluator routed to draft_mode (RAG miss / informational) — staging in Pending Review")
                ctx.status = "pending_manual_review"
                ctx.log_step("Routed_To_Pending_Review:RAG_Miss")
            push_message(client_id=client_id, from_email=ctx.from_email, role="customer",
                         subject=ctx.subject, body=ctx.body, ticket_id=ctx.ticket_id or "", thread_id=ctx.thread_id)
        elif ctx.response_action == "create_ticket" and not ctx.is_resolved:
            # Bypass ticket escalation only for duplicate tickets or non-technical informational inquiries without diagnostic context
            is_pure_informational = (
                ctx.intent in ("marketing_promotional", "greeting")
                or (ctx.intent == "general_query" and ctx.troubleshooting_step == 0 and len(ctx.history) <= 1)
            )
            if is_pure_informational or ctx.ticket_id:
                logger.info(f"ℹ️ Ticket escalation bypassed (intent={ctx.intent}, ticket_id={ctx.ticket_id}, step={ctx.troubleshooting_step}) — dispatching draft reply")
                status, save_history = dispatch_or_draft_reply(
                    client_id=client_id,
                    from_email=ctx.from_email,
                    subject=ctx.subject,
                    reply_body=ctx.draft_reply,
                    features=ctx.features,
                    confidence_score=ctx.score,
                    intent=ctx.intent or "general_query",
                    sentiment=ctx.sentiment,
                    priority=ctx.priority,
                    ticket_id=ctx.ticket_id,
                    original_body=ctx.body,
                    in_reply_to=ctx.message_id,
                    message_id=ctx.message_id,
                    sender_name=ctx.sender_name,
                    execution_steps=ctx.execution_steps
                )
                ctx.status = status
                if save_history:
                    push_message(client_id=client_id, from_email=ctx.from_email, role="customer",
                                 subject=ctx.subject, body=ctx.body, ticket_id=ctx.ticket_id or "", thread_id=ctx.thread_id)
                    push_message(client_id=client_id, from_email=ctx.from_email, role="support",
                                 subject="Re: " + ctx.subject, body=ctx.draft_reply, ticket_id=ctx.ticket_id or "", thread_id=ctx.thread_id)
            else:
                logger.info("🎫 Evaluator decided to escalate and create ticket")
                reply, outgoing_ticket_id, status = create_ticket_and_reply(
                    data=ctx.to_task_data(),
                    client_id=client_id,
                    context=ctx.draft_reply or ctx.body,
                    history=ctx.history,
                    cursor=None,
                    sentiment=ctx.sentiment,
                    priority=ctx.priority,
                    features=ctx.features
                )
                ctx.draft_reply = reply
                ctx.ticket_id = outgoing_ticket_id
                ctx.status = status
                if status == "ticket_creation_failed":
                    logger.error("❌ Ticket creation failed — holding for manual review")
                    ctx.log_step("Ticket_Creation_Failed")
                    ctx.status = "pending_manual_review"
                else:
                    try:
                        summary = generate_summary_llm(context="", customer_body=ctx.body, history=ctx.history, old_summary="")
                        upsert_ticket_history(client_id=client_id, ticket_id=outgoing_ticket_id,
                                              customer_email=ctx.from_email, summary=summary,
                                              priority=ctx.priority, status="NEW")
                    except Exception as up_err:
                        logger.warning(f"⚠️ Failed to upsert ticket history: {up_err}")
        elif ctx.draft_reply:
            status, save_history = dispatch_or_draft_reply(
                client_id=client_id,
                from_email=ctx.from_email,
                subject=ctx.subject,
                reply_body=ctx.draft_reply,
                features=ctx.features,
                confidence_score=ctx.score,
                intent=ctx.intent or ("issue_resolved" if ctx.is_resolved else "support_query"),
                sentiment=ctx.sentiment,
                priority=ctx.priority,
                ticket_id=ctx.ticket_id,
                original_body=ctx.body,
                in_reply_to=ctx.message_id,
                message_id=ctx.message_id,
                sender_name=ctx.sender_name,
                execution_steps=ctx.execution_steps
            )
            ctx.status = status
            if save_history:
                push_message(client_id=client_id, from_email=ctx.from_email, role="customer",
                             subject=ctx.subject, body=ctx.body, ticket_id=ctx.ticket_id or "", thread_id=ctx.thread_id)
                push_message(client_id=client_id, from_email=ctx.from_email, role="support",
                             subject="Re: " + ctx.subject, body=ctx.draft_reply, ticket_id=ctx.ticket_id or "", thread_id=ctx.thread_id)
        else:
            logger.error("❌ Agent returned empty reply — holding for manual review")
            ctx.status = "pending_manual_review"
            ctx.log_step("Agent_Fallback_Manual_Review")

        # ====================================================================
        # Phase C: Finalize Task & Write Logs (~20ms DB checkout)
        # ====================================================================
        _finalize_task_and_log(ctx, task_id=task_id)

    except Exception as e:
        logger.error(f"❌ Task failed: {e}", exc_info=True)
        retries = getattr(self.request, "retries", 0)
        max_retries = getattr(self, "max_retries", 2)
        if retries >= max_retries:
            logger.critical(
                f"🔥 [Poison Pill Circuit Breaker] Max retries ({max_retries}) exhausted for task {task_id} "
                f"(Client: {client_id}, Sender: {from_email}). Terminating to prevent worker starvation."
            )
            try:
                with get_db_ctx() as db:
                    with db.cursor() as cursor:
                        cursor.execute(
                            "UPDATE celery_task_log SET status = 'fatal_processing_error' WHERE task_id = %s",
                            (task_id,)
                        )
                        error_summary = f"Fatal worker error: {str(e)[:200]}"
                        cursor.execute("""
                            INSERT INTO email_logs (client_id, from_email, subject, body, status, summary)
                            VALUES (%s, %s, %s, %s, 'failed', %s)
                        """, (
                            client_id,
                            from_email,
                            (data.get("subject") or "Support Request")[:255],
                            (data.get("body") or "")[:1000],
                            error_summary
                        ))
                        db.commit()

                try:
                    from app.alert_service import trigger_alert_if_needed
                    trigger_alert_if_needed(
                        client_id, "dlq_poison",
                        f"Task Poison Pill Dropped",
                        f"Task {task_id} from {from_email} exceeded retries and entered DLQ failure status.",
                        {"Task ID": task_id, "Sender": from_email, "Error": str(e)[:150]}
                    )
                except Exception as al_err:
                    logger.warning(f"⚠️ Failed to trigger DLQ webhook: {al_err}")

            except Exception as log_err:
                logger.error(f"⚠️ Failed to write fatal task error to DB: {log_err}")
            return {"status": "fatal_processing_error", "error": str(e)}
        else:
            raise self.retry(exc=e, countdown=10)
    finally:
        try:
            current_client_id.reset(ctx_token)
        except Exception:
            pass
        if token_thread is not None:
            try:
                current_thread_id.reset(token_thread)
            except Exception:
                pass
        publish_email_update(client_id)


@celery.task(name="worker.tasks.sweep_stale_outbox_task")
def sweep_stale_outbox_task(max_age_seconds: int = 120):
    """
    Periodic task to sweep abandoned outbox actions older than max_age_seconds.
    """
    from app.action_outbox import sweep_stale_actions
    logger.info(f"🧹 Running background outbox sweeper (max_age={max_age_seconds}s)...")
    res = sweep_stale_actions(max_age_seconds)
    return res

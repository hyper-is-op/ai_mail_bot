import os
import logging
from typing import Optional
from app.pipeline.context import PipelineContext
from app.keyword_filter import get_blocked_keywords, is_blocked, insert_blocked_email

logger = logging.getLogger(__name__)


def apply_deterministic_filters(ctx: PipelineContext, cursor) -> bool:
    """
    Executes fast deterministic checks before any LLM is called.
    Returns True if the email was halted/filtered, False if processing should continue.
    """
    client_id = ctx.client_id
    from_email = ctx.from_email
    subject = ctx.subject
    body_text = ctx.body

    # 0. Bounce / Mailer-Daemon / System Message Check
    from_email_clean = (from_email or "").lower().strip()
    subj_clean = (subject or "").lower().strip()
    is_daemon_sender = (
        from_email_clean.startswith(("mailer-daemon@", "postmaster@", "noreply@", "no-reply@"))
        or "mailer-daemon" in from_email_clean
        or "postmaster" in from_email_clean
    )
    is_bounce_subject = any(
        subj_clean.startswith(prefix) for prefix in (
            "delivery status notification", "undelivered mail",
            "mail delivery subsystem", "failure notice", "returned mail"
        )
    )
    if is_daemon_sender or is_bounce_subject:
        logger.info(f"🛑 [Client {client_id}] Automated bounce / daemon message detected from {from_email} ({subject}) — dropping without automated reply")
        ctx.summary = f"Automated system message / bounce from {from_email}. Dropped without reply."
        ctx.halt("system_bounce_dropped", "Automated bounce or daemon notification", "System_Bounce_Dropped")
        return True

    # 0b. Automated Marketing / Broadcast Blast Sender Detection
    # Catch obvious automated broadcast, promo, and digest addresses (e.g. promo@, newsletter@, digests@, updates@, bulletin@)
    # or mailings with standard unsubscribe indicators where no user inquiry or ticket exists
    is_broadcast_prefix = from_email_clean.startswith((
        "newsletter@", "newsletters@", "promo@", "promotions@", "marketing@",
        "bulletin@", "digests@", "digest@", "updates@", "campaign@", "offers@"
    ))
    if is_broadcast_prefix:
        logger.info(f"📢 [Client {client_id}] Automated broadcast/newsletter sender detected ({from_email}) — dropping without automated ticket or reply")
        ctx.summary = f"Automated marketing broadcast from {from_email}. Dropped without reply."
        ctx.priority = "Low"
        ctx.halt("no_action_needed", f"Broadcast sender prefix: {from_email}", "Broadcast_Sender_Dropped")
        return True

    # 1. Master Bot Switch (Disabled by Administrator or Paused by Client)
    admin_bot_enabled = ctx.features.get("admin_bot_enabled", True)
    client_bot_enabled = ctx.features.get("client_bot_enabled", True)
    if not admin_bot_enabled or not client_bot_enabled:
        reason = "Disabled by Administrator" if not admin_bot_enabled else "Paused by Client"
        logger.info(f"🛑 [Client {client_id}] Master Bot Switch is OFF ({reason}) — halting task")
        ctx.summary = f"Master automation switch is OFF ({reason}). Email flow halted."
        ctx.halt("automation_halted", reason, f"Master_Switch_Halt:{reason}")
        return True

    # 2. Inbound Sender Rate Limiting Check (configurable via SENDER_HOURLY_RATE_LIMIT, default 30 emails/hr)
    from app.rate_limiter import check_sender_rate_limit
    sender_limit = int(os.getenv("SENDER_HOURLY_RATE_LIMIT", "30"))
    allowed, count = check_sender_rate_limit(client_id, from_email, limit=sender_limit, window_seconds=3600)
    if not allowed:
        logger.warning(f"🚨 [Client {client_id}] Sender {from_email} exceeded hourly rate limit ({count}/{sender_limit}) — halting automated reply")
        ctx.summary = f"Sender {from_email} exceeded rate limit ({count}/{sender_limit} in 1hr). Held for review."
        ctx.priority = "Low"
        ctx.halt("rate_limited", f"Sender hourly rate limit exceeded ({count}/{sender_limit})", f"Rate_Limited:{count}")
        return True

    # 2. Check if Email is Paused
    cursor.execute("SELECT id FROM paused_emails WHERE client_id = %s AND paused_email = %s", (client_id, from_email))
    if cursor.fetchone():
        logger.info(f"⏸️ [Client {client_id}] Email from {from_email} is paused. Routing to review queue.")
        cursor.execute("""
            INSERT INTO paused_email_history (client_id, from_email, subject, body, status)
            VALUES (%s, %s, %s, %s, 'pending_review')
        """, (client_id, from_email, subject, body_text))
        ctx.summary = f"Email from {from_email} routed to paused review queue."
        ctx.priority = "Medium"
        ctx.halt("paused", "Email sender is paused", "Paused")
        return True

    # 3. Blocked Keywords Check
    blocked_keywords = get_blocked_keywords(cursor, client_id)
    email_text = f"{subject} {body_text}"
    matched_kw = is_blocked(email_text, blocked_keywords) if blocked_keywords else None
    if matched_kw:
        logger.info(f"🚫 [Client {client_id}] Email matched blocked keyword '{matched_kw}'")
        insert_blocked_email(
            cursor, client_id,
            from_email, subject, body_text,
            matched_kw, status="pending_review"
        )
        ctx.priority = "High"
        ctx.summary = f"Email blocked by keyword rule: '{matched_kw}'."
        ctx.halt("blocked_keyword", f"Blocked keyword: {matched_kw}", f"Blocked_Keyword:{matched_kw}")
        return True

    # 4. Marketing / Promotional Sender Check
    from_email_clean = from_email.lower().strip()
    cursor.execute("""
        SELECT id, sender_email FROM marketing_senders 
        WHERE client_id = %s 
          AND (LOWER(sender_email) = %s OR %s LIKE CONCAT('%%@', LOWER(sender_email)))
    """, (client_id, from_email_clean, from_email_clean))
    matched_sender = cursor.fetchone()

    if matched_sender:
        sender_rule = matched_sender[1]
        logger.info(f"📢 [Client {client_id}] Sender '{from_email_clean}' is in marketing_senders ({sender_rule})")
        ctx.summary = f"Marketing email from marked sender ({sender_rule}). No automated processing needed."
        ctx.priority = "Low"
        ctx.halt("no_action_needed", f"Marketing sender rule: {sender_rule}", f"Rule_Match:Marketing_Sender:{sender_rule}")
        return True

    return False


# ============================================================================
# Category 6: Conversational Drift & Edge Scenarios Guards
# ============================================================================
import re

DIAGNOSTIC_REFUSAL_PATTERNS = [
    r"\b(send (a )?(tech|technician|engineer|human|agent|specialist))\b",
    r"\b(talk to (a )?(human|person|agent|manager|supervisor))\b",
    r"\b(stop (asking|sending steps|wasting my time))\b",
    r"\b(stop asking me to (restart|reboot|check|do))\b",
    r"\b(refuse|not going|not gonna|won\'t) (to )?(do|restart|troubleshoot|check|reboot|follow)\b",
    r"\b(not doing (that|this|any of (this|that|these)))\b",
    r"\b(just fix (it|this)|just do it)\b",
    r"\b(enough of (this|steps|troubleshooting))\b",
]

LEGAL_OR_HOSTILE_PATTERNS = [
    r"\b(lawyer|attorney|lawsuit|legal notice|legal action|court|sue you|suing|consumer court|consumer forum|regulatory complaint|\bbbb\b|attorney general|arbitration)\b",
    r"\b(fraud|scam|scammers|police|police report|\bfir\b|litigation)\b",
    r"\b(taking legal action|report you to)\b",
]


def check_diagnostic_refusal(text: str) -> bool:
    """
    Detects explicit customer refusal or deadlock during troubleshooting steps.
    Distinguishes active refusal from factual negative observations (e.g. 'No, the light is still off').
    """
    if not text:
        return False
    lower = text.lower()
    return any(re.search(pat, lower, re.IGNORECASE) for pat in DIAGNOSTIC_REFUSAL_PATTERNS)


def check_legal_or_hostile_threat(text: str) -> bool:
    """
    Detects severe legal, regulatory, or hostile threats warranting immediate human review.
    """
    if not text:
        return False
    lower = text.lower()
    return any(re.search(pat, lower, re.IGNORECASE) for pat in LEGAL_OR_HOSTILE_PATTERNS)


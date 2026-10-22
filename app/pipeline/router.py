import re
import logging
from typing import Tuple, List, Optional
from app.pipeline.context import PipelineContext
from app.llm import detect_intent_llm, extract_ticket_and_order_ids, scan_history_for_ticket

logger = logging.getLogger(__name__)


def route_intent_and_entities(ctx: PipelineContext, email_query: str) -> bool:
    """
    Extracts ticket/order entities and detects customer intent.
    Returns True if an immediate terminal branch was taken (e.g. clarification needed),
    False if normal pipeline routing should continue.
    """
    # 1. Detect Intent via LLM
    classification = detect_intent_llm(email_query)
    ctx.intent = classification.get("intent", "general_query")
    raw_intents = classification.get("intents")
    if isinstance(raw_intents, list) and raw_intents:
        ctx.intents = raw_intents
    else:
        ctx.intents = [ctx.intent]
    ctx.is_compound_intent = bool(classification.get("is_compound", False) or len(ctx.intents) > 1)
    ctx.sentiment = classification.get("sentiment", "Neutral")
    ctx.priority = classification.get("priority", "Medium")
    ctx.log_step(f"Intent_Detection:{ctx.intent}")

    # Check Sentiment Velocity & Severe Legal/Hostile Escalation
    from app.pipeline.filters import check_legal_or_hostile_threat
    if check_legal_or_hostile_threat(email_query):
        ctx.priority = "Urgent"
        ctx.context_data["sentiment_velocity_breach"] = True
        ctx.log_step("Sentiment_Velocity_Breach:Legal_Threat")
        logger.warning(f"🚨 [Client {ctx.client_id}] Legal/hostile threat detected in email -> flagged sentiment velocity breach with Urgent priority")
    elif ctx.history:
        prior_cust_msgs = [h for h in ctx.history if h.get("role") == "customer"]
        if prior_cust_msgs:
            last_cust = prior_cust_msgs[-1]
            last_meta = last_cust.get("meta") if isinstance(last_cust.get("meta"), dict) else {}
            prior_sent = last_meta.get("sentiment", "Neutral")
            if prior_sent in ("Neutral", "Happy") and ctx.sentiment == "Angry":
                q_low = email_query.lower()
                if any(w in q_low for w in ["unacceptable", "furious", "terrible", "reporting", "demand manager", "demand supervisor"]):
                    ctx.priority = "Urgent"
                    ctx.context_data["sentiment_velocity_breach"] = True
                    ctx.log_step("Sentiment_Velocity_Breach:Hostile_Shift")
                    logger.warning(f"🚨 [Client {ctx.client_id}] Sudden sentiment drop Neutral->Angry detected -> flagged sentiment velocity breach")

    ticket_ids = classification.get("ticket_ids", []) or []
    used_fallback = classification.get("used_fallback", False)

    # 2. Fallback Keyword Escalation (only when LLM failed)
    if used_fallback:
        q_lower = email_query.lower()
        if any(w in q_lower for w in ["sue", "legal", "lawyer", "court", "scam"]):
            ctx.priority = "Critical"
            ctx.sentiment = "Angry"
        elif any(w in q_lower for w in ["refund", "cancel", "urgent", "wrong", "fake", "bad", "worst"]):
            if ctx.priority not in ["Critical", "High", "Urgent"]:
                ctx.priority = "High"
            if ctx.sentiment == "Neutral":
                ctx.sentiment = "Angry"

    # 3. Regex Extraction if LLM missed ticket IDs
    if not ticket_ids:
        ticket_ids = extract_ticket_and_order_ids(email_query)

    # Deduplicate IDs
    ticket_ids = list(dict.fromkeys(ticket_ids)) if ticket_ids else []
    ctx.extracted_tickets = ticket_ids

    if ticket_ids:
        ctx.ticket_id = ticket_ids[0]

    return False

# app/context_data.py

from typing import TypedDict, Optional
import re


class ContextData(TypedDict, total=False):
    """
    Assembled once per incoming email, BEFORE any CRM/order-status API
    call. Shape must not vary by PATH A/B/C — templates must not need to
    know which trigger_type populated which field.

    Cheap fields (CHEAP_KEYS) are always computed via build_context_data_base.
    Expensive fields (EXPENSIVE_KEYS) require an LLM call and are only
    computed by the executor, on demand, via resolve_expensive_keys —
    called only for keys the selected template actually references.
    """
    client_id: str
    from_email: str
    subject: str
    body: str
    cleaned_body: str
    ticket_id: Optional[str]
    order_id: Optional[str]
    payment_id: Optional[str]
    reference_id: Optional[str]
    intent: str
    sentiment: str
    priority: str
    customer_name: str
    first_name: str
    last_name: str
    thread_id: str
    priority_lower: str
    priority_num: int
    history_summary: str
    issue_description: str
    conversation_history: str



CONTEXT_DATA_KEYS = frozenset(ContextData.__annotations__.keys())

CHEAP_KEYS = frozenset({
    "client_id", "from_email", "subject", "body", "cleaned_body",
    "ticket_id", "order_id", "payment_id", "reference_id",
    "intent", "sentiment", "priority", "customer_name",
    "first_name", "last_name", "thread_id", "priority_lower", "priority_num",
    "conversation_history",
})

EXPENSIVE_KEYS = frozenset({"history_summary", "issue_description"})

assert CHEAP_KEYS | EXPENSIVE_KEYS == CONTEXT_DATA_KEYS, \
    "CHEAP_KEYS/EXPENSIVE_KEYS drifted out of sync with ContextData — fix before shipping"


def _strip_boilerplate(text: str) -> str:
    """Strips repetitive support signatures and disclaimer separators from message lines."""
    if not text:
        return ""
    lines = text.split("\n")
    cleaned_lines = []
    for line in lines:
        l_strip = line.strip().lower()
        if any(l_strip.startswith(p) for p in (
            "thanks & regards", "thanks and regards", "warm regards",
            "best regards", "department:", "company:", "customer support team",
            "-- ", "___", "==="
        )):
            break
        cleaned_lines.append(line)
    res = "\n".join(cleaned_lines).strip()
    return res if res else text.strip()


def _condense_support_turn(text: str, max_chars: int = 500) -> str:
    """
    Condenses verbose bot diagnostic replies for CRM ticket transcripts:
    - Strips disclaimer and signature boilerplates.
    - Strips quoted email thread history.
    - Caps bot reply length defensively to avoid crowding out customer messages.
    """
    cleaned = _strip_boilerplate(text)
    lines = []
    for l in cleaned.split("\n"):
        l_str = l.strip()
        if l_str.startswith(">") or re.match(r"^On\s+.+wrote:", l_str, re.IGNORECASE):
            break
        lines.append(l)
    cleaned = "\n".join(lines).strip()

    if len(cleaned) <= max_chars:
        return cleaned

    truncated = cleaned[:max_chars].strip()
    last_break = max(truncated.rfind("."), truncated.rfind("\n"))
    if last_break > max_chars // 2:
        return truncated[:last_break + 1].strip() + " [...]"
    return truncated.rsplit(" ", 1)[0] + " [...]"


def format_conversation_thread(history: list, current_body: str, max_messages: int = 12, max_chars: int = 8000) -> str:
    """
    Builds a clean, structured conversation thread for CRM ticket descriptions.
    - If history is empty, returns the latest customer message directly (up to max_chars).
    - Limits history to the last max_messages to avoid huge transcripts in CRM tickets.
    - Strips repetitive sign-offs, email disclaimers, and boilerplate.
    - Condenses verbose bot diagnostic turns to avoid crowding out customer messages.
    - Formats with clear section headers: [LATEST CUSTOMER INQUIRY] and [RECENT THREAD CONTEXT].
    - Newest-first turn retention: preserves latest diagnostic exchanges right before escalation,
      dropping oldest turns if necessary.
    - Caps overall string length to max_chars (default 8,000) to fit safely within CRM limits (Zoho Desk, Freshdesk, Zendesk).
    """
    current_body_clean = _strip_boilerplate((current_body or "").strip())
    if not history:
        if len(current_body_clean) > max_chars:
            return current_body_clean[:max_chars - 30] + "\n[...truncated]"
        return current_body_clean

    # Defensive ceiling for latest inquiry so it doesn't starve multi-turn context
    max_latest_inquiry_chars = 3500
    if len(current_body_clean) > max_latest_inquiry_chars:
        current_body_clean = current_body_clean[:max_latest_inquiry_chars - 35] + "\n[...latest message truncated...]"

    recent_history = history[-max_messages:] if len(history) > max_messages else history
    raw_turns = []

    for entry in recent_history:
        role = entry.get("role", "")
        role_label = "Customer" if role == "customer" else "Support"
        ts = entry.get("timestamp", "")
        ts_label = f" [{ts[:16]}]" if ts else ""
        body_text = (entry.get("body") or "").strip()
        if not body_text:
            continue

        if role == "customer":
            cleaned_msg = _strip_boilerplate(body_text)
        else:
            cleaned_msg = _condense_support_turn(body_text)

        if cleaned_msg:
            raw_turns.append(f"{role_label}{ts_label}:\n\n{cleaned_msg}")

    sections = []
    if current_body_clean:
        sections.append(f"=== LATEST CUSTOMER INQUIRY ===\n\n{current_body_clean}")

    base_header_len = len("\n\n".join(sections)) if sections else 0
    budget_for_history = max(0, max_chars - base_header_len - 150)

    selected_turns = []
    current_history_len = 0
    divider_len = len("\n\n-----------------------------------\n\n")
    omitted_count = 0

    for turn in reversed(raw_turns):
        turn_cost = len(turn) + (divider_len if selected_turns else 0)
        if current_history_len + turn_cost <= budget_for_history:
            selected_turns.append(turn)
            current_history_len += turn_cost
        else:
            omitted_count += 1

    selected_turns.reverse()

    if selected_turns:
        thread_body = "\n\n-----------------------------------\n\n".join(selected_turns)
        if omitted_count > 0:
            header_text = f"=== RECENT THREAD CONTEXT (Last {len(selected_turns)} Messages; {omitted_count} Older Omitted) ==="
        else:
            header_text = f"=== RECENT THREAD CONTEXT (Last {len(selected_turns)} Messages) ==="
        sections.append(f"{header_text}\n\n{thread_body}")

    result = "\n\n".join(sections)
    if len(result) > max_chars:
        result = result[:max_chars - 20] + "\n[...truncated]"
    return result



def build_context_data_base(
    client_id: str,
    from_email: str,
    subject: str,
    body: str,
    cleaned_body: str,
    ticket_id: Optional[str] = None,
    intent: str = "general_query",
    sentiment: str = "Neutral",
    priority: str = "Medium",
    history: Optional[list] = None,
    order_id: Optional[str] = None,
    payment_id: Optional[str] = None,
    reference_id: Optional[str] = None,
    thread_id: Optional[str] = None,
    customer_name: Optional[str] = None,
) -> dict:
    """
    Cheap fields only — no LLM calls. Called once per email in
    worker/tasks.py, before PATH A/B/C branching, replacing today's
    ad-hoc inline variable assembly.
    """
    from app.llm import extract_name_from_email
    from app.utils import normalize_subject
    clean_sub = normalize_subject(subject, cleaned_body or body or "")

    ref_id = reference_id or order_id or payment_id or ticket_id
    ord_id = order_id or ref_id or ticket_id
    pay_id = payment_id or ref_id or ticket_id
    tkt_id = ticket_id or ref_id or ord_id

    if customer_name and customer_name.strip():
        raw_name = customer_name.strip()
    elif from_email:
        raw_name = extract_name_from_email(from_email)
    else:
        raw_name = "Customer"

    name_parts = raw_name.strip().split(None, 1) if raw_name else []
    if len(name_parts) >= 2:
        first_name, last_name = name_parts[0], name_parts[1]
    elif len(name_parts) == 1 and name_parts[0].lower() not in ("customer", ""):
        first_name = name_parts[0]
        last_name = "Customer"
    else:
        first_name, last_name = "Valued", "Customer"
        if not raw_name or raw_name.lower() == "customer":
            raw_name = "Valued Customer"

    prio_str = str(priority or "Medium").strip().capitalize()
    priority_lower_map = {
        "Critical": "urgent",
        "Urgent": "urgent",
        "High": "high",
        "Medium": "normal",
        "Low": "low",
    }
    priority_num_map = {
        "Critical": 4,
        "Urgent": 4,
        "High": 3,
        "Medium": 2,
        "Low": 1,
    }
    p_lower = priority_lower_map.get(prio_str, prio_str.lower())
    p_num = priority_num_map.get(prio_str, 2)

    return {
        "client_id": client_id or "",
        "from_email": from_email or "",
        "subject": clean_sub,
        "body": body if body is not None else "",
        "cleaned_body": cleaned_body if cleaned_body is not None else (body or ""),
        "ticket_id": tkt_id,
        "order_id": ord_id,
        "payment_id": pay_id,
        "reference_id": ref_id,
        "thread_id": str(thread_id or ref_id or ""),
        "intent": intent or "general_query",
        "sentiment": sentiment or "Neutral",
        "priority": priority or "Medium",
        "priority_lower": p_lower,
        "priority_num": p_num,
        "customer_name": raw_name,
        "first_name": first_name,
        "last_name": last_name,
        "conversation_history": format_conversation_thread(history or [], body if body is not None else ""),
    }



def resolve_expensive_keys(needed_keys: set, body: str, history: list, old_summary: str = "") -> dict:
    """
    Called ONLY by the executor, after it has determined which
    placeholders the selected template actually references. Never call
    this from worker/tasks.py directly.
    """
    from app.llm import generate_summary_llm, extract_issue_description
    result = {}
    if "history_summary" in needed_keys:
        result["history_summary"] = generate_summary_llm(
            context="", customer_body=body, history=history, old_summary=old_summary
        )
    if "issue_description" in needed_keys:
        result["issue_description"] = extract_issue_description(body, history)
    return result
import re
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


def strip_reasoning_and_think_tags(text: str) -> str:
    if not isinstance(text, str):
        return text
    # 1. Strip closed tags first
    cleaned = re.sub(r'<think>[\s\S]*?</think>', '', text, flags=re.IGNORECASE)
    cleaned = re.sub(r'<thought>[\s\S]*?</thought>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'<reasoning>[\s\S]*?</reasoning>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'```thinking[\s\S]*?```', '', cleaned, flags=re.IGNORECASE)

    # 2. If closed tag didn't match and unclosed tag exists (e.g. truncated mid-thought)
    if '<think>' in cleaned.lower():
        cleaned = re.sub(r'<think>[\s\S]*$', '', cleaned, flags=re.IGNORECASE)
    if '<thought>' in cleaned.lower():
        cleaned = re.sub(r'<thought>[\s\S]*$', '', cleaned, flags=re.IGNORECASE)
    if '<reasoning>' in cleaned.lower():
        cleaned = re.sub(r'<reasoning>[\s\S]*$', '', cleaned, flags=re.IGNORECASE)
    if '```thinking' in cleaned.lower():
        cleaned = re.sub(r'```thinking[\s\S]*$', '', cleaned, flags=re.IGNORECASE)

    cleaned = cleaned.strip()

    # 3. If cleaning removed everything because the output was 100% truncated thinking process,
    # recover the most recent greeting/message drafted in the thought process
    if not cleaned and text:
        match = re.search(r'(Hi\s+[^\n]+,\s*[\s\S]+)', text, flags=re.IGNORECASE)
        if match:
            cleaned = match.group(1).strip()
            # Clean any trailing thought markers
            cleaned = re.sub(r'</?think>.*$', '', cleaned, flags=re.IGNORECASE).strip()

    return cleaned.strip()


def extract_name_from_email(email: str) -> str:
    try:
        username = email.split('@')[0]
        name_parts = re.split(r'[._\-]', username)
        formatted_name = ' '.join(
            [part.capitalize() for part in name_parts if part]
        )
        return formatted_name if formatted_name else "Customer"
    except Exception:
        return "Customer"


def _format_history(history: list) -> str:
    if not history:
        return ""

    lines = ["--- Previous Conversation ---"]
    for entry in history:
        role_label = "Customer" if entry.get("role") == "customer" else "Support"
        ts      = entry.get("timestamp", "")[:16]
        subject = entry.get("subject", "")
        body    = entry.get("body", "")[:300]
        ticket  = entry.get("ticket_id", "")

        line = f"[{ts}] {role_label}"
        if ticket:
            line += f" (Ticket: {ticket})"
        line += f"\nSubject: {subject}\n{body}"
        lines.append(line)

    lines.append("--- End of History ---")
    return "\n\n".join(lines)


def extract_ticket_and_order_ids(text: str, custom_regex: Optional[str] = None) -> list[str]:
    """
    Extracts all ticket IDs, order numbers, case numbers, and reference numbers
    from text using comprehensive regex patterns and optional tenant custom regex.
    Returns cleaned, deduplicated IDs.
    Also handles email line-wrapping/folding across newlines.
    """
    if not text:
        return []

    # Normalize soft line breaks ONLY within ticket tokens split across lines (e.g., #27542400000039\r\n9001 -> #275424000000399001)
    texts_to_check = [text]
    unwrapped_text = re.sub(r'(#\d+|\bT-\d+|\bORD-\d+|\bINC\d+|\d+)[\r\n]+(\d+)', r'\1\2', text)
    if unwrapped_text != text:
        texts_to_check.append(unwrapped_text)

    ids = []
    # 0. Custom tenant regex if provided
    if custom_regex:
        try:
            compiled = re.compile(custom_regex, re.IGNORECASE)
            for t in texts_to_check:
                for m in compiled.finditer(t):
                    val = m.group(1) if m.groups() else m.group(0)
                    if val and str(val).strip():
                        ids.append(str(val).strip())
        except Exception as e:
            logger.warning(f"⚠️ Custom regex '{custom_regex}' evaluation failed: {e}")

    for t in texts_to_check:
        # 1. Standard pattern formats like T-YYMMDD-XXXXX
        for m in re.finditer(r'\b(T-\d{6}-\d+)\b', t, re.IGNORECASE):
            ids.append(m.group(1).upper())
        # 2. Common CRM / Ticketing prefixes (ORD, INC, CAS, SR, REQ)
        for m in re.finditer(r'\b(ORD-?\d+|INC\d+|CAS-\d+(?:-[A-Za-z0-9]+)?|SR-\d+|REQ\d+)\b', t, re.IGNORECASE):
            ids.append(m.group(1).upper())
        # 3. Explicit keywords: ticket/case/order/complaint/issue/ref followed by an ID
        for m in re.finditer(r'(?:ticket|case|order|complaint|issue|incident|ref(?:erence)?)\s*(?:id|no|num|number)?\s*[:#\s-]?\s*#?([A-Za-z0-9_-]{1,30})', t, re.IGNORECASE):
            val = m.group(1).strip()
            if not re.search(r'\d', val):
                continue
            if val.lower() not in (
                "status", "update", "details", "information", "number", "issue", "query",
                "support", "please", "regarding", "about", "there", "here", "with", "from",
                "that", "this", "resolved", "fixed", "been", "have"
            ):
                ids.append(val)
        # 4. Hash followed by digits/alphanumeric (e.g. #275424000000399001, #98765, #121)
        for m in re.finditer(r'#([A-Za-z0-9_-]{1,30})', t):
            val = m.group(1).strip()
            if val and re.search(r'\d', val):
                ids.append(val)

    clean_ids = []
    for item in ids:
        cleaned = item.strip().lstrip("#").strip()
        if cleaned and cleaned not in clean_ids:
            if any(c != cleaned and cleaned in c for c in ids):
                continue
            clean_ids.append(cleaned)
    return clean_ids


def extract_entities_categorized(
    text: str,
    custom_order_regex: Optional[str] = None,
    custom_ticket_regex: Optional[str] = None
) -> dict[str, list[str]]:
    """
    Categorizes extracted entity tokens into orders vs tickets.
    Returns: {"orders": list[str], "tickets": list[str], "all": list[str]}
    """
    if not text:
        return {"orders": [], "tickets": [], "all": []}

    all_ids = extract_ticket_and_order_ids(text)
    orders = []
    tickets = []

    # Custom regex exact matches
    if custom_order_regex:
        try:
            c_ord = re.compile(custom_order_regex, re.IGNORECASE)
            for m in c_ord.finditer(text):
                val = (m.group(1) if m.groups() else m.group(0)).strip().lstrip("#")
                if val and val not in orders:
                    orders.append(val)
        except Exception as e:
            logger.warning(f"⚠️ Custom order regex '{custom_order_regex}' failed: {e}")

    if custom_ticket_regex:
        try:
            c_tick = re.compile(custom_ticket_regex, re.IGNORECASE)
            for m in c_tick.finditer(text):
                val = (m.group(1) if m.groups() else m.group(0)).strip().lstrip("#")
                if val and val not in tickets:
                    tickets.append(val)
        except Exception as e:
            logger.warning(f"⚠️ Custom ticket regex '{custom_ticket_regex}' failed: {e}")

    # Categorize remaining tokens by prefix and keyword proximity
    text_lower = text.lower()
    for token in all_ids:
        if token in orders or token in tickets:
            continue
        token_upper = token.upper()
        # Direct prefix checks
        if token_upper.startswith("ORD") or token_upper.startswith("ORDER"):
            if token not in orders:
                orders.append(token)
            continue
        if any(token_upper.startswith(p) for p in ("T-", "INC", "CAS", "SR", "REQ")):
            if token not in tickets:
                tickets.append(token)
            continue

        # Proximity keyword check in text
        escaped_tok = re.escape(token)
        order_pattern = rf'(?:order|purchase|tracking|shipment)\s*(?:id|no|num|number)?\s*[:#\s-]?\s*#?{escaped_tok}'
        ticket_pattern = rf'(?:ticket|case|complaint|incident|issue|ref)\s*(?:id|no|num|number)?\s*[:#\s-]?\s*#?{escaped_tok}'

        is_order = bool(re.search(order_pattern, text_lower))
        is_ticket = bool(re.search(ticket_pattern, text_lower))

        if is_order and not is_ticket:
            if token not in orders:
                orders.append(token)
        elif is_ticket and not is_order:
            if token not in tickets:
                tickets.append(token)
        else:
            # Fallback: if token has length > 12 (typical 18-digit CRM ticket) -> tickets, else if "order" in text -> orders, else tickets
            if len(token) > 12:
                if token not in tickets:
                    tickets.append(token)
            elif "order" in text_lower and "ticket" not in text_lower:
                if token not in orders:
                    orders.append(token)
            else:
                if token not in tickets:
                    tickets.append(token)

    # Ensure all_ids contains all found orders and tickets
    combined_all = list(dict.fromkeys(orders + tickets + all_ids))
    return {
        "orders": orders,
        "tickets": tickets,
        "all": combined_all
    }


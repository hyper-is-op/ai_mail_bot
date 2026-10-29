import re
import logging
from typing import Tuple, Optional, List
from app.llm import extract_name_from_email, generate_reply_llm
from app.connector_executor import format_mapped_data_for_prompt
from app.scoring import llm_score
from app.email_disclaimers import get_active_disclaimer_texts

logger = logging.getLogger(__name__)


def is_pure_status_ping(body: str) -> bool:
    """
    Returns True if the email body is a simple, focused inquiry asking for
    the status or update of a ticket/order, with no secondary questions or new details.
    """
    if not body:
        return True

    # Strip quoted reply chains, headers, signatures
    cleaned = re.sub(r'(?m)^>.*$', '', body)
    cleaned = re.sub(r'(?i)-+Original Message-+[\s\S]*', '', cleaned)
    cleaned = re.sub(r'(?i)On\s+.+?\s+wrote:[\s\S]*', '', cleaned).strip()

    words = cleaned.split()
    if len(words) > 30:
        return False

    # Negative check: If email asks specific analytical questions or explains issues, not a pure ping
    complex_indicators = [
        "instead", "change", "changed", "wrong", "also", "attach", "attached",
        "screenshot", "urgent", "cancel", "refund", "address", "phone",
        "calling", "contact me at", "my number", "error code", "exception",
        "tried", "restarted", "why", "how come", "dissatisfied", "angry",
        "escalate", "manager", "broken", "crashing", "crash", "stuck",
        "freeze", "frozen", "down", "not working", "fails", "failed",
        "can you specify", "specify", "what was the problem", "which created",
        "caused", "cause", "what caused", "why did", "explain what"
    ]
    for ind in complex_indicators:
        if re.search(r'\b' + re.escape(ind) + r'\b', cleaned, re.IGNORECASE):
            return False

    return True


def generate_ticket_status_reply(
    client_id: str,
    from_email: str,
    subject: str,
    body: str,
    ticket_info: dict,
    ticket_id: str = None,
    history: list = None
) -> Tuple[str, int]:
    """
    Hybrid responder for CRM/order status inquiries:
    1. If ticket is Closed/Resolved: Returns closure template (score=95).
    2. If ticket is Active:
       - Pure status ping -> Fast standardized static template (score=95).
       - Compound inquiry -> Guardrailed LLM draft + score.
    """
    customer_name = extract_name_from_email(from_email)
    raw_status = str(ticket_info.get("ticket_status") or "Open").strip()
    status_lower = raw_status.lower()
    is_closed = status_lower in ("closed", "resolved", "completed", "cancelled", "canceled")
    display_ticket_id = ticket_info.get("ticket_number") or ticket_info.get("docket_no") or ticket_id or "N/A"

    dept_name = "Customer Support Team"
    company_name = ""
    try:
        from app.email_credential import get_email_account
        acc = get_email_account(client_id)
        if acc:
            dept_name = acc.get("department_name") or dept_name
            company_name = acc.get("company_name") or company_name
    except Exception:
        pass

    signoff_lines = ["Thanks & Regards,"]
    if dept_name:
        signoff_lines.append(f"Department: {dept_name}")
    if company_name:
        signoff_lines.append(f"Company: {company_name}")
    signoff_text = "\n".join(signoff_lines)

    raw_subject = str(ticket_info.get("subject") or "").strip()
    clean_subject = re.sub(r"\[.*?\]\s*", "", raw_subject).strip() if raw_subject else ""
    subject_block = f"- Issue Summary: {clean_subject}\n" if clean_subject else ""

    # 1. Closed or Resolved Ticket
    if is_closed:
        logger.info(f"ℹ️ Ticket #{display_ticket_id} is {raw_status} — drafting multilingual closure notification via LLM")
        from app.llm_config import client, resolve_model
        from app.llm_utils import strip_reasoning_and_think_tags

        prompt = f"""Write a polite, helpful email reply to {customer_name} regarding support ticket #{display_ticket_id}.

CRITICAL MULTILINGUAL INSTRUCTION:
- Detect the primary language of the customer's incoming message and compose your entire reply in that EXACT SAME language.
- Keep proper nouns and ticket reference #{display_ticket_id} unchanged.

TICKET DETAILS:
- Ticket Reference: #{display_ticket_id}
- Current Status: '{raw_status}' (Closed / Resolved)
{subject_block}

REQUIREMENTS:
1. Greet {customer_name} politely.
2. Inform them clearly that support ticket #{display_ticket_id}{f" regarding '{clean_subject}'" if clean_subject else ""} is currently marked as resolved/closed ('{raw_status}').
3. Let them know that if their issue is still occurring or if they have any follow-up questions, they can simply reply directly to this email with the details and our team will be happy to help.
4. Conclude naturally in the customer's language with:
{signoff_text}

OUTPUT CONSTRAINTS:
- Write ONLY the final plain-text email body.
- Do NOT include a "Subject:" line, markdown formatting, or meta-commentary."""
        try:
            res = client.chat.completions.create(
                model=resolve_model(client_id, "generate_reply_llm"),
                caller="drafter_closed_ticket",
                messages=[
                    {"role": "system", "content": "You are a helpful customer support agent. Reply concisely in the customer's language."},
                    {"role": "user", "content": f"Customer Message:\n{body}\n\nTask:\n{prompt}"}
                ],
                temperature=0.2,
                max_tokens=350
            )
            reply = strip_reasoning_and_think_tags(res.choices[0].message.content).strip()
            return reply, 95
        except Exception as e:
            logger.error(f"❌ Failed to generate closed ticket reply via LLM: {e}")
            reply = (
                f"Dear {customer_name},\n\n"
                f"Thank you for reaching out regarding ticket #{display_ticket_id}.\n\n"
                f"According to our records, this ticket has already been marked as '{raw_status}'.\n\n"
                f"If you still require assistance or if your issue is not resolved, please reply directly to this email or submit a new ticket, and our team will gladly assist you.\n\n"
                f"{signoff_text}"
            )
            return reply, 95

    # 2. Active Ticket: Pure Status Ping
    if is_pure_status_ping(body):
        logger.info(f"⚡ Pure status ping detected for ticket #{display_ticket_id} — drafting multilingual status update via LLM")
        tracking_block = ""
        if ticket_info.get("tracking_url"):
            tracking_block = f"Tracking Link: {ticket_info['tracking_url']}\n\n"

        from app.llm_config import client, resolve_model
        from app.llm_utils import strip_reasoning_and_think_tags

        prompt = f"""Write a prompt, courteous status update email to {customer_name} regarding support ticket #{display_ticket_id}.

CRITICAL MULTILINGUAL INSTRUCTION:
- Detect the primary language of the customer's incoming message and compose your entire reply in that EXACT SAME language.
- Keep proper nouns, ticket reference #{display_ticket_id}, and any URLs or tracking links unchanged.

TICKET DETAILS:
- Ticket Reference: #{display_ticket_id}
- Current Status: '{raw_status}'
{subject_block}{tracking_block}

REQUIREMENTS:
1. Greet {customer_name} politely.
2. Inform them that ticket #{display_ticket_id}{f" regarding '{clean_subject}'" if clean_subject else ""} is currently in '{raw_status}' status and is actively under review by our support team.
3. If tracking or additional status details are provided above, include them clearly without inventing any extra dates, links, or promises.
4. Let them know we will follow up as soon as there is a new update, and they can reply directly to this email if they need to add any further information.
5. Conclude naturally in the customer's language with:
{signoff_text}

OUTPUT CONSTRAINTS:
- Write ONLY the final plain-text email body.
- Do NOT include a "Subject:" line, markdown formatting, or meta-commentary."""
        try:
            res = client.chat.completions.create(
                model=resolve_model(client_id, "generate_reply_llm"),
                caller="drafter_status_ping",
                messages=[
                    {"role": "system", "content": "You are a helpful customer support agent. Reply concisely in the customer's language."},
                    {"role": "user", "content": f"Customer Message:\n{body}\n\nTask:\n{prompt}"}
                ],
                temperature=0.2,
                max_tokens=350
            )
            reply = strip_reasoning_and_think_tags(res.choices[0].message.content).strip()
            return reply, 95
        except Exception as e:
            logger.error(f"❌ Failed to generate status ping reply via LLM: {e}")
            reply = (
                f"Dear {customer_name},\n\n"
                f"Thank you for contacting us regarding your inquiry.\n\n"
                f"Your ticket (#{display_ticket_id}) is currently in '{raw_status}' status and is actively under review by our support team. "
                f"We are working on your request.\n\n"
                f"{tracking_block}"
                f"{signoff_text}"
            )
            return reply, 95

    # 3. Compound inquiry: Call LLM
    logger.info(f"🧠 Compound status inquiry detected for ticket #{display_ticket_id} — invoking guardrailed LLM")
    context = format_mapped_data_for_prompt(ticket_info)
    reply = generate_reply_llm(
        context=context,
        query=body,
        agent_type="crm_support_agent",
        from_email=from_email,
        history=history,
        is_status_inquiry=True
    )
    score = llm_score(reply, body)
    return reply, score


def append_client_disclaimers(client_id: str, reply_text: str) -> str:
    """Appends active disclaimers for the client to the reply."""
    try:
        disclaimers = get_active_disclaimer_texts(client_id)
        if disclaimers:
            reply_text = reply_text.rstrip() + "\n\n" + "\n\n".join(disclaimers)
    except Exception as e:
        logger.warning(f"⚠️ Failed to append disclaimers for client {client_id}: {e}")
    return reply_text

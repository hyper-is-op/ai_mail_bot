import re
import logging

from app.llm_utils import (
    strip_reasoning_and_think_tags,
    extract_name_from_email,
    _format_history,
)
from app.llm_prompts import AgentType, AGENT_PROMPTS, TONE_INSTRUCTIONS
from app.llm_config import client, current_client_id, resolve_model

logger = logging.getLogger(__name__)


# ==============================
# ✉️ Generate Reply
# ==============================
def generate_reply_llm(
    context: str,
    query: str,
    agent_type: AgentType,
    from_email: str = None,
    is_ticket: bool = False,
    ticket_id: str = None,
    history: list = None,
    is_status_inquiry: bool = False,
) -> str:
    """
    Generate professional email reply.
    history: list of prior conversation dicts from chat_history module.
    is_status_inquiry: when True, strictly prohibits hallucinating turnaround ETAs, diagnostic steps, or internal teams.
    """

    response_tone = "Formal"
    agent_type_override = agent_type  # keep caller's value as fallback
    department_name = None
    company_name = None
    client_id = current_client_id.get()
    if client_id and client_id != "SYSTEM":
        try:
            from app.email_credential import get_email_account
            account = get_email_account(client_id)
            if account:
                response_tone   = account.get("response_tone", "Formal")
                agent_type_override = account.get("agent_type", agent_type)
                department_name = account.get("department_name")
                company_name    = account.get("company_name")
        except Exception as e:
            logger.warning(f"Failed to fetch account profile: {e}")

    tone_instruction = TONE_INSTRUCTIONS.get(
        response_tone,
        f"Write your reply in a {response_tone} tone."
    )
    base_persona = AGENT_PROMPTS.get(agent_type_override, AGENT_PROMPTS["customer_support"])
    system_prompt = f"{base_persona}\n\nCRITICAL BRAND VOICE GUIDELINE: {tone_instruction}"

    customer_name = (
        extract_name_from_email(from_email)
        if from_email
        else "Customer"
    )

    logger.info(f"👤 Customer name: {customer_name}")

    history_block = _format_history(history or [])
    if history_block:
        logger.info(f"📜 Injecting {len(history or [])} history messages into prompt")

    # ==========================================
    # 🎫 Ticket Reply
    # ==========================================
    if is_ticket and ticket_id:

        if department_name:
            team_name = department_name
        else:
            agent_team_map = {
                "customer_support":     "Customer Support Team",
                "ecommerce_support":    "E-Commerce Support Team",
                "technical_support":    "Technical Support Team",
                "billing_support":      "Billing & Invoicing Team",
                "executive_escalation": "Executive Support Team",
                "customer_support_agent":  "Customer Support Team",
                "ecommerce_support_agent": "E-Commerce Support Team",
                "crm_support_agent":       "CRM Support Team"
            }
            team_name = agent_team_map.get(agent_type_override, "Support Team")

        # Extract effective customer message from query or dialogue history
        effective_customer_msg = (query or "").strip()
        if not effective_customer_msg and history:
            for h in reversed(history):
                if h.get("role") == "customer" and h.get("body"):
                    effective_customer_msg = h.get("body").strip()
                    break

        from app.prompt_service import format_prompt
        prompt = format_prompt(
            client_id=client_id,
            prompt_key="escalation_reply_prompt",
            customer_name=customer_name,
            ticket_id=ticket_id or "N/A",
            team_name=team_name,
            customer_message=effective_customer_msg or "Customer Technical Support Inquiry",
            issue_summary=context or "Technical Support Ticket"
        )


    # ==========================================
    # 💬 General Reply
    # ==========================================
    else:
        team_name = department_name or "Support Team"
        if company_name:
            team_name = f"{company_name} {team_name}"

        prompt = f"""
Customer Query:
{query}

Context Information:
{context}

{history_block}

Requirements:
- Answer the customer inquiry accurately using the context above.
- Follow the brand persona and tone.
- Conclude with:
Thanks & Regards,
{team_name}
"""

    try:
        logger.info("📧 Generating AI reply")
        logger.info(f"📋📋📋 Prompt context being sent to LLM: {context[:1000] if context else 'EMPTY'}")
        logger.info(f"📋📋📋 Ending")

        res = client.chat.completions.create(
            model=resolve_model(current_client_id.get(), "generate_reply_llm"),
            caller="generate_reply_llm",
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.2,
            reasoning_effort="none",
            max_tokens=1500
        )

        reply = strip_reasoning_and_think_tags(res.choices[0].message.content)
        
        # 1. Clean any trailing chain-of-thought analysis or numbered notes after the sign-off block
        signoff_match = re.search(r'((?:Thanks\s*(?:&|and)\s*Regards|Best\s*regards|Sincerely)[\s\S]*?\n[^\n]+)', reply, flags=re.IGNORECASE)
        if signoff_match:
            reply = reply[:signoff_match.end()].strip()

        # 2. Filter out any echoed prompt/instruction bullet lines
        clean_lines = []
        for line in reply.split("\n"):
            clean_l = line.strip().strip('"').strip("'")
            if re.match(r'^\*?\s*(?:Write\s+\d|Mention\s+team|End\s+with|Return\s+ONLY|Start\s+with|Requirements:)', clean_l, flags=re.IGNORECASE):
                continue
            clean_lines.append(line)
        reply = "\n".join(clean_lines).strip().strip('"').strip("'")

        # 3. Strip any leaked "Subject: ..." or "Re: ..." header line placed at the very start of the email body
        reply = re.sub(r'^(?:Subject|Re):\s*[^\n]+\n+', '', reply, flags=re.IGNORECASE).strip()

        logger.info(f"✅ Reply generated successfully: {reply[:150]}...")
        return reply

    except Exception as e:
        logger.error(f"❌ Reply generation failed: {e}")
        return (
            "Sorry, we are unable to process "
            "your request at the moment."
        )


def generate_issue_resolved_reply(
    from_email: str,
    subject: str = "",
    query: str = "",
    ticket_id: str = None,
    history: list = None
) -> str:
    """
    Generates a polite, warm confirmation acknowledging that the customer's
    issue is resolved, without creating or modifying tickets.
    """
    customer_name = extract_name_from_email(from_email) if from_email else "Customer"
    client_id = current_client_id.get()
    department_name = None
    company_name = None
    response_tone = "Friendly"

    if client_id and client_id != "SYSTEM":
        try:
            from app.email_credential import get_email_account
            account = get_email_account(client_id)
            if account:
                response_tone = account.get("response_tone", "Friendly")
                department_name = account.get("department_name")
                company_name = account.get("company_name")
        except Exception as e:
            logger.warning(f"Failed to fetch account profile for resolved reply: {e}")

    team_name = department_name or "Support Team"
    if company_name:
        team_name = f"{company_name} {team_name}"

    ticket_mention = f" regarding ticket #{ticket_id}" if ticket_id else ""

    from app.prompt_service import format_prompt
    prompt = format_prompt(
        client_id=client_id,
        prompt_key="issue_resolved_reply_prompt",
        customer_name=customer_name,
        ticket_mention=ticket_mention,
        query=query,
        team_name=team_name,
        response_tone=response_tone
    )
    try:
        res = client.chat.completions.create(
            model=resolve_model(current_client_id.get(), "generate_reply_llm"),
            caller="generate_issue_resolved_reply",
            messages=[
                {"role": "system", "content": "You are a courteous customer support assistant. Write concise, warm emails in the customer's language."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=300
        )
        reply = strip_reasoning_and_think_tags(res.choices[0].message.content).strip()
        return reply
    except Exception as e:
        logger.error(f"❌ Failed to generate issue_resolved reply via LLM: {e}")
        return (
            f"Hi {customer_name},\n\n"
            f"Thank you for letting us know! We are glad to hear that your issue{ticket_mention} has been resolved.\n\n"
            f"If you ever need any further assistance, please feel free to reach back out.\n\n"
            f"Thanks & Regards,\n"
            f"{team_name}"
        )


def generate_off_topic_reply(
    from_email: str,
    subject: str = "",
    query: str = "",
    history: list = None
) -> str:
    """
    Generates a polite boundary-setting response for off-topic, gibberish,
    or non-support inquiries without escalating or creating tickets.
    """
    customer_name = extract_name_from_email(from_email) if from_email else "Customer"
    client_id = current_client_id.get()
    department_name = None
    company_name = None

    if client_id and client_id != "SYSTEM":
        try:
            from app.email_credential import get_email_account
            account = get_email_account(client_id)
            if account:
                department_name = account.get("department_name")
                company_name = account.get("company_name")
        except Exception as e:
            logger.warning(f"Failed to fetch account profile for off_topic reply: {e}")

    team_name = department_name or "Customer Support Team"
    if company_name:
        team_name = f"{company_name} {team_name}"

    from app.prompt_service import format_prompt
    prompt = format_prompt(
        client_id=client_id,
        prompt_key="off_topic_reply_prompt",
        customer_name=customer_name,
        team_name=team_name
    )
    prompt = f"Customer Query:\n{query}\n\nTask:\n{prompt}"
    try:
        res = client.chat.completions.create(
            model=resolve_model(current_client_id.get(), "generate_reply_llm"),
            caller="generate_ticket_status_reply",
            messages=[
                {"role": "system", "content": "You are a professional customer support assistant. Write concise, polite boundary-setting emails in the customer's language."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=300
        )
        reply = strip_reasoning_and_think_tags(res.choices[0].message.content).strip()
        return reply
    except Exception as e:
        logger.error(f"❌ Failed to generate off_topic reply via LLM: {e}")
        return (
            f"Hi {customer_name},\n\n"
            f"Thank you for contacting us. We received your email, but were unable to identify a specific question or support request.\n\n"
            f"If you need assistance with our products or services, please reply with details and we will be glad to help.\n\n"
            f"Thanks & Regards,\n"
            f"{team_name}"
        )

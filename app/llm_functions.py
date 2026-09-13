import re
import json
import logging

from app.llm_utils import (
    strip_reasoning_and_think_tags,
    extract_name_from_email,
    extract_ticket_and_order_ids,
    _format_history,
)
from app.llm_prompts import AgentType, AGENT_PROMPTS, TONE_INSTRUCTIONS
from app.llm_config import client, current_client_id, resolve_model

logger = logging.getLogger(__name__)


# ==============================
# 🧠 Detect Intent
# ==============================
def detect_intent_llm(query: str) -> dict:
    prompt = f"""
You are a query classifier. Your only job is to analyze the user query and return structured JSON.

## Task
Classify the query into exactly one intent, extract ALL ticket_ids/order_ids if present, perform sentiment analysis, and assign a priority level.

## Intents
- `issue_resolved`: Customer explicitly indicates that their problem, issue, ticket, or inquiry has been resolved, fixed, sorted out, is working fine now, or they no longer need assistance (with no new questions or pending problems).
- `off_topic_nonsense`: Standalone greetings/casual openers with no issue described (e.g. "hello", "hi there", "hello ladies", "hey guys", "good morning"), unintelligible gibberish, keyboard mash, spam, test text, blank/random characters, or completely off-topic emails unrelated to company support, products, or services.
- `ticket_create`: User is explicitly asking to create, open, raise, or log a new ticket/complaint/case, or asking support to create a ticket for their issue
- `ticket_status`: User is asking about status of an existing ticket, order, complaint, delivery, or support request
- `marketing_promotional`: Marketing email, promotional campaign, newsletter, job alert blast, webinar invite, discount/sale offer, automated digest, or educational course advertisement (requiring no customer support action)
- `general_query`: Genuine customer support query, product question, policy inquiry, technical issue, or problem description requiring an answer (MUST contain an actual question, problem, or inquiry).

## Sentiment Analysis
Classify user sentiment into exactly one of:
- `Angry`: User shows frustration, anger, impatience, or threatens escalation/cancellation.
- `Neutral`: General query, factual, standard request, off-topic, or marketing/newsletter announcement.
- `Happy`: Expresses gratitude, happiness, satisfaction, or that their issue is resolved.

## Priority Tagging
Classify priority level into exactly one of:
- `Critical`: Urgent issues like order cancellation, immediate refunds, lawsuit threats, legal actions, security/data issues, or extreme user anger.
- `High`: General support issues with angry/impatient sentiment, or containing key words like "urgent", "broken", "cancel", "refund", "sue", "failed".
- `Medium`: General query or ticket status checks with neutral sentiment.
- `Low`: Marketing/newsletter emails, promotional updates, positive feedback, issue resolved notices, off-topic nonsense, or suggestions.

## Ticket & Order ID Extraction
Extract ALL ticket IDs, case numbers, order IDs, or tracking references mentioned in the query.
Examples:
- Numeric & Hash IDs: `#275424000000399001`, `275424000000399001`, `#98765`, `#123456`
- Support tickets: `T-260505-00117`, `T-YYMMDD-XXXXX`
- Helpdesk / Incident / Case IDs: `INC1234567`, `CAS-98765`, `SR-10293`
- Order / Tracking IDs: `ORD12345`, `ORD-98765`, `ORDER#54321`

## Rules
- Return ONLY raw JSON. No explanation, no markdown, no extra text.
- Extract ALL ticket/order IDs found in the query into the `ticket_ids` list. Return clean IDs (strip leading '#' symbols).
- If no ticket_id is found, set ticket_ids to empty list [].
- If the query is just a greeting, salutation, or pleasantry with no issue described (e.g. "hi", "hello", "hello ladies", "good morning", "how are you"), intent MUST be `off_topic_nonsense`.
- Do NOT classify a query as `general_query` unless it presents an actual question, problem description, product inquiry, or request for support.
- If intent is `issue_resolved`, sentiment is typically `Happy` or `Neutral` and priority is `Low`.
- If intent is `off_topic_nonsense` or `marketing_promotional`, sentiment is typically `Neutral` and priority is `Low`.

## Output Format
{{
  "intent": "issue_resolved" | "off_topic_nonsense" | "ticket_create" | "ticket_status" | "marketing_promotional" | "general_query",
  "ticket_ids": ["<id1>", "<id2>"] | [],
  "sentiment": "Angry" | "Neutral" | "Happy",
  "priority": "Critical" | "High" | "Medium" | "Low"
}}

## User Query
{query}
"""

    try:
        logger.info("🧠 Detecting intent using LLM")

        res = client.chat.completions.create(
            model=resolve_model(current_client_id.get(), "detect_intent_llm"),
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a JSON-only response system. "
                        "Return ONLY valid JSON. No markdown, no explanation, no extra text."
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],  
            temperature=0,
            reasoning_effort="none"
        )

        output = res.choices[0].message.content.strip()
        logger.info(f"🧠 Intent raw output: {output}")

        match = re.search(r'\{.*\}', output, re.DOTALL)
        if not match:
            raise ValueError("No JSON object found in LLM response")

        cleaned_output = match.group(0).strip()
        logger.info(f"🧹 Cleaned JSON output: {cleaned_output}")

        data = json.loads(cleaned_output)
        intent = data.get("intent", "general_query")
        raw_ticket_ids = data.get("ticket_ids", [])
        sentiment = data.get("sentiment", "Neutral")
        priority = data.get("priority", "Medium")

        if isinstance(raw_ticket_ids, str):
            raw_ticket_ids = [raw_ticket_ids] if raw_ticket_ids else []

        cleaned_ticket_ids = []
        for tid in raw_ticket_ids:
            if isinstance(tid, str):
                c = tid.strip().lstrip("#").strip()
                if c and re.search(r'\d', c) and c.lower() not in ("none", "null", "n/a", "unknown") and c not in cleaned_ticket_ids:
                    cleaned_ticket_ids.append(c)

        # Regex fallback verification if LLM missed ticket IDs
        if not cleaned_ticket_ids:
            regex_ids = extract_ticket_and_order_ids(query)
            if regex_ids:
                cleaned_ticket_ids = regex_ids
                logger.info(f"🔎 Regex supplemented ticket IDs: {cleaned_ticket_ids}")

        logger.info(f"✅ Intent detected: intent={intent}, ticket_ids={cleaned_ticket_ids}, sentiment={sentiment}, priority={priority}")
        return {
            "intent": intent, 
            "ticket_ids": cleaned_ticket_ids, 
            "sentiment": sentiment, 
            "priority": priority,
            "used_fallback": False
        }

    except Exception as e:
        logger.error(f"❌ Intent detection failed: {e}")

        ticket_ids = []
        try:
            ticket_ids = extract_ticket_and_order_ids(query)
        except Exception:
            pass

        q_lower = query.lower().strip()
        
        # Check resolved patterns
        resolved_keywords = [
            "issue is resolved", "issue resolved", "problem is resolved", "problem resolved",
            "solved now", "fixed now", "working now", "it works now", "working fine now",
            "all good now", "never mind", "nevermind", "please close the ticket", "close ticket",
            "no longer need help", "resolved my issue"
        ]
        
        if any(rk in q_lower for rk in resolved_keywords):
            fallback_intent = "issue_resolved"
            fallback_priority = "Low"
            fallback_sentiment = "Happy"
        elif ticket_ids:
            fallback_intent = "ticket_status"
            fallback_priority = "Medium"
            fallback_sentiment = "Neutral"
        else:
            fallback_intent = "general_query"
            if any(w in q_lower for w in ["sue", "legal", "lawyer", "court", "scam"]):
                fallback_priority = "Critical"
                fallback_sentiment = "Angry"
            elif any(w in q_lower for w in ["refund", "cancel", "urgent", "wrong", "fake", "bad", "worst"]):
                fallback_priority = "High"
                fallback_sentiment = "Angry"
            elif any(w in q_lower for w in ["thanks", "thank you", "great", "good", "happy"]):
                fallback_priority = "Low"
                fallback_sentiment = "Happy"
            else:
                fallback_priority = "Medium"
                fallback_sentiment = "Neutral"

        logger.info(f"🔁 Fallback intent: intent={fallback_intent}, ticket_ids={ticket_ids}, sentiment={fallback_sentiment}, priority={fallback_priority}")
        return {
            "intent": fallback_intent, 
            "ticket_ids": ticket_ids, 
            "sentiment": fallback_sentiment, 
            "priority": fallback_priority,
            "used_fallback": True
        }


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

        prompt = f"""Write a professional email reply to {customer_name} acknowledging that support ticket #{ticket_id} has been logged and is currently in progress.

Customer Query:
{query}

Ticket Information:
- Ticket ID: {ticket_id}
- Customer Name: {customer_name}
{context}

Requirements:
1. Start with greeting: Hi {customer_name},
2. Acknowledge that ticket #{ticket_id} is registered and the team is reviewing their inquiry.
3. Keep it to 2-3 sentences.
4. Conclude with:
Thanks & Regards,
{team_name}

Write ONLY the final email message text. No preamble, no quotes, no explanation, no bulleted instructions.
"""

    # ==========================================
    # 💬 General Reply
    # ==========================================
    else:

        status_guardrails = ""
        if is_status_inquiry:
            status_guardrails = """- CRITICAL STATUS INQUIRY CONSTRAINTS:
  * State the current ticket/order status accurately as provided in Context.
  * NEVER invent, estimate, or promise timelines, ETAs, turnaround hours, or days (e.g. DO NOT say 'within 2 hours', 'within 24 hours', or 'within 48 hours').
  * NEVER invent fictional diagnostic procedures, manufacturing logs, internal QA teams, or technician assignments.
  * Address any specific notes, questions, or updates the customer mentioned, and assure them their notes are logged for the support team.
  * Reassure the customer that the support team is actively reviewing the case."""

        prompt = f"""
Customer Name:
{customer_name}

{history_block}

Context:
{context}

Customer Query:
{query}

Instructions:
- Be professional
- Be concise
- Do NOT hallucinate
- NEVER claim or state that a ticket has been created, and NEVER output placeholder ticket references like "[Insert Ticket ID]" or "[Ticket Number]" or "[Ticket ID]".
{status_guardrails}
- If previous conversation exists above, maintain continuity — do not repeat what was already addressed
- If no answer available, say politely
- End professionally

Write the email reply.

Email Ending
Thanks & Regards,
dont add name section example "[Your Name]"
Department: {department_name or 'derive from agent_type'}
Company: {company_name or 'derive from context/email'}
"""

    try:
        logger.info("📧 Generating AI reply")
        logger.info(f"📋📋📋 Prompt context being sent to LLM: {context[:1000] if context else 'EMPTY'}")
        logger.info(f"📋📋📋 Ending")

        res = client.chat.completions.create(
            model=resolve_model(current_client_id.get(), "generate_reply_llm"),
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

    prompt = f"""Write a short, professional, and courteous email response to {customer_name}.
The customer sent an email stating that their issue{ticket_mention} has been resolved / is working fine.

Customer Query:
{query}

Requirements:
1. Greet: Hi {customer_name},
2. Express that you are glad to hear everything is sorted out and working properly.
3. Let them know they are welcome to reach back out anytime if they need any further assistance.
4. Keep it concise (2-3 sentences total).
5. Tone: {response_tone}
6. Conclude with:
Thanks & Regards,
{team_name}

Write ONLY the final email text. No explanation, no quotes.
"""
    try:
        res = client.chat.completions.create(
            model=resolve_model(current_client_id.get(), "generate_reply_llm"),
            messages=[
                {"role": "system", "content": "You are a courteous customer support assistant. Write concise, warm emails."},
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

    prompt = f"""Write a polite, professional customer support email to {customer_name}.
The customer sent an email that appears to be incomplete, gibberish, or outside the scope of customer support:

Customer Email:
{query}

Requirements:
1. Greet: Hi {customer_name},
2. Politely mention that we received their email, but we were unable to identify a clear support request or inquiry from the message.
3. Invite them to reply with specific details or order/account information if they require assistance with our products or services.
4. Keep it concise, respectful, and helpful (2-3 sentences max).
5. Conclude with:
Thanks & Regards,
{team_name}

Write ONLY the final email text. No explanation, no quotes.
"""
    try:
        res = client.chat.completions.create(
            model=resolve_model(current_client_id.get(), "generate_reply_llm"),
            messages=[
                {"role": "system", "content": "You are a professional customer support assistant. Write concise, polite boundary-setting emails."},
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


def design_payload(
    paylod1: dict,
    mail_id: str,
    subject: str,
    body: str,
    status: str,
    personal_details: dict = None
) -> dict:

    personal_details = personal_details or {}

    prompt = f"""
You are a payload mapping system.

You will be given a TEMPLATE payload and dynamic input data.
Your job is to map the dynamic input data into the same structure as the TEMPLATE payload.

TEMPLATE PAYLOAD:
{json.dumps(paylod1, indent=2)}

DYNAMIC INPUT DATA:
- mail_id: {mail_id}
- subject: {subject}
- body: {body}
- status: {status}

BODY CLEANING RULES:
- Remove email signatures (lines starting with "--")
- Remove disclaimer sections ("DISCLAIMER:", "This email and its attachments")
- Remove forwarded email headers ("From:", "Sent:", "To:", "Cc:")
- Use only the core message content for "description" or similar fields

PERSONAL DETAILS:
{json.dumps(personal_details, indent=2)}

MAPPING RULES:
- Keep all keys from the TEMPLATE exactly as they are
- Keep all values from the TEMPLATE that are NOT related to the dynamic input
- Replace ONLY the values that logically match the dynamic input:
  * "description" or similar → use body
  * "email" → use mail_id
  * "ticket_status" → use status
  * "subject" or similar → use subject
- Map PERSONAL DETAILS into the template where logical:
  * "person_name", "name", "customer_name" or similar → use personal_details name fields
  * "first_name" → use personal_details first_name if available
  * "last_name" → use personal_details last_name if available
  * "mobile_no", "phone", "contact" or similar → use personal_details phone/mobile if available
  * If a personal detail field has no match in template, ignore it
  * If template has a personal field but personal_details is empty, keep template value as-is
- Do NOT add new keys
- Do NOT remove existing keys
- Do NOT change data types

Return ONLY valid JSON. No explanation. No markdown. No extra text.
"""

    try:
        res = client.chat.completions.create(
            model=resolve_model(current_client_id.get(), "design_payload"),
            messages=[
                {
                    "role": "system",
                    "content": "You are a JSON-only response system. Return ONLY valid JSON. No markdown. No explanation."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0,
            reasoning_effort="none"
        )

        output = res.choices[0].message.content.strip()

        match = re.search(r'\{.*\}', output, re.DOTALL)
        if not match:
            raise ValueError("No JSON found in LLM response")

        return json.loads(match.group(0))

    except Exception as e:
        logger.error(f"❌ Payload design failed: {e}")
        fallback = paylod1.copy()
        fallback["description"] = body
        fallback["email"] = mail_id
        fallback["ticket_status"] = status
        if personal_details:
            fallback["person_name"] = personal_details.get("name") or personal_details.get("person_name", fallback.get("person_name", ""))
            fallback["mobile_no"] = personal_details.get("mobile") or personal_details.get("mobile_no", fallback.get("mobile_no", ""))
        return fallback


# ==============================
# 🔍 Scan History for Ticket ID
# ==============================
def scan_history_for_ticket(query: str, history: list) -> dict:
    """
    LLM scans conversation history to find a relevant ticket/order ID
    for the current customer query.

    Returns:
        {"found": True,  "ticket_id": "275424000000399001", "ambiguous": False}
        {"found": False, "ticket_id": None, "ambiguous": False}
        {"found": True, "ticket_id": None, "ambiguous": True, "ticket_ids": [...]}
    """
    if not history:
        return {"found": False, "ticket_id": None, "ambiguous": False}

    # Format history for prompt
    history_text = _format_history(history)

    prompt = f"""
You are a support assistant analyzing a conversation history to find a relevant ticket or order ID.

## Current Customer Query
{query}

## Conversation History
{history_text}

## Task
1. Look through the conversation history for any ticket/case IDs (e.g. #275424000000399001, T-260601-12345, INC123456) or order IDs (e.g. ORD12345, #98765).
2. Determine if any of them are relevant to the current query.
3. CRITICAL FOLLOW-UP RULE: If the customer's query is a follow-up inquiry, question, or reply referring to their ongoing conversation, past problem, root cause, or resolution (e.g. "why was the problem", "what caused it", "why did this happen", "is it resolved", "thank you", "any update"), map it to the most recent ticket ID found in the conversation history rather than returning false.
4. If one is clearly relevant or inferred from the thread, return it (clean ID without '#').
5. If multiple distinct unresolved tickets exist and you genuinely cannot determine which is relevant, return them as ambiguous.
6. If no ticket IDs exist anywhere in the conversation history, return not found.

## Output Format
Return ONLY valid JSON. No explanation. No markdown.

If one relevant ID found:
{{"found": true, "ticket_id": "<id>", "ambiguous": false}}

If multiple found and cannot decide:
{{"found": true, "ticket_id": null, "ambiguous": true, "ticket_ids": ["<id1>", "<id2>"]}}

If none found:
{{"found": false, "ticket_id": null, "ambiguous": false}}
"""

    try:
        res = client.chat.completions.create(
            model=resolve_model(current_client_id.get(), "scan_history_for_ticket"),
            messages=[
                {
                    "role": "system",
                    "content": "You are a JSON-only response system. Return ONLY valid JSON. No markdown. No explanation."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0,
            reasoning_effort="none"
        )

        output = res.choices[0].message.content.strip()
        logger.info(f"🔍 History scan raw output: {output}")

        match = re.search(r'\{.*\}', output, re.DOTALL)
        if not match:
            raise ValueError("No JSON found in history scan response")

        data = json.loads(match.group(0).strip())
        
        # Clean ticket_id or ticket_ids in output
        tid = data.get("ticket_id")
        if isinstance(tid, str):
            data["ticket_id"] = tid.strip().lstrip("#").strip()

        tids = data.get("ticket_ids", [])
        if isinstance(tids, list):
            cleaned_list = []
            for item in tids:
                if isinstance(item, str):
                    c = item.strip().lstrip("#").strip()
                    if c and c not in cleaned_list:
                        cleaned_list.append(c)
            data["ticket_ids"] = cleaned_list

        logger.info(f"✅ History scan result: {data}")
        return data

    except Exception as e:
        logger.error(f"❌ History scan failed: {e}")
        # Regex fallback scanning history
        history_ids = extract_ticket_and_order_ids(history_text)
        if len(history_ids) == 1:
            return {"found": True, "ticket_id": history_ids[0], "ambiguous": False}
        elif len(history_ids) > 1:
            return {"found": True, "ticket_id": None, "ambiguous": True, "ticket_ids": history_ids}
        return {"found": False, "ticket_id": None, "ambiguous": False}


# ==============================
# 🧹 Extract Issue Description
# ==============================
def extract_issue_description(body: str, history: list = None) -> str:
    """
    Extract a clean 2–3 sentence problem description from a customer email body.
    Strips greetings, signatures, prior-thread noise, and filler.
    Used before creating a ticket when the customer has described their issue
    after a failed ticket-ID verification.

    Returns a plain string suitable for use as ticket `problem_description`.
    Falls back to a truncated version of body on failure.
    """
    history_block = _format_history(history or [])

    prompt = f"""
You are a support ticket assistant. Extract a clean, concise problem description
from the customer email below.

## Rules
- Return 2–3 sentences maximum.
- Use only information present in the email body.
- Strip greetings, sign-offs, pleasantries, and email-thread boilerplate.
- Strip any prior quoted/forwarded content.
- Do NOT invent or infer details not stated by the customer.
- Return ONLY the plain description text. No labels, no JSON, no markdown.

{history_block}

## Customer Email Body
{body}
"""

    try:
        logger.info("🧹 Extracting issue description from customer body")

        res = client.chat.completions.create(
            model=resolve_model(current_client_id.get(), "extract_issue_description"),
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a precise extraction system. "
                        "Return only the plain extracted text, nothing else."
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0,
            reasoning_effort="none"
        )

        description = res.choices[0].message.content.strip()
        logger.info(f"✅ Issue description extracted: {description[:120]}...")
        return description

    except Exception as e:
        logger.error(f"❌ Issue description extraction failed: {e}")
        # Graceful fallback: trim raw body to 500 chars
        return body[:500].strip()


# ==============================
# 📝 Generate Issue Summary
# ==============================
def generate_summary_llm(
    context: str,
    customer_body: str,
    history: list = None,
    old_summary: str = ""
) -> str:
    """
    Generate or update a concise 250-character summary of the customer issue.

    Sources used (in order of priority):
    1. old_summary — existing summary from MySQL chat_history (if any)
    2. history     — Redis conversation history for this customer+ticket
    3. context     — ticket/API context passed to generate_reply_llm
    4. customer_body — the current incoming email body

    Returns a plain string, max 250 characters.
    Falls back to a truncated customer_body on failure.
    """
    history_block = _format_history(history or [])

    old_summary_block = ""
    if old_summary:
        old_summary_block = f"## Existing Summary (update this, do not repeat it verbatim)\n{old_summary}\n"

    prompt = f"""
You are a support ticket summariser.
Generate a concise summary of the customer's issue in 250 characters or less.

## Rules
- Maximum 250 characters — hard limit, no exceptions.
- Plain text only. No bullet points, no labels, no JSON, no markdown.
- Capture: what the problem is, current status if known, any resolution steps taken.
- If an existing summary is provided, update it with new information — do not repeat it verbatim.
- Do NOT include customer name, ticket ID, or email address.
- Do NOT invent details not present in the sources below.

{old_summary_block}

## Conversation History
{history_block if history_block else "No prior history."}

## Ticket / API Context
{context if context else "No context available."}

## Current Customer Email
{customer_body}

Return ONLY the plain summary text. Nothing else.
"""

    try:
        logger.info("📝 Generating issue summary")

        res = client.chat.completions.create(
            model=resolve_model(current_client_id.get(), "generate_summary_llm"),
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a concise summariser. "
                        "Return only plain text under 250 characters. No labels, no formatting."
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0,
            reasoning_effort="none"
        )

        summary = res.choices[0].message.content.strip()

        # Hard enforce 250 char limit
        if len(summary) > 250:
            summary = summary[:247] + "..."

        logger.info(f"✅ Summary generated: {summary}")
        return summary

    except Exception as e:
        logger.error(f"❌ Summary generation failed: {e}")
        return customer_body[:247].strip() + "..." if len(customer_body) > 247 else customer_body.strip()

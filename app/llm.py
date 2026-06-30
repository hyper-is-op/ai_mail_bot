import os
import re
import json
import logging
from openai import OpenAI
from pydantic import BaseModel
from typing import Literal

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)

MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

import time
import inspect
import contextvars

current_client_id = contextvars.ContextVar("current_client_id", default="SYSTEM")

def log_llm_metrics_db(client_id: str, model_name: str, prompt_tokens: int, completion_tokens: int, latency_ms: float, caller_function: str):
    model_lower = model_name.lower()
    if "70b" in model_lower:
        input_price, output_price = 0.59 / 1_000_000, 0.79 / 1_000_000
    elif "8x7b" in model_lower:
        input_price, output_price = 0.27 / 1_000_000, 0.27 / 1_000_000
    elif "8b" in model_lower:
        input_price, output_price = 0.05 / 1_000_000, 0.08 / 1_000_000
    else:
        input_price, output_price = 0.15 / 1_000_000, 0.60 / 1_000_000

    cost = (prompt_tokens * input_price) + (completion_tokens * output_price)

    # NEW: fetch multiplier and compute billed_cost
    multiplier = 1.0
    try:
        from app.db import get_db_ctx
        with get_db_ctx() as db:
            with db.cursor() as cursor:
                cursor.execute("SELECT cost_multiplier FROM email_accounts WHERE client_id=%s", (client_id,))
                row = cursor.fetchone()
                if row and row[0] is not None:
                    multiplier = float(row[0])
    except Exception:
        pass
    billed_cost = cost * multiplier

    from app.db import get_db_ctx
    try:
        with get_db_ctx() as db:
            with db.cursor() as cursor:
                cursor.execute("""
                INSERT INTO llm_logs (client_id, model_name, prompt_tokens, completion_tokens, cost, billed_cost, latency_ms, caller_function)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (client_id, model_name, prompt_tokens, completion_tokens, cost, billed_cost, int(latency_ms), caller_function))
            db.commit()
    except Exception as e:
        logger.warning(f"⚠️ Failed to write LLM telemetry log to database: {e}")

# Save original create method
_original_create = client.chat.completions.create

def telemetry_create(*args, **kwargs):
    caller = "unknown"
    try:
        stack = inspect.stack()
        if len(stack) > 1:
            caller = stack[1].function
    except Exception:
        pass

    start_time = time.time()
    res = _original_create(*args, **kwargs)
    latency_ms = (time.time() - start_time) * 1000

    try:
        model_name = kwargs.get("model", MODEL)
        prompt_tokens = 0
        completion_tokens = 0
        if res and hasattr(res, "usage") and res.usage:
            prompt_tokens = res.usage.prompt_tokens
            completion_tokens = res.usage.completion_tokens
        
        client_id = current_client_id.get()
        log_llm_metrics_db(client_id, model_name, prompt_tokens, completion_tokens, latency_ms, caller)
    except Exception as telemetry_err:
        logger.warning(f"Telemetry tracking error: {telemetry_err}")

    return res

client.chat.completions.create = telemetry_create

# MODEL = os.getenv("GROQ_MODEL", "qwen/qwen3-32b")


# ==============================
# 🔖 Agent Types
# ==============================
AgentType = Literal[
    "customer_support_agent",
    "ecommerce_support_agent",
    "crm_support_agent"
]

AGENT_PROMPTS = {
    "customer_support_agent": "You are a professional call center customer support agent.",
    "ecommerce_support_agent": "You are an e-commerce support agent handling orders, returns, and payments.",
    "crm_support_agent": "You are a CRM support agent managing client relationships and follow-ups."
}

class AgentRequest(BaseModel):
    agent_type: AgentType

def get_agent_prompt(request: AgentRequest) -> str:
    return AGENT_PROMPTS[request.agent_type]


# ==============================
# 👤 Extract Name from Email
# ==============================
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


# ==============================
# 📜 Format history for prompt
# ==============================
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


# ==============================
# 🧠 Detect Intent
# ==============================
def detect_intent_llm(query: str) -> dict:
    prompt = f"""
You are a query classifier. Your only job is to analyze the user query and return structured JSON.

## Task
Classify the query into exactly one intent, extract ALL ticket_ids if present, perform sentiment analysis, and assign a priority level.

## Intents
- `ticket_status`: User is asking about status of a ticket, order, complaint, delivery, or support request
- `general_query`: Everything else

## Sentiment Analysis
Classify user sentiment into exactly one of:
- `Angry`: User shows frustration, anger, impatience, or threatens escalation/cancellation.
- `Neutral`: General query, factual, standard request.
- `Happy`: Expresses gratitude, happiness, satisfaction.

## Priority Tagging
Classify priority level into exactly one of:
- `Critical`: Urgent issues like order cancellation, immediate refunds, lawsuit threats, legal actions, security/data issues, or extreme user anger.
- `High`: General support issues with angry/impatient sentiment, or containing key words like "urgent", "broken", "cancel", "refund", "sue", "failed".
- `Medium`: General query or ticket status checks with neutral sentiment.
- `Low`: Positive feedback, general suggestions, or thanking support.

## Ticket ID Patterns
- Support ticket: T-YYMMDD-XXXXX (e.g. T-260505-00117)
- Order ID: alphanumeric (e.g. ORD12345, #98765)

## Rules
- Return ONLY raw JSON. No explanation, no markdown, no extra text.
- Extract ALL ticket IDs found in the query into a list.
- If no ticket_id is found, set ticket_ids to empty list [].
- If intent is `general_query` and no ticket IDs are present, ticket_ids is always [].

## Output Format
{{
  "intent": "ticket_status" | "general_query",
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
            temperature=0
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
        ticket_ids = data.get("ticket_ids", [])
        sentiment = data.get("sentiment", "Neutral")
        priority = data.get("priority", "Medium")

        if isinstance(ticket_ids, str):
            ticket_ids = [ticket_ids] if ticket_ids else []

        logger.info(f"✅ Intent detected: intent={intent}, ticket_ids={ticket_ids}, sentiment={sentiment}, priority={priority}")
        return {
            "intent": intent, 
            "ticket_ids": ticket_ids, 
            "sentiment": sentiment, 
            "priority": priority
        }

    except Exception as e:
        logger.error(f"❌ Intent detection failed: {e}")

        ticket_ids = []
        try:
            matches = re.findall(r'(T-\d{6}-\d{5}|ORD\d+)', query, re.IGNORECASE)
            ticket_ids = matches if matches else []
        except Exception:
            pass

        fallback_intent = "ticket_status" if ticket_ids else "general_query"
        
        q_lower = query.lower()
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
            "priority": fallback_priority
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
    history: list = None
) -> str:
    """
    Generate professional email reply.
    history: list of prior conversation dicts from chat_history module.
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

    system_prompt = AGENT_PROMPTS.get(agent_type_override, AGENT_PROMPTS["customer_support_agent"]) + f"\n\nCRITICAL: You MUST write your reply in a {response_tone} tone. Adhere strictly to this tone (e.g., if Formal, be polite and structured; if Friendly, be warm and personal; if Concise, write the shortest possible correct reply; if Technical, explain technical details clearly)."

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
                "customer_support_agent":  "Customer Support Team",
                "ecommerce_support_agent": "E-Commerce Support Team",
                "crm_support_agent":       "CRM Support Team"
            }
            team_name = agent_team_map.get(agent_type_override, "Support Team")

        prompt = f"""
Generate a ticket acknowledgment email body using ONLY the information provided in the context below.
Do NOT invent, assume, or fill in any details not present in the context.
If a detail is missing, omit that line entirely.

{history_block}

## Ticket Details
Ticket ID: {ticket_id}
Customer Name: {customer_name}

## Context
{context}

## Output Format
Write ONLY the email body — do NOT include a Subject line.
Start directly with the greeting.

Hi {customer_name},

[2-3 sentences summarizing ticket status and remarks using only the context above.
Do NOT repeat the customer original query as the issue reported.]

Our team is actively working on your request and will keep you updated.

Thanks & Regards,
{team_name}

## Rules
- Return ONLY the email body. No subject line. No explanation. No preamble.
- Do not add any information not present in context.
- If this is a follow-up (history above), acknowledge it briefly.
- Keep it concise and professional.
- Do NOT add placeholder text like [Your Name] or [Company Name].
"""

    # ==========================================
    # 💬 General Reply
    # ==========================================
    else:

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
            temperature=0.7
        )

        reply = res.choices[0].message.content.strip()
        logger.info(f"✅ Reply generated successfully: {reply[:150]}...")
        return reply

    except Exception as e:
        logger.error(f"❌ Reply generation failed: {e}")
        return (
            "Sorry, we are unable to process "
            "your request at the moment."
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
            temperature=0
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
        {"found": True,  "ticket_id": "T-260601-12345"}
        {"found": False, "ticket_id": None}
        {"found": "ambiguous", "ticket_ids": [...]}  ← multiple, cannot decide
    """
    if not history:
        return {"found": False, "ticket_id": None}

    # Format history for prompt
    history_text = _format_history(history)

    prompt = f"""
You are a support assistant analyzing a conversation history to find a relevant ticket or order ID.

## Current Customer Query
{query}

## Conversation History
{history_text}

## Task
1. Look through the conversation history for any ticket IDs (e.g. T-260601-12345) or order IDs (e.g. ORD12345).
2. Determine if any of them are relevant to the current query.
3. If one is clearly relevant, return it.
4. If multiple exist and you cannot determine which is relevant, return all of them as ambiguous.
5. If none are relevant or none exist, return not found.

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
            temperature=0
        )

        output = res.choices[0].message.content.strip()
        logger.info(f"🔍 History scan raw output: {output}")

        match = re.search(r'\{.*\}', output, re.DOTALL)
        if not match:
            raise ValueError("No JSON found in history scan response")

        data = json.loads(match.group(0).strip())
        logger.info(f"✅ History scan result: {data}")
        return data

    except Exception as e:
        logger.error(f"❌ History scan failed: {e}")
        return {"found": False, "ticket_id": None}



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
            temperature=0
        )

        description = res.choices[0].message.content.strip()
        logger.info(f"✅ Issue description extracted: {description[:120]}...")
        return description

    except Exception as e:
        logger.error(f"❌ Issue description extraction failed: {e}")
        # Graceful fallback: trim raw body to 500 chars
        return body[:500].strip()


        # This is the new function to append to app/llm.py
# Add this at the bottom of the existing llm.py file

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
            temperature=0
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


import time
_model_cache = {}
_MODEL_CACHE_TTL = 60  # seconds

def resolve_model(client_id: str, caller_function: str) -> str:
    if not client_id or client_id == "SYSTEM":
        return MODEL
    cache_key = (client_id, caller_function)
    now = time.time()
    cached = _model_cache.get(cache_key)
    if cached and now - cached[1] < _MODEL_CACHE_TTL:
        return cached[0]
    model = MODEL
    try:
        from app.db import get_db_ctx
        with get_db_ctx() as db:
            with db.cursor() as cursor:
                cursor.execute(
                    "SELECT model_name FROM client_model_config WHERE client_id=%s AND caller_function=%s",
                    (client_id, caller_function)
                )
                row = cursor.fetchone()
                if row:
                    model = row[0]
    except Exception as e:
        logger.warning(f"resolve_model lookup failed, using default: {e}")
    _model_cache[cache_key] = (model, now)
    return model
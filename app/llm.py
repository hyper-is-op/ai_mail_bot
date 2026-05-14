# import os
# import re
# import json
# import logging
# from openai import OpenAI

# logging.basicConfig(
#     level=logging.INFO,
#     format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
# )
# logger = logging.getLogger(__name__)

# client = OpenAI(
#     api_key=os.getenv("GROQ_API_KEY"),
#     base_url="https://api.groq.com/openai/v1"
# )

# MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")


# # ==============================
# # 👤 Extract Name from Email
# # ==============================
# def extract_name_from_email(email):
#     """
#     Example:
#     test@gmail.com -> test
#     """
#     try:
#         username = email.split('@')[0]
#         name_parts = re.split(r'[._\-]', username)
#         formatted_name = ' '.join([part.capitalize() for part in name_parts if part])
#         return formatted_name if formatted_name else "Customer"
#     except Exception:
#         return "Customer"

# def detect_intent_llm(query):
#     """
#     Detect intent and extract ticket_id (covers both order + ticket queries)
#     """
#     prompt = f"""
# You are an intent classification system for a customer support email assistant.

# Classify the user query into one of:
# - ticket_status (if the user is asking about order status, ticket status, complaint status, delivery status, or tracking)
# - general_query

# Extract:
# - ticket_id (this can be order ID or ticket ID, e.g., ORD12345 or T-260505-00117)

# Return ONLY valid JSON:
# {{
#   "intent": "ticket_status or general_query",
#   "ticket_id": "value or null"
# }}

# Query:
# {query}
# """

#     try:
#         res = client.chat.completions.create(
#             model=MODEL,
#             messages=[
#                 {"role": "system", "content": "Return only JSON."},
#                 {"role": "user", "content": prompt}
#             ],
#             temperature=0
#         )

#         output = res.choices[0].message.content.strip()
#         logger.info(f"🧠 Intent raw output: {output}")

#         # ✅ Safe JSON parsing (important)
#         data = json.loads(output)

#         return {
#             "intent": data.get("intent", "general_query"),
#             "ticket_id": data.get("ticket_id")
#         }

#     except Exception as e:
#         logger.error(f"❌ Intent detection failed: {e}")

#         # 🔁 Fallback (regex based extraction)
#         ticket_id = None
#         try:
#             import re
#             match = re.search(r'(T-\d{6}-\d{5}|ORD\d+)', query)
#             if match:
#                 ticket_id = match.group(0)
#         except:
#             pass

#         return {
#             "intent": "ticket_status" if ticket_id else "general_query",
#             "ticket_id": ticket_id
#         }


# # ==============================
# # ✉️ Generate Reply
# # ==============================
# def generate_reply_llm(context, query, from_email=None, is_ticket=False, ticket_id=None):
#     """
#     Generate professional email reply.
    
#     Args:
#         context: Context for the reply
#         query: Customer query
#         from_email: Customer email
#         is_ticket: If True, generate formatted ticket response
#         ticket_id: Ticket ID for formatted response
#     """
#     customer_name = extract_name_from_email(from_email) if from_email else "Customer"
#     logger.info(f"👤 Customer name: {customer_name}")

#     if is_ticket and ticket_id:
#         # Generate formatted ticket email
#         prompt = f"""
# You are a professional customer support agent.

# Generate a ticket acknowledgment email in this exact format:

# Subject: Update on your Ticket {ticket_id}

# Hi {customer_name},

# Thank you for reaching out.

# Your ticket {ticket_id} is currently in {{status}} with {{priority}} priority. The issue reported is "{{issue}}" and our team has noted: "{{remarks}}".

# Our team is actively working on your request and will keep you updated on further progress.

# Thanks & Regards,
# Support Team

# ---
# CONTEXT FOR FILLING PLACEHOLDERS:
# {context}

# IMPORTANT:
# - Replace {{status}}, {{priority}}, {{issue}}, {{remarks}} with actual values from context
# - Keep professional tone
# - Keep it concise
# - Do NOT add anything beyond the template structure
# """
#     else:
#         # Generate simple reply
#         prompt = f"""
# You are a professional customer support agent for C-Zentrix.

# Context:
# {context}

# Customer Query:
# {query}

# Instructions:
# - Address the customer by name: {customer_name}
# - Be polite, professional, and clear
# - Keep response concise
# - Do NOT hallucinate
# - If no info, give helpful general response
# - Include order details clearly if available
# - End professionally

# Write the email reply:
# """

#     try:
#         res = client.chat.completions.create(
#             model=MODEL,
#             messages=[
#                 {
#                     "role": "system",
#                     "content": "You are a professional AI support agent."
#                 },
#                 {
#                     "role": "user",
#                     "content": prompt
#                 }
#             ],
#             temperature=0.3
#         )

#         reply = res.choices[0].message.content.strip()
#         logger.info(f"📧 Generated reply: {reply[:150]}...")

#         return reply

#     except Exception as e:
#         logger.error(f"❌ Reply generation failed: {e}")
#         return "Sorry, we are unable to process your request at the moment."

import os
import re
import json
import logging
from openai import OpenAI

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


# ==============================
# 👤 Extract Name from Email
# ==============================
def extract_name_from_email(email):
    """
    Example:
    test@gmail.com -> Test
    john.doe@gmail.com -> John Doe
    """

    try:
        username = email.split('@')[0]

        name_parts = re.split(r'[._\-]', username)

        formatted_name = ' '.join(
            [
                part.capitalize()
                for part in name_parts
                if part
            ]
        )

        return formatted_name if formatted_name else "Customer"

    except Exception:
        return "Customer"


# ==============================
# 🧠 Detect Intent
# ==============================
def detect_intent_llm(query):
    """
    Detect intent and extract ticket_id
    """

    prompt = f"""
You are an intent classification system for a customer support email assistant.

Classify the user query into one of:
- ticket_status
- general_query

ticket_status means:
- ticket status
- complaint status
- order status
- tracking request
- delivery status
- support request update

Extract:
- ticket_id

Examples:
- T-260505-00117
- ORD12345

Return ONLY valid JSON.

Expected JSON format:
{{
  "intent": "ticket_status",
  "ticket_id": "T-260505-00117"
}}

User Query:
{query}
"""

    try:

        logger.info("🧠 Detecting intent using LLM")

        res = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": """
You are a JSON-only response system.

Rules:
- Return ONLY valid JSON
- No markdown
- No explanation
- No extra text
"""
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

        # ==========================================
        # ✅ Extract JSON safely
        # ==========================================
        match = re.search(r'\{.*\}', output, re.DOTALL)

        if not match:
            raise ValueError("No JSON object found in LLM response")

        cleaned_output = match.group(0).strip()

        logger.info(f"🧹 Cleaned JSON output: {cleaned_output}")

        # ==========================================
        # ✅ Parse JSON
        # ==========================================
        data = json.loads(cleaned_output)

        intent = data.get("intent", "general_query")
        ticket_id = data.get("ticket_id")

        logger.info(
            f"✅ Intent detected: intent={intent}, ticket_id={ticket_id}"
        )

        return {
            "intent": intent,
            "ticket_id": ticket_id
        }

    except Exception as e:

        logger.error(f"❌ Intent detection failed: {e}")

        # ==========================================
        # 🔁 Regex Fallback
        # ==========================================
        ticket_id = None

        try:

            match = re.search(
                r'(T-\d{6}-\d{5}|ORD\d+)',
                query,
                re.IGNORECASE
            )

            if match:
                ticket_id = match.group(0)

        except Exception:
            pass

        fallback_intent = (
            "ticket_status"
            if ticket_id
            else "general_query"
        )

        logger.info(
            f"🔁 Fallback intent used: "
            f"intent={fallback_intent}, "
            f"ticket_id={ticket_id}"
        )

        return {
            "intent": fallback_intent,
            "ticket_id": ticket_id
        }


# ==============================
# ✉️ Generate Reply
# ==============================
def generate_reply_llm(
    context,
    query,
    from_email=None,
    is_ticket=False,
    ticket_id=None
):
    """
    Generate professional email reply.
    """

    customer_name = (
        extract_name_from_email(from_email)
        if from_email
        else "Customer"
    )

    logger.info(f"👤 Customer name: {customer_name}")

    # ==========================================
    # 🎫 Ticket Reply
    # ==========================================
    if is_ticket and ticket_id:

        prompt = f"""
You are a professional customer support agent.

Generate a ticket acknowledgment email.

Format:

Subject: Update on your Ticket {ticket_id}

Hi {customer_name},

Thank you for reaching out.

Your ticket {ticket_id} is currently in {{status}} with {{priority}} priority.

The issue reported is "{{issue}}".

Our team remarks:
"{{remarks}}"

Our team is actively working on your request and will keep you updated on further progress.

Thanks & Regards,
Support Team


CONTEXT:
{context}


IMPORTANT:
- Replace placeholders with actual values
- Keep concise
- Keep professional
- No hallucination
"""

    # ==========================================
    # 💬 General Reply
    # ==========================================
    else:

        prompt = f"""
You are a professional customer support agent for C-Zentrix.

Customer Name:
{customer_name}

Context:
{context}

Customer Query:
{query}

Instructions:
- Be professional
- Be concise
- Do NOT hallucinate
- If no answer available, say politely
- End professionally

Write the email reply.
"""

    try:

        logger.info("📧 Generating AI reply")

        res = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional AI support agent."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.3
        )

        reply = res.choices[0].message.content.strip()

        logger.info(
            f"✅ Reply generated successfully: "
            f"{reply[:150]}..."
        )

        return reply

    except Exception as e:

        logger.error(f"❌ Reply generation failed: {e}")

        return (
            "Sorry, we are unable to process "
            "your request at the moment."
        )
import logging
from typing import Optional, List

from app.llm_utils import _format_history
from app.llm_config import client, current_client_id, resolve_model

logger = logging.getLogger(__name__)


# ==============================
# 🧹 Extract Issue Description
# ==============================
def extract_issue_description(body: str, history: Optional[list] = None) -> str:
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
You are a support ticket assistant. Extract a clean, concise problem description from the customer email below for a CRM support ticket payload.

## Rules
- Return 2–3 sentences maximum.
- Focus on the core issue, request, or error reported in the Current Customer Email Body.
- If the current email is a brief follow-up (e.g., "That didn't work"), use the Conversation History only to clarify what issue and troubleshooting steps are being referenced.
- Preserve specific order IDs, ticket numbers, product names, and exact error messages mentioned by the customer.
- Strip greetings, sign-offs, pleasantries, disclaimers, and email-thread boilerplate/headers.
- Do NOT invent, assume, or extrapolate details not stated in the provided text.
- Return ONLY the plain description text in a single paragraph. No labels, no bullet points, no JSON, no markdown.

{history_block}

## Customer Email Body
{body}
"""

    try:
        logger.info("🧹 Extracting issue description from customer body")

        res = client.chat.completions.create(
            model=resolve_model(current_client_id.get(), "extract_issue_description"),
            caller="extract_issue_description",
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
    history: Optional[list] = None,
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
        old_summary_block = f"## Previous Conversation Summary (Context)\n{old_summary}\n"

    prompt = f"""
You are an executive customer service assistant. Write a clear, natural, professional summary of the customer's request and current conversation status.

## Guidelines
- Write 1 to 2 complete, well-formed sentences in fluent, professional English (140 to 220 characters).
- MUST read like a polished human support agent briefing: smooth, natural tone with proper grammar and articles ("the", "a").
- STRICTLY FORBIDDEN:
  * Do NOT use telegraphic shorthand or semicolon-separated fragments (e.g., avoid "Problem; Status; Next step").
  * Do NOT use tally counts, repetition markers, or multipliers (e.g., NEVER write "12x", "4x", "5th request").
  * Do NOT sound passive-aggressive, dismissive, or robotic (NEVER write "customer keeps re-asking", "repeated requests", or "no support issue").
  * Do NOT include customer names, ticket IDs, order numbers, or email addresses.
  * Do NOT output bullet points, labels (e.g., "Summary:"), markdown, or surrounding quotes.
- Content to capture:
  1. What the customer is inquiring about, requesting, or troubleshooting.
  2. The current status or most recent action taken (e.g., "Product overview sent and awaiting customer confirmation", "Support ticket opened for technical team review", or "Resolution steps provided").
- If previous thread context is provided, synthesize the core narrative into a clean, modern summary rather than repeating past bullet points or tally counters.

{old_summary_block}

## Conversation History
{history_block if history_block else "No prior history."}

## Ticket / API Context
{context if context else "No context available."}

## Latest Customer Message
{customer_body}

Return ONLY the plain, natural summary text under 250 characters. Nothing else.
"""

    try:
        logger.info("📝 Generating issue summary")

        res = client.chat.completions.create(
            model=resolve_model(current_client_id.get(), "generate_summary_llm"),
            caller="generate_summary_llm",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a professional customer support summarizer. "
                        "Return only a single natural, fluent summary under 250 characters. "
                        "No labels, no formatting, no robotic telegraphic phrasing."
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

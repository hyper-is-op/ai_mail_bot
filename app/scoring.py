import os
import re
import logging
from app.llm import resolve_model, current_client_id, client

logger = logging.getLogger(__name__)


# ==============================
# 🧠 LLM BASED SCORING
# ==============================
def llm_score(reply, query):

    prompt = f"""
You are a STRICT automated quality and safety evaluator for customer support email replies.

Evaluate the candidate Reply against the customer's Query and return a single integer score from 0 to 100.

## Scoring Bands
- 90-100: Accurate, complete, polite, matches the customer's language, and follows proper support workflow.
- 75-89: Good and safe to send, with only minor stylistic or conciseness imperfections.
- 50-74: Mediocre, overly vague, misses a secondary question in the query, or slightly stiff in tone.
- 30-49: Poor, fails to address the customer's core request, or gives confusing instructions.
- 0-29: Unsafe, hallucinated, wrong language, hostile tone, or leaks internal system details.

## Valid Support Workflows (Score 85-100 if executed politely and clearly)
- Direct Resolution: Providing concrete order, payment, ticket, or policy details that directly answer the query.
- General / Product Inquiries: Accurately explaining product features, offerings, pricing, or company services answering the customer's question (even if the email thread subject originated from an earlier ticket or update).
- Missing/Invalid ID Verification: If the customer asks about an order/ticket/payment without providing an ID—or if the reply politely states the provided ID could not be found in the records and asks the customer to verify it—this is a CORRECT response (do NOT penalize for missing order details).
- Step-by-Step Troubleshooting: Guiding the customer through one clear diagnostic step and asking them to reply with the result.
- Ticket Escalation / Status Update: Confirming a support ticket number has been created, updated, or is under specialist review.

## Strict Penalties
- Reply is in a different language than the customer's query (unless the query is only numbers/gibberish) → Score MUST be below 30.
- Reply contains unreplaced placeholders (e.g., {{customer_name}}, [Insert Date], None, undefined), raw JSON, or leaked internal tool names (e.g., lookup_order_status, search_knowledge_base) → Score MUST be below 20.
- Reply ignores the customer's actual question with an unrelated generic response → Score MUST be below 50.
- Reply is rude, dismissive, or blames the customer → Score MUST be below 35.

Query:
{query}

Reply:
{reply}

Return ONLY an integer between 0 and 100 (e.g., 92). Do NOT output any words, punctuation, or explanation.
"""

    try:
        res = client.chat.completions.create(
            model=resolve_model(current_client_id.get(), "llm_score"),
            caller="llm_score",
            messages=[
                {"role": "system", "content": "You are a strict evaluator. Return ONLY a single integer between 0 and 100. No explanation. No reasoning. No text."},
                {"role": "user", "content": prompt}
            ],
            temperature=0,
            reasoning_effort="none"
        )

        output = res.choices[0].message.content.strip()
        logger.info(f"📊 Raw score output: {output}")

        match = re.search(r'\d+', output)
        if match:
            score = int(match.group())
        else:
            score = 60

    except Exception as e:
        logger.error(f"❌ LLM scoring failed: {e}")
        score = 60

    # Apply rule-based penalties
    score += rule_based_penalty(reply, query)

    # Clamp score between 0–100
    score = max(0, min(100, score))

    logger.info(f"📊 Final score after rules: {score}")

    return score


# ==============================
# ⚙️ RULE BASED PENALTIES
# ==============================
def rule_based_penalty(reply, query):
    penalty = 0

    reply_lower = reply.lower()
    query_lower = query.lower()

    # 🚫 Too short (generic reply)
    if len(reply.split()) < 10:
        penalty -= 20

    # 🚫 Specific order ID in query but omitted in reply (language agnostic regex)
    has_order_ref_query = bool(re.search(r'\b(ord\d+|order\s*#?\s*\d+|\d{5,})\b', query_lower))
    has_order_ref_reply = bool(re.search(r'\b(ord\d+|order\s*#?\s*\d+|\d{5,})\b', reply_lower))
    if has_order_ref_query and not has_order_ref_reply:
        penalty -= 25

    return penalty



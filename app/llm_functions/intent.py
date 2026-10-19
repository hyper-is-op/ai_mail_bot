import re
import json
import logging

from app.llm_utils import extract_ticket_and_order_ids, _format_history
from app.llm_config import client, current_client_id, resolve_model

logger = logging.getLogger(__name__)


# ==============================
# 🧠 Detect Intent
# ==============================
def detect_intent_llm(query: str) -> dict:
    prompt = f"""
You are a deterministic customer support query classifier. Analyze the user query and return ONLY a single valid JSON object matching the exact schema below.

## Task
1. Classify the query into Set-1 Intent (`intent`).
2. Extract all support ticket IDs, order IDs, or transaction/invoice reference IDs (`ticket_ids`).
3. Classify customer sentiment (`sentiment`).
4. Assign a support priority level (`priority`).

## Intents (Choose Exactly ONE)
- `issue_resolved`: Customer explicitly confirms that their problem, ticket, or inquiry is resolved, fixed, or no longer needs help, AND asks NO new questions or pending requests.
- `off_topic_nonsense`: ONLY standalone greetings with no question asked (e.g., "hello", "hi there"), unintelligible gibberish/keyboard mash ("asdf123"), blank/test messages, or completely unrelated non-business topics (e.g., sports, cooking, weather). NEVER choose this for inquiries about products, features, or services—even if the product name is unfamiliar.
- `ticket_create`: Customer explicitly asks to create, open, raise, or log a new support ticket/complaint/case, or explicitly requests escalation to a human agent.
- `ticket_status`: Customer asks for the status, tracking, or update on an existing support ticket, order, delivery, refund, or complaint (or replies with only an order/ticket reference number).
- `marketing_promotional`: Inbound marketing email, promotional blast, newsletter, job alert, webinar invite, cold sales pitch, or automated digest requiring no support reply.
- `general_query`: Genuine customer support question, product inquiry, feature inquiry (e.g., "tell me about X", "what is X?", "how does X work?"), policy question, billing question, or technical problem description requiring troubleshooting or an answer.

## Precedence Rules (When Multiple Signals Exist)
1. Any message asking for information, explanation, or overview of a named product, feature, tool, or service (e.g., "Tell me about CZ CallBlast", "What does CZ Omni do?") is ALWAYS `general_query`, NEVER `off_topic_nonsense`—even if the product name is unrecognized.
2. If the message contains ANY unresolved question, new issue, or status check alongside a "thank you" or resolved note, NEVER choose `issue_resolved`—choose `ticket_create`, `ticket_status`, or `general_query` based on the active request.
3. If the customer describes a problem AND explicitly asks to open/raise a ticket or speak to a human, choose `ticket_create`.
4. If the customer asks about an existing order, delivery, payment, or ticket status, choose `ticket_status`.

## ID Extraction (`ticket_ids`)
- Extract all order numbers, ticket references, or invoice/transaction IDs exactly as written (e.g., "#1001", "ORD-9201", "T-260526-00431", "10294").
- Do NOT extract phone numbers, dates, street numbers, zip codes, or monetary amounts.
- If no reference IDs are present, return an empty array `[]`.

## Sentiment Analysis (`sentiment`)
- `Angry`: Frustrated, upset, demanding, threatening cancellation/chargeback, using all-caps complaints, or expressing dissatisfaction with delays/service.
- `Happy`: Expressing gratitude, praise, satisfaction, or relief that an issue worked out.
- `Neutral`: Matter-of-fact inquiry, problem report, or status check without strong positive or negative emotion.

## Priority Tagging (`priority`)
- `Critical`: System outage, blocked payment/checkout, security/account breach, unauthorized charge, or severe escalation threat.
- `High`: Angry sentiment, failed delivery, defective/damaged order, billing/refund dispute, or repeated unresolved follow-up.
- `Medium`: Standard technical issue, order/ticket status check, or account/product troubleshooting.
- `Low`: General FAQ/policy question, feature inquiry, resolved confirmation, off-topic message, or promotional email.

## Output Format (Raw JSON Only — No Markdown Fences, No Explanation)
{{
  "intent": "issue_resolved" | "off_topic_nonsense" | "ticket_create" | "ticket_status" | "marketing_promotional" | "general_query",
  "ticket_ids": ["<id1>", "<id2>"],
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
            caller="detect_intent_llm",
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
            caller="scan_history_for_ticket",
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
        history_ids = extract_ticket_and_order_ids(history_text)
        if len(history_ids) == 1:
            return {"found": True, "ticket_id": history_ids[0], "ambiguous": False}
        elif len(history_ids) > 1:
            return {"found": True, "ticket_id": None, "ambiguous": True, "ticket_ids": history_ids}
        return {"found": False, "ticket_id": None, "ambiguous": False}

import json
import logging
import re
from typing import Dict, Any, List, Optional
from app.pipeline.context import PipelineContext
from app.pipeline.enricher import (
    fetch_crm_ticket_status,
    fetch_crm_order_status,
    fetch_payment_status,
    fetch_rag_context,
)
from app.pipeline.dispatcher import create_ticket_and_reply
from app.connector_executor import format_mapped_data_for_prompt

logger = logging.getLogger(__name__)


def clean_rag_query(raw_text: str) -> str:
    """
    Sanitizes raw email bodies or queries for RAG dense embedding search.
    Strips email headers, greetings, signatures, quoted history, and legal footers.
    """
    if not raw_text:
        return ""
    text = str(raw_text).strip()

    # Remove email quoted history: "On ... wrote:" or lines starting with ">"
    text = re.split(r"(?i)\n\s*on\s+.*?\s+wrote\s*:\s*\n", text)[0]
    text = re.split(r"(?i)\n\s*---+\s*original message\s*---+\s*", text)[0]
    lines = [line for line in text.splitlines() if not line.strip().startswith(">")]
    text = "\n".join(lines)

    # Remove common greeting lines at the start
    greeting_pattern = r"(?i)^(hi|hello|dear|hey|good\s+(morning|afternoon|evening))\s*[^,\n]*[,!:]*\s*\n*"
    text = re.sub(greeting_pattern, "", text.strip())

    # Remove signatures at the bottom
    sig_patterns = [
        r"(?i)\n\s*(thanks|thank you|regards|best regards|warm regards|sincerely|cheers|yours truly)[\s,].*",
        r"(?i)\n\s*sent from my (iphone|android|galaxy|ipad|device).*",
        r"(?i)\n\s*disclaimer:?.*",
        r"(?i)\n\s*this email and any files transmitted.*"
    ]
    for sp in sig_patterns:
        text = re.sub(sp, "", text, flags=re.DOTALL)

    # Remove email subject prefixes and CRM ticket metadata
    text = re.sub(r"(?i)\b(?:re|fwd|fw)\s*:\s*", "", text)
    text = re.sub(r"(?i)(?:ticket\s+(?:update|reference|id|number)?\s*[:#-]?\s*\d+|\[(?:ticket\s*)?#?\d+\])", "", text)

    cleaned = " ".join(text.split()).strip()
    # Keep query focused: if it's over 400 characters, extract first 2-3 substantive sentences
    if len(cleaned) > 400:
        sentences = re.split(r"(?<=[.?!])\s+", cleaned)
        shortened = ""
        for s in sentences:
            if len(shortened) + len(s) < 350:
                shortened = f"{shortened} {s}".strip()
            else:
                break
        if shortened:
            cleaned = shortened

    from app.text_cleaning import extract_indic_keywords
    cleaned = extract_indic_keywords(cleaned)

    return cleaned or raw_text[:300].strip()

# ==========================================
# 🛠️ DECLARATIVE OPENAI FUNCTION SCHEMAS
# ==========================================

SUPPORT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "lookup_order_status",
            "description": "Look up real-time order status, fulfillment tracking, line items, and delivery details from the client store or ERP system.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "string",
                        "description": "The order ID or order number mentioned by the customer (e.g., '#1001', 'ORD10294', '10294')."
                    }
                },
                "required": ["order_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "lookup_payment_status",
            "description": "Look up payment transaction status, refund status, or invoice payment details from payment gateways (e.g. Stripe, Razorpay, Zoho Books).",
            "parameters": {
                "type": "object",
                "properties": {
                    "payment_id_or_order_id": {
                        "type": "string",
                        "description": "The transaction ID, payment reference, invoice ID, or order reference (e.g., 'pi_3MtwBwLkdCwBgZr20e', 'pay_29ashd81', 'INV-1092', 'ORD10294')."
                    }
                },
                "required": ["payment_id_or_order_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "lookup_ticket_status",
            "description": "Look up the real-time status, agent assignment, and latest comments of an existing support ticket from the client CRM.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticket_id": {
                        "type": "string",
                        "description": "The exact ticket reference or support docket number mentioned by the customer (e.g., 'T-260526-00431', '275424000000446001')."
                    }
                },
                "required": ["ticket_id"]
            }
        }
    },

    {
        "type": "function",
        "function": {
            "name": "search_knowledge_base",
            "description": "Search company knowledge base, policies, FAQs, documentation, product manuals, and troubleshooting guides for answers.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query string to look up in the vector knowledge base. Extract specific product names, error codes, features, or technical terms (e.g., 'CZ Dialer', 'SIP_408_TIMEOUT'). Do not include conversational filler like 'tell me about'."
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "escalate_and_create_ticket",
            "description": "Escalate an unresolved issue, technical bug, complaint, refund request, or human support request to generate a new formal support ticket in the CRM.",
            "parameters": {
                "type": "object",
                "properties": {
                    "issue_summary": {
                        "type": "string",
                        "description": "A concise, factual description of the issue being escalated."
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["Low", "Medium", "High", "Critical"],
                        "description": "The urgency level of the request."
                    },
                    "remarks": {
                        "type": "string",
                        "description": "Optional notes or technical context for the support agent."
                    }
                },
                "required": ["issue_summary"]
            }
        }
    }
]


# ==========================================
# ⚙️ TOOL DISPATCHER & EXECUTOR
# ==========================================

def execute_tool_call(
    tool_name: str,
    arguments: Dict[str, Any],
    ctx: PipelineContext,
    cursor: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Executes the specified tool with arguments against underlying CRM/RAG backends.
    Returns a dictionary result to feed back into the agent conversation sequence.
    Catches errors and provides structured diagnostics so the agent can adapt gracefully.
    """
    logger.info(f"⚡ [Agent Tool Call] Executing '{tool_name}' with args: {arguments}")
    ctx.log_step(f"Tool_Call:{tool_name}")

    try:
        if tool_name == "lookup_order_status":
            raw_order_id = arguments.get("order_id", "")
            clean_order_id = str(raw_order_id).strip().lstrip("#")

            res = fetch_crm_order_status(
                client_id=ctx.client_id,
                order_id=clean_order_id,
                body=ctx.body,
                history=ctx.history,
                subject=ctx.subject,
                from_email=ctx.from_email
            )
            if res.get("success"):
                order_data = res.get("data") or {}
                formatted_text = format_mapped_data_for_prompt(order_data)
                ctx.context_data = order_data
                ctx.log_step("CRM_Order_Found")
                return {
                    "status": "found",
                    "order_id": clean_order_id,
                    "details": order_data,
                    "summary": formatted_text
                }
            else:
                err_msg = res.get("error")
                is_invalid_format = bool(res.get("invalid_format")) or res.get("status_code") in (400, 422)
                is_not_found = bool(res.get("not_found")) or ("No matching" in str(err_msg)) or res.get("status_code") == 404 or is_invalid_format
                if is_not_found:
                    ctx.log_step("CRM_Order_Invalid_Format" if is_invalid_format else "CRM_Order_Not_Found")
                    ctx.context_data = {
                        "status": "not_found",
                        "sub_status": "invalid_format" if is_invalid_format else "id_not_found",
                        "type": "order",
                        "reference_id": clean_order_id,
                        "message": f"Order #{clean_order_id} not found in store/ERP records."
                    }
                    return {
                        "status": "not_found",
                        "invalid_format": is_invalid_format,
                        "order_id": clean_order_id,
                        "message": f"No active order record found for reference '{clean_order_id}'",
                        "hint": (
                            f"The order reference '{clean_order_id}' could not be recognized or located in the system. "
                            "Politely inform the customer that the order number could not be found, suggest checking their order confirmation "
                            "email for the exact number, and offer to assist with their inquiry. "
                            "Do NOT claim there was an internal server breakdown, and do NOT call 'escalate_and_create_ticket' simply because the order was not found."
                        )
                    }
                else:
                    ctx.log_step("CRM_Order_Lookup_Error")
                    return {
                        "status": "lookup_failed",
                        "order_id": clean_order_id,
                        "message": err_msg or f"Failed to connect to store for order '{clean_order_id}'",
                        "hint": "A system error occurred while querying the order. Apologize for the technical delay and assure them support is investigating."
                    }

        elif tool_name == "lookup_payment_status":
            raw_ref = arguments.get("payment_id_or_order_id", "")
            clean_ref = str(raw_ref).strip()

            res = fetch_payment_status(
                client_id=ctx.client_id,
                payment_id_or_order_id=clean_ref,
                body=ctx.body,
                history=ctx.history,
                subject=ctx.subject,
                from_email=ctx.from_email
            )
            if res.get("rate_limited"):
                ctx.log_step("Connector_Rate_Limited")
                ctx.context_data = {"status": "rate_limited", "message": "Rate limit exceeded"}
                return {
                    "status": "rate_limited",
                    "payment_reference": clean_ref,
                    "message": "Lookup rate limit exceeded (max 5 per 10 minutes).",
                    "hint": "The lookup rate limit was exceeded for this sender. Inform the customer politely that their request has been queued for human agent review."
                }
            if res.get("upstream_outage"):
                ctx.log_step("CRM_Upstream_Outage")
                ctx.context_data = {"status": "upstream_outage", "message": "Upstream service timeout or 5xx"}
                return {
                    "status": "upstream_outage",
                    "payment_reference": clean_ref,
                    "message": "Upstream payment gateway timeout or 5xx error.",
                    "hint": "The payment gateway is temporarily unreachable. Politely acknowledge their inquiry, state that our support team is actively checking their record, and avoid mentioning system crashes."
                }
            if res.get("success"):
                payment_data = res.get("data") or {}
                formatted_text = format_mapped_data_for_prompt(payment_data)
                ctx.context_data = dict(payment_data)
                ownership_verified = res.get("ownership_verified", True)
                ctx.context_data["ownership_verified"] = ownership_verified
                ctx.log_step("Payment_Status_Found" if ownership_verified else "BOLA_Ownership_Mismatch")
                return {
                    "status": "found" if ownership_verified else "found_unverified_ownership",
                    "payment_reference": clean_ref,
                    "details": payment_data,
                    "summary": formatted_text,
                    "hint": "Record found and verified." if ownership_verified else "Record found, but sender email does not match registered customer email. Masked private details to prevent BOLA/IDOR disclosure."
                }
            else:
                err_msg = res.get("error")
                is_invalid_format = bool(res.get("invalid_format")) or res.get("status_code") in (400, 422)
                is_not_found = bool(res.get("not_found")) or ("No matching" in str(err_msg)) or res.get("status_code") == 404 or is_invalid_format
                if is_not_found:
                    ctx.log_step("Payment_Status_Invalid_Format" if is_invalid_format else "Payment_Status_Not_Found")
                    ctx.context_data = {
                        "status": "not_found",
                        "sub_status": "invalid_format" if is_invalid_format else "id_not_found",
                        "type": "payment",
                        "reference_id": clean_ref,
                        "message": f"Payment record for reference '{clean_ref}' not found."
                    }
                    return {
                        "status": "not_found",
                        "invalid_format": is_invalid_format,
                        "payment_reference": clean_ref,
                        "message": f"No active payment record found for reference '{clean_ref}'",
                        "hint": (
                            f"The payment reference '{clean_ref}' could not be recognized or located in the system. "
                            "Politely inform the customer that the transaction reference was not found, suggest checking their receipt or invoice, "
                            "and ask them to provide the correct transaction ID. "
                            "Do NOT claim there was an internal server breakdown."
                        )
                    }
                else:
                    ctx.log_step("Payment_Status_Lookup_Error")
                    return {
                        "status": "lookup_failed",
                        "payment_reference": clean_ref,
                        "message": err_msg or f"Failed to connect to payment gateway for reference '{clean_ref}'",
                        "hint": "A system error occurred while querying payment records."
                    }

        elif tool_name == "lookup_ticket_status":
            raw_ticket_id = arguments.get("ticket_id", "")
            clean_ticket_id = str(raw_ticket_id).strip().lstrip("#")

            res = fetch_crm_ticket_status(
                client_id=ctx.client_id,
                ticket_id=clean_ticket_id,
                body=ctx.body,
                history=ctx.history,
                subject=ctx.subject,
                from_email=ctx.from_email
            )
            if res.get("rate_limited"):
                ctx.log_step("Connector_Rate_Limited")
                ctx.context_data = {"status": "rate_limited", "message": "Rate limit exceeded"}
                return {
                    "status": "rate_limited",
                    "ticket_id": clean_ticket_id,
                    "message": "Lookup rate limit exceeded (max 5 per 10 minutes).",
                    "hint": "The lookup rate limit was exceeded for this sender. Inform the customer politely that their request has been queued for human agent review."
                }
            if res.get("upstream_outage"):
                ctx.log_step("CRM_Upstream_Outage")
                ctx.context_data = {"status": "upstream_outage", "message": "Upstream service timeout or 5xx"}
                return {
                    "status": "upstream_outage",
                    "ticket_id": clean_ticket_id,
                    "message": "Upstream CRM service timeout or 5xx error.",
                    "hint": "The external CRM system is temporarily unreachable. Politely acknowledge their inquiry, state that our support team is actively checking their record, and avoid mentioning system crashes."
                }
            if res.get("success"):
                ticket_data = res.get("data") or {}
                formatted_text = format_mapped_data_for_prompt(ticket_data)
                ctx.ticket_id = clean_ticket_id
                ctx.context_data = dict(ticket_data)
                ownership_verified = res.get("ownership_verified", True)
                ctx.context_data["ownership_verified"] = ownership_verified
                ctx.log_step("CRM_Status_Found" if ownership_verified else "BOLA_Ownership_Mismatch")
                return {
                    "status": "found" if ownership_verified else "found_unverified_ownership",
                    "ticket_id": clean_ticket_id,
                    "details": ticket_data,
                    "summary": formatted_text,
                    "hint": "Record found and verified." if ownership_verified else "Record found, but sender email does not match registered customer email. Masked private details to prevent BOLA/IDOR disclosure."
                }
            else:
                err_msg = res.get("error")
                is_invalid_format = bool(res.get("invalid_format")) or res.get("status_code") in (400, 422)
                is_not_found = bool(res.get("not_found")) or ("No matching" in str(err_msg)) or res.get("status_code") == 404 or is_invalid_format
                if is_not_found:
                    ctx.log_step("CRM_Status_Invalid_Format" if is_invalid_format else "CRM_Status_Not_Found")
                    ctx.context_data = {
                        "status": "not_found",
                        "sub_status": "invalid_format" if is_invalid_format else "id_not_found",
                        "type": "ticket",
                        "reference_id": clean_ticket_id,
                        "message": f"Ticket #{clean_ticket_id} not found in CRM."
                    }
                    return {
                        "status": "not_found",
                        "invalid_format": is_invalid_format,
                        "ticket_id": clean_ticket_id,
                        "message": f"No active record found in CRM for reference '{clean_ticket_id}'",
                        "hint": (
                            f"The ticket reference '{clean_ticket_id}' could not be recognized or located in the system. "
                            "Politely inform the customer that the ticket ID could not be found, suggest checking their original confirmation "
                            "email for the exact number, and offer to assist with any issue described in their message. "
                            "Do NOT claim there was an internal server breakdown, and do NOT call 'escalate_and_create_ticket' simply because the ticket was not found or has an unverified reference."
                        )
                    }
                else:
                    ctx.log_step("CRM_Status_Lookup_Error")
                    return {
                        "status": "lookup_failed",
                        "ticket_id": clean_ticket_id,
                        "message": err_msg or f"Failed to connect to CRM for reference '{clean_ticket_id}'",
                        "hint": "A system error occurred while connecting to the CRM. Apologize for the delay and assure them support is investigating."
                    }

        elif tool_name == "lookup_ticket_or_order_status":
            raw_ticket_id = arguments.get("ticket_id", "")
            clean_ticket_id = str(raw_ticket_id).strip().lstrip("#")

            # Try order status first if prefixed with ORD or numeric-short, otherwise ticket status
            res = fetch_crm_ticket_status(
                client_id=ctx.client_id,
                ticket_id=clean_ticket_id,
                body=ctx.body,
                history=ctx.history,
                subject=ctx.subject,
                from_email=ctx.from_email
            )
            if not res.get("success") and not res.get("rate_limited") and not res.get("upstream_outage"):
                # Secondary attempt with order status lookup
                res = fetch_crm_order_status(
                    client_id=ctx.client_id,
                    order_id=clean_ticket_id,
                    body=ctx.body,
                    history=ctx.history,
                    subject=ctx.subject,
                    from_email=ctx.from_email
                )

            if res.get("rate_limited"):
                ctx.log_step("Connector_Rate_Limited")
                ctx.context_data = {"status": "rate_limited", "message": "Rate limit exceeded"}
                return {
                    "status": "rate_limited",
                    "ticket_id": clean_ticket_id,
                    "message": "Lookup rate limit exceeded (max 5 per 10 minutes).",
                    "hint": "The lookup rate limit was exceeded for this sender. Inform the customer politely that their request has been queued for human agent review."
                }
            if res.get("upstream_outage"):
                ctx.log_step("CRM_Upstream_Outage")
                ctx.context_data = {"status": "upstream_outage", "message": "Upstream service timeout or 5xx"}
                return {
                    "status": "upstream_outage",
                    "ticket_id": clean_ticket_id,
                    "message": "Upstream CRM or order service timeout or 5xx error.",
                    "hint": "The external service is temporarily unreachable. Politely acknowledge their inquiry, state that our support team is actively checking their record, and avoid mentioning system crashes."
                }

            if res.get("success"):
                ticket_data = res.get("data") or {}
                formatted_text = format_mapped_data_for_prompt(ticket_data)
                ctx.ticket_id = clean_ticket_id
                ctx.context_data = dict(ticket_data)
                ownership_verified = res.get("ownership_verified", True)
                ctx.context_data["ownership_verified"] = ownership_verified
                ctx.log_step("CRM_Status_Found" if ownership_verified else "BOLA_Ownership_Mismatch")
                return {
                    "status": "found" if ownership_verified else "found_unverified_ownership",
                    "ticket_id": clean_ticket_id,
                    "details": ticket_data,
                    "summary": formatted_text,
                    "hint": "Record found and verified." if ownership_verified else "Record found, but sender email does not match registered customer email. Masked private details to prevent BOLA/IDOR disclosure."
                }
            else:
                err_msg = res.get("error")
                is_invalid_format = bool(res.get("invalid_format")) or res.get("status_code") in (400, 422)
                is_not_found = bool(res.get("not_found")) or ("No matching" in str(err_msg)) or res.get("status_code") == 404 or is_invalid_format
                if is_not_found:
                    ctx.log_step("CRM_Status_Invalid_Format" if is_invalid_format else "CRM_Status_Not_Found")
                    ctx.context_data = {
                        "status": "not_found",
                        "sub_status": "invalid_format" if is_invalid_format else "id_not_found",
                        "type": "ticket_or_order",
                        "reference_id": clean_ticket_id,
                        "message": f"Reference #{clean_ticket_id} not found in CRM or store records."
                    }
                    return {
                        "status": "not_found",
                        "invalid_format": is_invalid_format,
                        "ticket_id": clean_ticket_id,
                        "message": f"No active record found in CRM or store for reference '{clean_ticket_id}'",
                        "hint": (
                            f"The reference '{clean_ticket_id}' could not be recognized or located in the system. "
                            "Politely inform the customer that the ticket/order number was not found, suggest checking their original confirmation "
                            "email for the exact reference number, and offer to assist with any issue described in their message. "
                            "Do NOT call 'escalate_and_create_ticket' simply because the reference was not found."
                        )
                    }
                else:
                    ctx.log_step("CRM_Status_Lookup_Error")
                    return {
                        "status": "lookup_failed",
                        "ticket_id": clean_ticket_id,
                        "message": err_msg or f"Failed to connect to system for reference '{clean_ticket_id}'",
                        "hint": "A system error occurred while connecting to backend systems. Apologize for the delay and assure them support is investigating."
                    }

        elif tool_name == "search_knowledge_base":
            raw_query = (arguments.get("query") or "").strip()
            if not raw_query:
                raw_query = ctx.body or ctx.subject
            query = clean_rag_query(raw_query)
            context_text, succeeded, rag_id = fetch_rag_context(ctx.client_id, query)

            # Stage 2 Fallback: Entity keyword extraction (conversational phrases stripped)
            from app.text_cleaning import clean_conversational_query
            stripped_query = ""
            if not succeeded or not context_text:
                candidate = raw_query or ctx.body or ctx.subject
                stripped_query = clean_conversational_query(candidate)
                if stripped_query and stripped_query.lower() != query.lower():
                    logger.info(f"🔄 [RAG Fallback 1] Primary query '{query}' yielded 0 results. Retrying with stripped entity '{stripped_query}'")
                    fb_context, fb_succeeded, fb_rag_id = fetch_rag_context(ctx.client_id, stripped_query)
                    if fb_succeeded and fb_context:
                        context_text = fb_context
                        succeeded = fb_succeeded
                        rag_id = fb_rag_id or rag_id

            # Stage 3 Fallback: Customer raw body if distinct
            if (not succeeded or not context_text) and ctx.body:
                body_candidate = clean_rag_query(ctx.body)
                if body_candidate and body_candidate.lower() not in (query.lower(), (stripped_query or "").lower()):
                    logger.info(f"🔄 [RAG Fallback 2] Retrying with customer body text '{body_candidate}'")
                    fb_context, fb_succeeded, fb_rag_id = fetch_rag_context(ctx.client_id, body_candidate)
                    if fb_succeeded and fb_context:
                        context_text = fb_context
                        succeeded = fb_succeeded
                        rag_id = fb_rag_id or rag_id

            # Stage 4 Fallback: Subject line if substantive
            if (not succeeded or not context_text) and ctx.subject:
                subj_clean = clean_rag_query(ctx.subject)
                generic_subjects = ("general question", "support request", "inquiry", "(no subject)", "help", "hello")
                if subj_clean and subj_clean.lower() not in generic_subjects:
                    logger.info(f"🔄 [RAG Fallback 3] Retrying with substantive subject '{subj_clean}'")
                    fb_context, fb_succeeded, fb_rag_id = fetch_rag_context(ctx.client_id, subj_clean)
                    if fb_succeeded and fb_context:
                        context_text = fb_context
                        succeeded = fb_succeeded
                        rag_id = fb_rag_id or rag_id

            ctx.rag_id = rag_id
            ctx.context_text = context_text

            if succeeded and context_text:
                ctx.log_step("Knowledge_Search_Success")
                return {
                    "status": "success",
                    "results_found": True,
                    "content": context_text
                }
            else:
                ctx.log_step("Knowledge_Search_Empty")
                return {
                    "status": "empty",
                    "results_found": False,
                    "content": "No relevant policy or documentation found in knowledge base for this inquiry.",
                    "hint": "No specific documentation chunk was found. For general informational inquiries, provide a helpful high-level response based on general product knowledge or ask a clarifying question. Do NOT call 'escalate_and_create_ticket' for general product inquiries."
                }

        elif tool_name == "escalate_and_create_ticket":
            # 1. Guard against false escalations on marketing or greeting inquiries
            if ctx.intent in ("marketing_promotional", "greeting"):
                logger.info(f"🛑 [Agent Tool Call] Blocked ticket escalation for intent '{ctx.intent}' on client {ctx.client_id}")
                return {
                    "status": "escalation_denied",
                    "reason": "intent_not_eligible_for_escalation",
                    "message": "Promotional or greeting inquiries must not create support tickets. Please provide a direct answer or request clarification from the customer."
                }

            # 2. For general_query, block escalation if it is a pure product inquiry without diagnostic context
            if ctx.intent == "general_query" and ctx.troubleshooting_step == 0 and len(ctx.history) <= 1:
                body_lower = (ctx.body or "").lower()
                subj_lower = (ctx.subject or "").lower()
                has_tech_failure = any(w in f"{subj_lower} {body_lower}" for w in [
                    "not working", "not responding", "unresponsive", "broken", "failing",
                    "outage", "down", "error", "crash", "stopped working"
                ])
                if not has_tech_failure:
                    logger.info(f"🛑 [Agent Tool Call] Blocked ticket escalation for pure product inquiry '{ctx.subject}' on client {ctx.client_id}")
                    return {
                        "status": "escalation_denied",
                        "reason": "intent_not_eligible_for_escalation",
                        "message": "General product, informational, or greeting inquiries must not create support tickets. Please provide a helpful, direct answer or request clarification from the customer."
                    }

            # 3. Guard against duplicate ticket creation loops on threads that already have a ticket
            if ctx.ticket_id:
                logger.info(f"🛑 [Agent Tool Call] Thread already has ticket #{ctx.ticket_id} for client {ctx.client_id} — preventing duplicate creation")
                return {
                    "status": "ticket_already_exists",
                    "ticket_id": ctx.ticket_id,
                    "message": f"Support ticket #{ctx.ticket_id} is already open for this thread. Do not create a duplicate ticket."
                }

            # 4. First-turn Completeness & Diagnostic Gating:
            # Customers cannot directly create a ticket without proper troubleshooting or actionable failure details.
            if ctx.troubleshooting_step == 0 and len(ctx.history) <= 1:
                body_lower = (ctx.body or "").lower()
                subj_lower = (ctx.subject or "").lower()
                is_explicit_human = any(w in f"{subj_lower} {body_lower}" for w in ["human", "agent", "representative", "person", "speak with someone", "manager"])
                is_unresolvable_crash = any(w in f"{subj_lower} {body_lower}" for w in ["disk failure", "hardware crash", "severance", "demarc", "kernel panic", "database corrupted", "firewall block"])
                has_substantive_detail = len(f"{ctx.subject} {ctx.body}".strip()) >= 30 and any(w in f"{subj_lower} {body_lower}" for w in [
                    "bot", "server", "api", "database", "ivr", "trunk", "campaign", "channel",
                    "error", "login", "call", "dialer", "webhook", "gateway", "token", "auth"
                ])
                if not is_explicit_human and not is_unresolvable_crash and not has_substantive_detail:
                    logger.info(f"🛑 [Agent Tool Call] Blocked direct ticket creation: insufficient diagnostic context on turn 1")
                    return {
                        "status": "details_required",
                        "message": "A support ticket cannot be created without proper diagnostic information. Please ask the customer for the specific component, channel, error messages, and reproduction details first."
                    }

            issue_summary = (arguments.get("issue_summary") or "").strip() or ctx.subject
            priority = arguments.get("priority", ctx.priority or "Medium")
            remarks = (arguments.get("remarks") or "").strip()

            troubleshooting_notes = ""
            if ctx.history:
                troubleshooting_notes = "\n\nTroubleshooting History:\n" + "\n".join(
                    f"- {h.get('role', 'msg').title()}: {h.get('body', '')[:120]}" for h in ctx.history[-12:]
                )
            context_to_send = f"{issue_summary}"
            if remarks:
                context_to_send += f" | Remarks: {remarks}"
            if troubleshooting_notes:
                context_to_send += troubleshooting_notes

            task_data = ctx.to_task_data()
            if ctx.subject.lower() in ("support request", "(no subject)", "no subject") and issue_summary:
                task_data["subject"] = issue_summary[:100]

            # Infer structured technical failure cause
            reason = arguments.get("escalation_reason")
            if not reason:
                body_lower = (ctx.body or "").lower()
                subj_lower = (ctx.subject or "").lower()
                combined = f"{subj_lower} {body_lower}"
                if any(w in combined for w in ["human", "agent", "representative", "person", "speak with someone", "manager"]):
                    reason = "customer_requested_human"
                elif any(w in combined for w in ["refund", "cancel subscription", "billing dispute", "chargeback"]):
                    reason = "policy_human_required"
                elif ctx.troubleshooting_step >= 3:
                    reason = "max_turns_exceeded"
                elif "CRM_Status_Lookup_Error" in ctx.execution_steps or "lookup_failed" in (ctx.context_data or {}).get("status", ""):
                    reason = "connector_api_error"
                elif "Knowledge_Search_Empty" in ctx.execution_steps:
                    reason = "kb_miss"
                elif ctx.score and ctx.score < 75:
                    reason = "low_confidence"
                else:
                    reason = "kb_miss"
            ctx.escalation_reason = reason
            task_data["escalation_reason"] = reason

            reply, ticket_id, status = create_ticket_and_reply(
                data=task_data,
                client_id=ctx.client_id,
                context=context_to_send,
                history=ctx.history,
                cursor=cursor,
                sentiment=ctx.sentiment,
                priority=priority,
                features=ctx.features
            )

            if status == "ticket_creation_failed" or not ticket_id:
                logger.error(f"❌ [Agent Tool Call] Ticket creation failed for client {ctx.client_id}")
                ctx.log_step("Ticket_Creation_Failed")
                return {
                    "status": "ticket_creation_failed",
                    "error": "Failed to create CRM ticket due to external connector failure or timeout.",
                    "hint": "The CRM ticket could not be generated at this time. Formulate a polite apology to the customer and reassure them that our support team will handle their inquiry manually."
                }

            ctx.ticket_id = ticket_id
            ctx.draft_reply = reply
            ctx.status = status
            ctx.log_step(f"Ticket_Created:{ticket_id}")

            return {
                "status": "ticket_created",
                "ticket_id": ticket_id,
                "reply_dispatched": status == "ticket_created_and_sent"
            }

        else:
            logger.warning(f"⚠️ Unrecognized tool name requested: {tool_name}")
            return {
                "status": "unrecognized_tool",
                "error": f"Tool '{tool_name}' is not recognized.",
                "available_tools": [
                    "lookup_order_status",
                    "lookup_payment_status",
                    "lookup_ticket_status",
                    "lookup_ticket_or_order_status",
                    "search_knowledge_base",
                    "escalate_and_create_ticket",
                ]
            }

    except Exception as e:
        logger.error(f"❌ [Agent Tool Call] Unexpected exception executing '{tool_name}': {e}", exc_info=True)
        ctx.log_step(f"Tool_Execution_Error:{tool_name}")
        return {
            "status": "error",
            "tool_name": tool_name,
            "error_type": type(e).__name__,
            "message": str(e),
            "hint": "The external service or connector encountered an unexpected system error. Formulate a polite acknowledgment letting the customer know our support team will review their request directly."
        }

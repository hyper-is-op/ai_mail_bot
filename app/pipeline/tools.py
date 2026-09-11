import json
import logging
from typing import Dict, Any, List, Optional
from app.pipeline.context import PipelineContext
from app.pipeline.enricher import fetch_crm_ticket_status, fetch_rag_context
from app.pipeline.dispatcher import create_ticket_and_reply
from app.connector_executor import format_mapped_data_for_prompt

logger = logging.getLogger(__name__)

# ==========================================
# 🛠️ DECLARATIVE OPENAI FUNCTION SCHEMAS
# ==========================================

SUPPORT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "lookup_ticket_or_order_status",
            "description": "Look up the real-time status, tracking details, and updates of an existing support ticket or order docket number from the client CRM.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticket_id": {
                        "type": "string",
                        "description": "The exact ticket reference or order ID mentioned by the customer (e.g., 'T-260526-00431', 'ORD10294', '#120', '275424000000446001')."
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
                        "description": "The search query string to look up in the vector knowledge base."
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
    cursor
) -> Dict[str, Any]:
    """
    Executes the specified tool with arguments against underlying CRM/RAG backends.
    Returns a dictionary result to feed back into the agent conversation sequence.
    Catches errors and provides structured diagnostics so the agent can adapt gracefully.
    """
    logger.info(f"⚡ [Agent Tool Call] Executing '{tool_name}' with args: {arguments}")
    ctx.log_step(f"Tool_Call:{tool_name}")

    try:
        if tool_name == "lookup_ticket_or_order_status":
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
            if res.get("success"):
                ticket_data = res.get("data") or {}
                formatted_text = format_mapped_data_for_prompt(ticket_data)
                ctx.ticket_id = clean_ticket_id
                ctx.context_data = ticket_data
                ctx.log_step("CRM_Status_Found")
                return {
                    "status": "found",
                    "ticket_id": clean_ticket_id,
                    "details": ticket_data,
                    "summary": formatted_text
                }
            else:
                err_msg = res.get("error")
                ctx.log_step("CRM_Status_Not_Found")
                return {
                    "status": "lookup_failed" if err_msg else "not_found",
                    "ticket_id": clean_ticket_id,
                    "message": err_msg or f"No active record found in CRM for reference '{clean_ticket_id}'",
                    "hint": "If record is not found, ask customer to verify the reference number or provide more context. If an error occurred, apologize for the technical delay and assure them support is investigating."
                }

        elif tool_name == "search_knowledge_base":
            query = arguments.get("query", ctx.body)
            context_text, succeeded, rag_id = fetch_rag_context(ctx.client_id, query)
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
                    "hint": "If the knowledge base does not cover this inquiry, escalate and create a ticket or inform the customer that their issue has been noted for support review."
                }

        elif tool_name == "escalate_and_create_ticket":
            issue_summary = (arguments.get("issue_summary") or "").strip() or ctx.subject
            priority = arguments.get("priority", ctx.priority or "Medium")

            task_data = ctx.to_task_data()
            if ctx.subject.lower() in ("support request", "(no subject)", "no subject") and issue_summary:
                task_data["subject"] = issue_summary[:100]

            reply, ticket_id, status = create_ticket_and_reply(
                data=task_data,
                client_id=ctx.client_id,
                context=issue_summary,
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
                "available_tools": ["lookup_ticket_or_order_status", "search_knowledge_base", "escalate_and_create_ticket"]
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

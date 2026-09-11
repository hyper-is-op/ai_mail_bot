import json
import logging
from typing import Dict, Any, List
from app.pipeline.context import PipelineContext
from app.pipeline.tools import SUPPORT_TOOLS, execute_tool_call
from app.pipeline.drafter import append_client_disclaimers
from app.pipeline.evaluator import evaluate_draft_and_decide
from app.llm import extract_name_from_email, get_llm_config_for_client, get_dynamic_client

logger = logging.getLogger(__name__)


def build_system_prompt(ctx: PipelineContext) -> str:
    """Constructs a grounded, instruction-guided system prompt for the customer support agent."""
    customer_name = extract_name_from_email(ctx.from_email)
    dept_name = "Customer Support Team"
    company_name = ""

    try:
        from app.email_credential import get_email_account
        acc = get_email_account(ctx.client_id)
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

    return f"""You are a professional, accurate customer support agent for {company_name or 'our support team'}.
Customer Name: {customer_name}

You have direct access to tools to:
1. 'lookup_ticket_or_order_status': Look up status of an existing ticket or order ID in the CRM.
2. 'search_knowledge_base': Search company policies, FAQs, manuals, and troubleshooting guides.
3. 'escalate_and_create_ticket': Create a formal support ticket in the CRM if the issue cannot be solved with existing knowledge or if the user requests human agent assistance.

GUIDELINES & HARD CONSTRAINTS:
- If the customer asks about or provides a ticket reference or order ID (e.g., #120, ORD10294, T-260505-00117), you MUST call 'lookup_ticket_or_order_status'.
- If the customer asks how to do something, asks about return policies, or reports a general technical problem, you MUST search the knowledge base using 'search_knowledge_base'.
- If the knowledge base does not contain the answer, or if the customer's problem requires manual technical investigation, call 'escalate_and_create_ticket'.
- NEVER invent facts, order statuses, turnaround times, or tracking links that were not returned by tools.
- Address the customer politely: "Dear {customer_name},".
- End your response with the standard sign-off:
{signoff_text}
"""


def run_support_agent(ctx: PipelineContext, cursor) -> PipelineContext:
    """
    Autonomous ReAct / Tool-Calling Agent Loop.
    The LLM reasons over the customer query, selects tools to call, inspects tool outputs,
    and drafts a grounded, factual response.
    """
    logger.info(f"🤖 [Agent Loop] Starting support agent execution for client={ctx.client_id}, sender={ctx.from_email}")
    ctx.log_step("Agent_Loop_Start")

    # 1. Resolve LLM client and configuration
    cfg = get_llm_config_for_client(ctx.client_id, "run_support_agent")
    config_id = cfg.get("id", 1)
    llm_client = get_dynamic_client(config_id, cfg)
    raw_model = cfg.get("model_name") or "llama-3.3-70b-versatile"
    provider = (cfg.get("provider") or "groq").lower()

    # Normalize model for tool calling
    model_name = raw_model.strip()
    if provider == "groq" and (model_name in ("compound-mini", "compound", "groq/compound-mini", "") or "llama" in model_name):
        model_name = "qwen/qwen3.6-27b"

    # 2. Build conversation messages
    system_prompt = build_system_prompt(ctx)
    messages: List[Dict[str, Any]] = [
        {"role": "system", "content": system_prompt}
    ]

    # Incorporate history if available
    for h in ctx.history[-6:]:
        role = "user" if h.get("role") == "customer" else "assistant"
        body = h.get("body", "")
        if body:
            messages.append({"role": role, "content": body})

    # Latest incoming message
    user_query = f"Subject: {ctx.subject}\n\n{ctx.body}"
    messages.append({"role": "user", "content": user_query})

    # 3. Round 1: Let the model decide whether to call tools
    try:
        response = llm_client.chat.completions.create(
            model=model_name,
            messages=messages,
            tools=SUPPORT_TOOLS,
            tool_choice="auto",
            temperature=0.1
        )
    except Exception as e:
        err_str = str(e)
        if ("tool calling" in err_str.lower() or "404" in err_str) and provider == "groq" and model_name != "qwen/qwen3.6-27b":
            logger.warning(f"⚠️ Model {model_name} failed tool calling on Groq, retrying with qwen/qwen3.6-27b")
            model_name = "qwen/qwen3.6-27b"
            try:
                response = llm_client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    tools=SUPPORT_TOOLS,
                    tool_choice="auto",
                    temperature=0.1
                )
            except Exception as retry_err:
                logger.error(f"❌ [Agent Loop] Tool calling retry failed: {retry_err}")
                ctx.log_step(f"Agent_Completion_Error:{str(retry_err)[:50]}")
                ctx.draft_reply = append_client_disclaimers(
                    ctx.client_id,
                    f"Dear Customer,\n\nThank you for contacting us. We have received your inquiry regarding '{ctx.subject}'. Our support team is currently reviewing your message and will get back to you shortly.\n\nThanks & Regards,\nSupport Team"
                )
                ctx.score = 50
                ctx.response_action = "draft_mode"
                return ctx
        else:
            logger.error(f"❌ [Agent Loop] Primary completion failed: {e}. Falling back to default customer acknowledgement.")
            ctx.log_step(f"Agent_Completion_Error:{str(e)[:50]}")
            ctx.draft_reply = append_client_disclaimers(
                ctx.client_id,
                f"Dear Customer,\n\nThank you for contacting us. We have received your inquiry regarding '{ctx.subject}'. Our support team is currently reviewing your message and will get back to you shortly.\n\nThanks & Regards,\nSupport Team"
            )
            ctx.score = 50
            ctx.response_action = "draft_mode"
            return ctx

    msg = response.choices[0].message
    tool_calls = getattr(msg, "tool_calls", None)

    # 4. Handle Tool Calls
    from app.llm import strip_reasoning_and_think_tags
    if tool_calls:
        logger.info(f"⚡ [Agent Loop] Model emitted {len(tool_calls)} tool call(s)")
        # Append assistant message with tool calls
        messages.append(msg)

        ticket_escalated = False
        for tc in tool_calls:
            tool_name = tc.function.name
            raw_args = tc.function.arguments or "{}"
            try:
                parsed_args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
            except Exception:
                parsed_args = {}

            tool_result = execute_tool_call(tool_name, parsed_args, ctx, cursor)

            if tool_name == "escalate_and_create_ticket" and tool_result.get("status") == "ticket_created":
                ticket_escalated = True

            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(tool_result)
            })

        # If ticket was already created and reply dispatched by the tool, return early
        if ticket_escalated and ctx.status in ("ticket_created_and_sent", "ticket_created_draft_pending"):
            logger.info("✅ [Agent Loop] Ticket escalation completed and reply formulated by outbox.")
            return ctx

        # Round 2: Model synthesizes final answer with tool outputs
        try:
            second_response = llm_client.chat.completions.create(
                model=model_name,
                messages=messages,
                temperature=0.2
            )
            raw_content = second_response.choices[0].message.content or ""
            final_draft = strip_reasoning_and_think_tags(raw_content)
        except Exception as e2:
            logger.error(f"❌ [Agent Loop] Secondary synthesis failed: {e2}")
            final_draft = "Thank you for contacting us. We have received your inquiry and our support team is reviewing your request."

    else:
        # Direct response without tool calls (greeting, casual pleasantry, or direct clarification)
        logger.info("ℹ️ [Agent Loop] Model answered directly without invoking external tools")
        final_draft = strip_reasoning_and_think_tags(msg.content or "")

    # 5. Post-Processing: Disclaimers and Evaluation
    final_draft = append_client_disclaimers(ctx.client_id, final_draft)
    score, decision = evaluate_draft_and_decide(
        client_id=ctx.client_id,
        reply=final_draft,
        query=user_query,
        context_succeeded=bool(ctx.context_text or ctx.context_data or not tool_calls)
    )

    ctx.draft_reply = final_draft
    ctx.score = score
    ctx.response_action = decision
    ctx.log_step(f"Agent_Score:{score}:{decision}")

    logger.info(f"🏁 [Agent Loop] Complete. Score: {score}, Action: {decision}")
    return ctx

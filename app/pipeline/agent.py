import os
import json
import logging
from typing import Dict, Any, List, Optional
import re
from app.pipeline.context import PipelineContext
from app.pipeline.tools import SUPPORT_TOOLS, execute_tool_call
from app.pipeline.drafter import append_client_disclaimers
from app.pipeline.evaluator import evaluate_draft_and_decide
from app.llm import extract_name_from_email, get_llm_config_for_client, client

logger = logging.getLogger(__name__)

RESOLUTION_PATTERNS = [
    # English resolution indicators
    r"\b((it|that|this)\s+(worked|works|is\s+working)|issue\s+(is\s+)?(fixed|resolved)|solved|problem\s+(is\s+)?(fixed|resolved)|all\s+good\s+now|working\s+(fine|now|again|properly)|that\s+helped|resolved\s+now)\b",
    r"\b(thank\s+you\s+(so\s+much|very\s+much)?\s*[,.]?\s*(it\s+is\s+working|it\s+works|all\s+set|that\s+did\s+it))\b",
    # Romanized Hindi / Hinglish resolution indicators
    r"\b((issue|problem|samasya)\s+(solve|theek|fixed)\s+ho\s+(gaya|gayi)|(kaam|audio|call|phone|system|login)\s+(theek|chal|kaam\s+kar)\s+raha\s+hai|theek\s+ho\s+gaya|chal\s+gaya|kaam\s+ho\s+gaya|kaam\s+kar\s+raha\s+hai|sab\s+theek\s+hai|solve\s+ho\s+gaya|solve\s+ho\s+gayi)\b",
    # Devanagari Hindi resolution indicators
    r"(समस्या\s+(हल|ठीक)\s+हो\s+गई|समाधान\s+हो\s+गया|ठीक\s+(हो\s+गया|चल\s+रहा\s+है|काम\s+कर\s+रहा\s+है)|हल\s+हो\s+गई|काम\s+हो\s+गया|आवाज़\s+आ\s+रही\s+है|काम\s+कर\s+रहा\s+है)",
]

def check_customer_resolution(text: str) -> bool:
    if not text:
        return False
    lower = text.lower()
    return any(re.search(pat, lower, re.IGNORECASE) for pat in RESOLUTION_PATTERNS)


def extract_scoring_query(subject: str, body: str) -> str:
    """
    Cleans email threading artifacts (e.g., 'Re:', 'Ticket Update: 12345') from subject
    before forming the query evaluated by llm_score, avoiding false scoring penalties.
    """
    subj = (subject or "").strip()
    subj = re.sub(r'(?i)\b(?:re|fwd|fw):\s*', '', subj)
    subj = re.sub(r'(?i)\bticket\s+update:\s*\d+\b', '', subj)
    subj = re.sub(r'(?i)\b(?:ticket|case|ref)\s*#?\s*\d+\b', '', subj).strip(' :-\t\n')
    if subj and subj.lower() not in (body or "").lower():
        return f"Subject: {subj}\n\n{body}"
    return body or ""


class ParsedFunction:
    def __init__(self, name: str, arguments: str):
        self.name = name
        self.arguments = arguments


class ParsedToolCall:
    def __init__(self, tool_id: str, name: str, arguments: str):
        self.id = tool_id
        self.type = "function"
        self.function = ParsedFunction(name, arguments)


def extract_text_tool_calls(content: str) -> List[Any]:
    """Fallback parser for models that emit tool calls as text markup instead of message.tool_calls."""
    if not content or not isinstance(content, str):
        return []

    calls = []
    raw_blocks = re.findall(r"<tool_call>(.*?)</tool_call>", content, flags=re.DOTALL | re.IGNORECASE)
    for idx, block in enumerate(raw_blocks):
        block = block.strip()
        try:
            parsed = json.loads(block)
            if isinstance(parsed, dict):
                name = parsed.get("name") or parsed.get("tool") or parsed.get("function")
                args = parsed.get("arguments") or parsed.get("parameters") or parsed.get("args") or {}
                if name:
                    arg_str = json.dumps(args) if isinstance(args, dict) else str(args)
                    calls.append(ParsedToolCall(f"call_text_{idx}", name, arg_str))
                    continue
        except Exception:
            pass

        fn_match = re.search(r"<function=([a-zA-Z0-9_-]+)>(.*?)(?:</function>|$)", block, flags=re.DOTALL | re.IGNORECASE)
        if fn_match:
            fn_name = fn_match.group(1).strip()
            fn_body = fn_match.group(2)
            param_matches = re.findall(r"<parameter=([a-zA-Z0-9_-]+)>(.*?)</parameter>", fn_body, flags=re.DOTALL | re.IGNORECASE)
            params = {p_name.strip(): p_val.strip() for p_name, p_val in param_matches}
            calls.append(ParsedToolCall(f"call_text_{idx}", fn_name, json.dumps(params)))

    return calls


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

    from app.pipeline.evaluator import DEFAULT_MAX_TROUBLESHOOTING_STEPS
    max_steps = DEFAULT_MAX_TROUBLESHOOTING_STEPS

    if ctx.troubleshooting_step >= max_steps:
        step_info = f"NOTE: {max_steps} troubleshooting diagnostic steps have already been attempted without success. Diagnostic attempts are EXHAUSTED. You MUST call 'escalate_and_create_ticket' to escalate this thread to a technical specialist and log a formal CRM ticket."
    elif ctx.troubleshooting_step > 0:
        step_info = f"Active troubleshooting in progress: Currently on diagnostic step {ctx.troubleshooting_step + 1} of {max_steps}. Search knowledge base and provide the next troubleshooting step to the customer. Do NOT escalate to a ticket yet because active diagnostics are still underway."
    else:
        step_info = ""

    resolution_instruction = ""
    if ctx.is_resolved:
        resolution_instruction = """
NOTE: The customer has indicated their problem is now RESOLVED.
- Acknowledge this warmly, confirm the issue is resolved, and thank them.
- DO NOT call 'escalate_and_create_ticket'.
"""

    from app.prompt_service import format_prompt
    return format_prompt(
        client_id=ctx.client_id,
        prompt_key="agent_system_prompt",
        company_name=company_name or "our support team",
        customer_name=customer_name,
        step_info=step_info,
        resolution_instruction=resolution_instruction,
        signoff_text=signoff_text
    )


def run_support_agent(ctx: PipelineContext, cursor: Optional[Any] = None) -> PipelineContext:
    """
    Autonomous ReAct / Tool-Calling Agent Loop.
    The LLM reasons over the customer query, selects tools to call, inspects tool outputs,
    and drafts a grounded, factual response.
    """
    logger.info(f"🤖 [Agent Loop] Starting support agent execution for client={ctx.client_id}, sender={ctx.from_email}")
    ctx.log_step("Agent_Loop_Start")

    # Detect if customer confirmed resolution from prior troubleshooting
    if check_customer_resolution(ctx.body) and (ctx.history or ctx.troubleshooting_step > 0):
        ctx.is_resolved = True
        ctx.log_step("Customer_Confirmed_Resolved")
        logger.info(f"✅ Customer confirmed resolution for client={ctx.client_id}, sender={ctx.from_email}")

    # 1. Resolve LLM client and configuration
    cfg = get_llm_config_for_client(ctx.client_id, "run_support_agent")
    raw_model = cfg.get("model_name") or "llama-3.3-70b-versatile"
    provider = (cfg.get("provider") or "groq").lower()

    # Normalize model for tool calling
    model_name = raw_model.strip()
    system_env_model = os.getenv("GROQ_MODEL", "").strip() or "qwen/qwen3.8-27b"
    if provider == "groq" and (model_name in ("compound-mini", "compound", "groq/compound-mini", "")):
        model_name = system_env_model

    # 2. Build conversation messages
    system_prompt = build_system_prompt(ctx)
    messages: List[Dict[str, Any]] = [
        {"role": "system", "content": system_prompt}
    ]

    # Incorporate history if available (up to 16 messages / 8 full back-and-forth turns)
    for h in ctx.history[-16:]:
        role = "user" if h.get("role") == "customer" else "assistant"
        body = h.get("body", "")
        if body:
            messages.append({"role": role, "content": body})

    # Latest incoming message
    user_query = f"Subject: {ctx.subject}\n\n{ctx.body}"
    messages.append({"role": "user", "content": user_query})

    # 3. Multi-Turn ReAct Tool Loop (Up to max_tool_turns)
    from app.llm import strip_reasoning_and_think_tags
    from concurrent.futures import ThreadPoolExecutor

    max_tool_turns = 3
    turn = 0
    all_executed_tool_names = []
    ticket_escalated = False
    final_draft = ""

    while turn < max_tool_turns:
        turn += 1
        logger.info(f"🔄 [Agent Loop] Starting ReAct Turn {turn}/{max_tool_turns} for client={ctx.client_id}")

        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=messages,
                tools=SUPPORT_TOOLS,
                tool_choice="auto",
                temperature=0.1,
                caller="run_support_agent"
            )
        except Exception as e:
            err_str = str(e)
            if ("tool calling" in err_str.lower() or "404" in err_str) and provider == "groq" and model_name != system_env_model:
                logger.warning(f"⚠️ Model {model_name} failed tool calling on Groq, retrying with fallback model {system_env_model}")
                model_name = system_env_model
                try:
                    response = client.chat.completions.create(
                        model=model_name,
                        messages=messages,
                        tools=SUPPORT_TOOLS,
                        tool_choice="auto",
                        temperature=0.1,
                        caller="run_support_agent"
                    )
                except Exception as retry_err:
                    logger.error(f"❌ [Agent Loop] Tool calling retry failed: {retry_err}")
                    ctx.log_step(f"Agent_Completion_Error:{str(retry_err)[:50]}")
                    if not final_draft:
                        cust_name = extract_name_from_email(ctx.from_email)
                        fallback_msg = (
                            f"Dear {cust_name},\n\n"
                            f"Thank you for contacting us. We have received your inquiry regarding '{ctx.subject}'. "
                            f"Our support team is currently reviewing your message and will get back to you shortly.\n\n"
                            f"Thanks & Regards,\nSupport Team"
                        )
                        ctx.draft_reply = append_client_disclaimers(ctx.client_id, fallback_msg)
                        ctx.score = 50
                        ctx.response_action = "draft_mode"
                    return ctx
            else:
                logger.error(f"❌ [Agent Loop] Completion failed on turn {turn}: {e}")
                ctx.log_step(f"Agent_Completion_Error:{str(e)[:50]}")
                if not final_draft:
                    cust_name = extract_name_from_email(ctx.from_email)
                    fallback_msg = (
                        f"Dear {cust_name},\n\n"
                        f"Thank you for contacting us. We have received your inquiry regarding '{ctx.subject}'. "
                        f"Our support team is currently reviewing your message and will get back to you shortly.\n\n"
                        f"Thanks & Regards,\nSupport Team"
                    )
                    ctx.draft_reply = append_client_disclaimers(ctx.client_id, fallback_msg)
                    ctx.score = 50
                    ctx.response_action = "draft_mode"
                return ctx

        msg = response.choices[0].message
        tool_calls = getattr(msg, "tool_calls", None)
        is_text_tool_calls = False
        if not tool_calls and msg.content and ("<tool_call>" in msg.content or "<function=" in msg.content):
            extracted = extract_text_tool_calls(msg.content)
            if extracted:
                tool_calls = extracted
                is_text_tool_calls = True

        if not tool_calls:
            logger.info(f"ℹ️ [Agent Loop] Model concluded reasoning on turn {turn} without requesting further tools")
            raw_content = msg.content or ""
            raw_content = re.sub(r"<tool_call>.*?</tool_call>", "", raw_content, flags=re.DOTALL | re.IGNORECASE).strip()
            final_draft = strip_reasoning_and_think_tags(raw_content)
            break

        # Process tool calls
        logger.info(f"⚡ [Agent Loop] Turn {turn}: Model emitted {len(tool_calls)} tool call(s)")
        if is_text_tool_calls:
            messages.append({
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments if isinstance(tc.function.arguments, str) else json.dumps(tc.function.arguments)
                        }
                    }
                    for tc in tool_calls
                ]
            })
        else:
            messages.append(msg)

        if len(tool_calls) == 1:
            tc = tool_calls[0]
            tool_name = tc.function.name
            raw_args = tc.function.arguments or "{}"
            try:
                parsed_args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
            except Exception:
                parsed_args = {}

            tool_result = execute_tool_call(tool_name, parsed_args, ctx, cursor)
            all_executed_tool_names.append(tool_name)
            if tool_name == "escalate_and_create_ticket" and tool_result.get("status") == "ticket_created":
                ticket_escalated = True

            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(tool_result)
            })
        else:
            logger.info(f"⚡ [Agent Loop] Turn {turn}: Dispatching {len(tool_calls)} tool calls concurrently")

            def _run_single_tool(tc_item):
                t_name = tc_item.function.name
                t_args_raw = tc_item.function.arguments or "{}"
                try:
                    t_args = json.loads(t_args_raw) if isinstance(t_args_raw, str) else t_args_raw
                except Exception:
                    t_args = {}

                from app.db import get_db_ctx
                try:
                    with get_db_ctx() as thread_db:
                        with thread_db.cursor() as thread_cur:
                            res = execute_tool_call(t_name, t_args, ctx, thread_cur)
                            return tc_item.id, t_name, res
                except Exception as ex:
                    logger.warning(f"⚠️ Tool {t_name} thread execution failed: {ex}")
                    res = execute_tool_call(t_name, t_args, ctx, None)
                    return tc_item.id, t_name, res

            with ThreadPoolExecutor(max_workers=min(len(tool_calls), 4)) as executor:
                results = list(executor.map(_run_single_tool, tool_calls))

            for t_id, t_name, tool_result in results:
                all_executed_tool_names.append(t_name)
                if t_name == "escalate_and_create_ticket" and tool_result.get("status") == "ticket_created":
                    ticket_escalated = True
                messages.append({
                    "role": "tool",
                    "tool_call_id": t_id,
                    "content": json.dumps(tool_result)
                })

        # Early return if ticket created and outbox reply handled
        if ticket_escalated and ctx.status in ("ticket_created_and_sent", "ticket_created_draft_pending"):
            logger.info("✅ [Agent Loop] Ticket escalation completed and reply formulated by outbox.")
            return ctx

    # If loop completed via max turns without emitting text, synthesize final reply
    if not final_draft:
        logger.info(f"⚡ [Agent Loop] Synthesizing final answer after {turn} turn(s)")
        messages.append({
            "role": "user",
            "content": "Using the knowledge and tool results above, provide your final helpful troubleshooting response to the customer. Do not call any further tools or output tool tags."
        })
        try:
            second_response = client.chat.completions.create(
                model=model_name,
                messages=messages,
                temperature=0.2,
                caller="run_support_agent"
            )
            raw_content = second_response.choices[0].message.content or ""
            raw_content = re.sub(r"<tool_call>.*?</tool_call>", "", raw_content, flags=re.DOTALL | re.IGNORECASE).strip()
            final_draft = strip_reasoning_and_think_tags(raw_content)
        except Exception as e2:
            logger.error(f"❌ [Agent Loop] Synthesis failed: {e2}")
            final_draft = "Thank you for contacting us. We have received your inquiry and our support team is reviewing your request."

    # Increment troubleshooting step if diagnostic tool called and issue not resolved / escalated
    # General informational queries must NEVER increment diagnostic troubleshooting steps
    if (
        "search_knowledge_base" in all_executed_tool_names
        and not ticket_escalated
        and not ctx.is_resolved
        and ctx.intent not in ("general_query", "marketing_promotional", "greeting")
    ):
        ctx.troubleshooting_step += 1
        ctx.log_step(f"Troubleshooting_Step_{ctx.troubleshooting_step}")

    # 4. Post-Processing: Disclaimers and Evaluation
    final_draft = append_client_disclaimers(ctx.client_id, final_draft)
    is_not_found = bool(isinstance(ctx.context_data, dict) and ctx.context_data.get("status") == "not_found")
    scoring_query = extract_scoring_query(ctx.subject, ctx.body)
    score, decision = evaluate_draft_and_decide(
        client_id=ctx.client_id,
        reply=final_draft,
        query=scoring_query,
        context_succeeded=bool(ctx.context_text or ctx.context_data or not all_executed_tool_names or ctx.is_resolved),
        is_resolved=ctx.is_resolved,
        troubleshooting_step=ctx.troubleshooting_step,
        is_not_found=is_not_found,
        intent=ctx.intent
    )

    ctx.draft_reply = final_draft
    ctx.score = score
    ctx.response_action = decision
    ctx.log_step(f"Agent_Score:{score}:{decision}")

    logger.info(f"🏁 [Agent Loop] Complete. Score: {score}, Action: {decision}")
    return ctx

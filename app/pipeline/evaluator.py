import re
import logging
from typing import Tuple, Dict, Any, Optional
from app.scoring import llm_score
from app.decision import decision_engine
from worker.credential_service import get_email_score_threshold

logger = logging.getLogger(__name__)

AI_DISCLAIMER_PATTERNS = [
    r"as an ai\b",
    r"i am an ai\b",
    r"as a language model\b",
    r"i don't have access to\b",
    r"i do not have access to real-time\b",
]


def check_ai_self_reference(text: str) -> bool:
    """Returns True if the generated draft contains forbidden AI self-referential language."""
    if not text:
        return False
    text_lower = text.lower()
    for pat in AI_DISCLAIMER_PATTERNS:
        if re.search(pat, text_lower):
            return True
    return False


DEFAULT_MAX_TROUBLESHOOTING_STEPS = 3


def evaluate_draft_and_decide(
    client_id: str,
    reply: str,
    query: str,
    context_succeeded: bool = True,
    is_resolved: bool = False,
    troubleshooting_step: int = 0,
    is_not_found: bool = False,
    max_troubleshooting_steps: int = DEFAULT_MAX_TROUBLESHOOTING_STEPS,
    intent: Optional[str] = None
) -> Tuple[int, str]:
    """
    Evaluates reply quality against customer query and determines action.
    Returns (score: int, decision: 'auto_send' | 'create_ticket').
    """
    # 0. If issue is confirmed resolved by customer, confirm closure without escalating
    if is_resolved:
        logger.info(f"✅ Issue resolved for client {client_id} — auto-sending resolution confirmation")
        return 95, "auto_send"

    # 1. Hard floor: If context retrieval failed, evaluate whether this is an initial turn or general query with viable draft
    if not context_succeeded:
        is_informational = intent in ("general_query", "marketing_promotional", "greeting")
        if (troubleshooting_step <= 1 or is_informational) and not is_resolved:
            score = llm_score(reply, query)
            if not check_ai_self_reference(reply):
                if score >= 50:
                    logger.info(f"ℹ️ [Client {client_id}] Context retrieval empty (intent={intent}), but draft scored {score} -> evaluating decision")
                    threshold = get_email_score_threshold(client_id)
                    if threshold is None:
                        threshold = 80
                    return score, decision_engine(score, threshold=threshold)
                elif score >= 30 or is_informational:
                    logger.info(f"ℹ️ [Client {client_id}] Context retrieval empty (intent={intent}), draft scored {score} -> routing to draft_mode rather than ticket escalation")
                    return max(score, 50), "draft_mode"

        logger.warning(f"⚠️ Context retrieval failed for client {client_id} — triggering hard floor ticket creation")
        return 0, "create_ticket"

    # 2. Check for AI self-referential hallucinations
    if check_ai_self_reference(reply):
        logger.warning(f"⚠️ Draft contains AI self-reference for client {client_id} — forcing ticket escalation")
        return 40, "create_ticket"

    # 3. LLM-based Scoring + Rule penalties
    score = llm_score(reply, query)

    # 4. Fetch Client Threshold
    threshold = get_email_score_threshold(client_id)
    if threshold is None:
        threshold = 80

    # 5. During active troubleshooting (Steps 1 through max_troubleshooting_steps), allow diagnostic steps to reach the customer
    # so they can troubleshoot before a formal ticket is created.
    if 1 <= troubleshooting_step <= max_troubleshooting_steps and context_succeeded:
        if score >= 50:
            logger.info(f"🔧 [Client {client_id}] Active troubleshooting step {troubleshooting_step}/{max_troubleshooting_steps} (score: {score}) -> delivering diagnostic to customer")
            return score, "auto_send"

    # 5b. When a reference (ticket/order/payment) is not found in the external system and the agent
    # drafts a clarification asking the customer to verify, deliver it to the customer if score >= 50
    # instead of tripping the strict ticket escalation threshold.
    if is_not_found and context_succeeded:
        if score >= 50:
            logger.info(f"🔍 [Client {client_id}] Reference not found in records (score: {score}) -> delivering clarification request to customer")
            return score, "auto_send"

    # 5c. General / informational inquiries with retrieved knowledge: allow auto_send if score >= 60.
    # If score < 60, route to draft_mode rather than escalating to a CRM support ticket.
    if intent in ("general_query", "marketing_promotional", "greeting"):
        if context_succeeded and score >= 60:
            logger.info(f"💡 [Client {client_id}] General informational inquiry with valid knowledge (score: {score}) -> auto_send")
            return score, "auto_send"
        else:
            logger.info(f"💡 [Client {client_id}] General informational inquiry with score {score} -> draft_mode (ticket creation denied)")
            return score, "draft_mode"

    # 6. Turn (max_troubleshooting_steps + 1)+: Troubleshooting attempts exhausted without resolution -> force ticket escalation
    if troubleshooting_step > max_troubleshooting_steps and not is_resolved:
        logger.info(f"🎫 [Client {client_id}] Troubleshooting step limit reached ({troubleshooting_step}/{max_troubleshooting_steps}) without resolution -> escalating to ticket")
        return score, "create_ticket"

    decision = decision_engine(score, threshold=threshold)
    logger.info(f"📊 [Client {client_id}] Score: {score}, Threshold: {threshold} -> Decision: {decision}")

    return score, decision

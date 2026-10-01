# Decisions: Step 48 - Handle Not Found Clarification Without Escalating to Ticket

## Context
When a customer inquires about a ticket, order, or payment reference that does not exist in the CRM/store (e.g. customer typo, wrong account, or obsolete reference), the lookup connector returns negative results.
Previously, lookup tools returned `{"status": "not_found"}` to the LLM agent without populating `ctx.context_data`. In `agent.py`, `context_succeeded = bool(ctx.context_text or ctx.context_data or not tool_calls or ctx.is_resolved)` evaluated to `False`. The evaluator's hard floor then forced `action: create_ticket`, overriding the LLM's clarification draft and filing an unnecessary new ticket in CRM.

## Decisions

### 1. Differentiate Technical Failures vs. Business "Not Found"
- **Option A**: Treat all unsuccessful tool returns as hard failures. (Current behavior, leads to unwanted ticket creation on typos).
- **Option B**: Differentiate `not_found` (HTTP 404 or empty matching record from working CRM) from actual technical errors (500s, timeouts, auth failures). Record `not_found` context in `ctx.context_data = {"status": "not_found", "reference_id": ..., "type": ...}`.
- **Decision**: Option B. Setting `ctx.context_data` marks `context_succeeded = True` because the lookup successfully determined that the record is not in the CRM.

### 2. Prompt Instruction & Evaluator Tolerance for Clarifications
- **Decision**:
  1. Update agent system prompt so the LLM knows that when a record is not found, it must politely explain this and ask the customer for verification, rather than invoking `escalate_and_create_ticket`.
  2. Update `evaluator.py` so that when `ctx.context_data` indicates a `not_found` status and the reply provides a helpful clarification (score >= 50), the action is `auto_send` (delivering the clarification question) rather than falling below an 80 threshold and forcing a ticket.
- **Reasoning**: This stops the pipeline from opening redundant CRM tickets when all that is needed is a simple "We couldn't find #XYZ, could you please verify your number?" clarification email.

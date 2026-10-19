# Step 139: Technical Decisions

## 1. Intent-Based Escalation Guard vs. Prompt-Only Guidance
- **Options Considered**:
  1. Prompt-only guidance: Instructing the LLM in system prompt to never escalate on general queries.
  2. Structural tool-level enforcement: Enforcing guards directly in `execute_tool_call` when `escalate_and_create_ticket` is invoked under `general_query` intent.
- **Decision**: Option 2 with complementary prompt guidance (defense-in-depth).
- **Reasoning**: LLMs can disregard prompt negative constraints when faced with empty tool context. Enforcing the constraint in Python code guarantees that zero CRM tickets can be spawned for product informational queries regardless of model stochasticity.

## 2. Duplicate Ticket Prevention Strategy
- **Options Considered**:
  1. Unconditional ticket creation per escalation call.
  2. Thread-level idempotency guard: Returning existing ticket reference if `ctx.ticket_id` exists or previous ticket action completed for this thread.
- **Decision**: Option 2.
- **Reasoning**: Multi-turn customer interactions on the same subject should never create multiple orphaned support tickets in Zoho Desk. Returning the existing ticket ensures conversation continuity without ticket spam.

## 3. Deprecating `lookup_ticket_or_order_status` in Tool Declarations
- **Options Considered**:
  1. Keep both `lookup_ticket_status` and `lookup_ticket_or_order_status` in `SUPPORT_TOOLS`.
  2. Remove `lookup_ticket_or_order_status` from `SUPPORT_TOOLS` schema while preserving execution handler in `execute_tool_call`.
- **Decision**: Option 2.
- **Reasoning**: Providing two overlapping tools creates model confusion and wastes prompt tokens. Retaining the execution handler maintains backward compatibility with cached or external tool calls.

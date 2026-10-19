# Architectural Decision: Handling Turn-Exceeded & Post-Escalation Threads

## Context
When a multi-turn troubleshooting conversation reaches the ceiling (`DEFAULT_MAX_TROUBLESHOOTING_STEPS = 3`), Turn 4 escalates to the CRM and logs a support ticket.
In production, customers often follow up on the same thread (Turn 5+) with:
- Additional crash logs / core dumps
- Updated reproduction steps
- Questions about engineer ETA / contact details

## Options Considered

### Option 1: Unconditional Escalation on Turn 4+ (Prior Behavior)
- **Mechanism**: Any turn with `troubleshooting_step >= 3` orders the agent to call `escalate_and_create_ticket`.
- **Consequence**: When Turn 5 arrives with a new `message_id`, outbox idempotency fails across turns. The system creates a duplicate second ticket in the CRM for the same thread.
- **Verdict**: REJECTED. Spams customer and CRM with duplicate tickets.

### Option 2: Thread-Level Ticket Awareness & Existing Ticket Attachment (Standard Pattern)
- **Mechanism**:
  - When `ticket_id` is already associated with the thread (or in `ctx.ticket_id`), suppress new ticket generation.
  - Provide reassurance to the customer that their follow-up details (crash logs, server IP, etc.) have been received and appended to existing ticket `#<ticket_id>` for the assigned engineer.
  - Maintain `troubleshooting_step = 3` so diagnostic attempts remain exhausted without reverting to Step 1.
- **Verdict**: ADOPTED. Clean, professional handoff without duplicate ticket spam or diagnostic amnesia.

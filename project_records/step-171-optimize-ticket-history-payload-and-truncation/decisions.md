# Decisions - Step 171: Optimize Ticket History Payload and Truncation

- **Global Character Limit Increase (8,000 chars)**:
  - *Context*: Multi-turn technical diagnostic troubleshooting (up to 5-6 turns, 12 messages) with command outputs or tracebacks frequently exceeded the arbitrary 3,500 character ceiling, causing premature truncation.
  - *Choice*: Raise the total payload ceiling in `format_conversation_thread()` from 3,500 to 8,000 characters. This remains comfortably below Zoho Desk's ~10,000 character plain text description ceiling and Zendesk/Freshdesk's 64 KB limit.

- **Newest-First Chronological Turn Retention**:
  - *Context*: The previous algorithm sliced `result[:3490]`, which severed the tail of the formatted thread context—dropping the newest diagnostic turns and error messages right before escalation while keeping older messages.
  - *Choice*: Budget character capacity and collect messages from newest to oldest, dropping the oldest turns if the limit is exceeded, then reversing the selected messages back to chronological order with a notice (`[...N older messages omitted to preserve recent diagnostic context...]`).

- **Defensive Latest Customer Inquiry Ceiling (3,500 chars)**:
  - *Context*: If a customer pastes or forwards a massive log (>8,000 chars) in the latest incoming message, it could starve the multi-turn context or exceed the 8,000 char global ceiling on its own.
  - *Choice*: Cap `current_body_clean` at 3,500 characters with `[...latest message truncated...]` if exceeded, guaranteeing at least ~4,000 characters remain for multi-turn troubleshooting context.

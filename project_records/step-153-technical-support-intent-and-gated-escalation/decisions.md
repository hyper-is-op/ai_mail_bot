# Step 153: Technical Support Intent & Gated Ticket Escalation - Technical Decisions

## 1. Intent Taxonomy Strategy: Adding `technical_support` vs Renaming `general_query`
- **Options Considered**:
  1. Rename `general_query` to `general_inquiry` across all components and add `technical_support`.
  2. Preserve `general_query` for informational/product questions and add `technical_support` as a dedicated Set-1 intent.
- **Decision**: Option 2.
- **Reasoning**: Renaming `general_query` would cause severe breaking regressions across existing database logs (`email_logs`, `chat_history`), analytics queries, and 30+ regression tests. Retaining `general_query` while adding `technical_support` cleanly isolates active malfunctions from product questions without breaking backward compatibility.

## 2. Gated Ticket Creation: Diagnostic Exhaustion vs Direct Escalation
- **Options Considered**:
  1. Blanket ban on first-turn ticket creation for all emails.
  2. Unrestricted ticket creation whenever the customer or agent calls `escalate_and_create_ticket`.
  3. 3-path gated escalation policy with completeness validation:
     - Path 1: Default 3-turn diagnostic procedure for technical issues.
     - Path 2: Immediate escalation only when the customer reports a critical unresolvable crash or explicitly requests escalation AND provides complete actionable context (symptom, affected scope). If context is missing, ask clarifying questions before logging a ticket.
     - Path 3: Explicit customer pushback/refusal after at least 1 diagnostic step.
- **Decision**: Option 3.
- **Reasoning**: Blanket banning ticket creation harms incident response for critical outages where full logs are provided upfront, while unrestricted creation creates queue spam with empty tickets. Option 3 ensures tickets are only logged when actionable details or diagnostic transcripts exist.

# Architectural Decisions: Multilingual Escalation Reply Context

## Problem
When `is_ticket=True` in `generate_reply_llm`, `query` (customer text), `history` (dialogue), and `context` (ticket issue details) were discarded.
The prompt sent to the LLM only contained English instruction text and `customer_name`, `ticket_id`, and `team_name`.
As a result:
1. `MULTILINGUAL_DIRECTIVE` could not detect any customer language, defaulting every ticket confirmation email to English.
2. The customer received no confirmation that their specific technical issue was understood.

## Decision
1. Expand `escalation_reply_prompt` variables to `["customer_name", "ticket_id", "team_name", "customer_message", "issue_summary"]`.
2. In `generate_reply_llm`, extract the effective customer inquiry (from `query` or most recent `history` customer message) and ticket context (from `context`).
3. Inject these variables into `format_prompt` using safe dictionary substitution (`SafeDict`), maintaining 100% backward compatibility if legacy client overrides omit the new placeholders.

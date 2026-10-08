# Technical Decisions - Step 63: Telemetry, Dashboard Health & Reporting Engine

## 1. ContextVar-driven LLM Thread Attribution
- **Decision**: Propagate `thread_id` to `telemetry_create` and `log_llm_metrics_db` using a Python `ContextVar` (`current_thread_id`) rather than refactoring all intermediate tool and evaluator function signatures.
- **Reasoning**: `run_support_agent` makes multiple tool calls and secondary completions. Passing `thread_id` as kwargs to every library call would be brittle. ContextVars maintain clean thread isolation across async/Celery tasks.
- **Backfill Strategy**: `email_log_id` is backfilled onto all `llm_logs` rows for that thread created within the last 2 minutes immediately after `email_logs` row creation.

## 2. Inactivity Timeout Thread Lifecycle
- **Decision**: Configurable `inactivity_timeout_hours` (default 72) in `email_accounts`. When a customer emails on a thread whose last activity exceeds this threshold, `resolve_thread_id` generates a new `thread_id`.
- **Reasoning**: Prevents late replies from retroactively mutating past closed conversation metrics (turns, cost, resolution status). Historical continuity is preserved by pulling the last 3 messages of the prior thread as read-only context.

## 3. Decoupling Intent from Escalation Reason
- **Decision**: Store `intent` (business topic) and `escalation_reason` (technical bottleneck) as distinct columns in both `email_logs` and `ticket_record`.
- **Reasoning**: Avoids conflating customer goals (e.g. `refund_request`) with bot limitations (e.g. `policy_human_required` vs `kb_miss`).

# Step 139: Harden General Query Pipeline and Ticket Guards

- 2026-10-19T16:17:30+05:30: Initialized Step 139 to eliminate false CRM ticket escalations on general informational inquiries, prevent duplicate ticket creation loops, and clean tool calling schemas.
- 2026-10-19T16:18:30+05:30: Modified `app/pipeline/tools.py`: stripped Re:/Fwd: and Ticket Update references from `clean_rag_query`, removed redundant `lookup_ticket_or_order_status` schema from `SUPPORT_TOOLS`, and implemented code-level structural guards in `escalate_and_create_ticket` denying escalation on general_query/marketing/greeting and blocking duplicate tickets if `ctx.ticket_id` exists.
- 2026-10-19T16:19:20+05:30: Modified `app/pipeline/agent.py`: isolated `ctx.troubleshooting_step` counter increments from general informational queries and passed `intent` to `evaluate_draft_and_decide`.
- 2026-10-19T16:19:40+05:30: Modified `app/pipeline/evaluator.py`: added `intent` parameter and relaxed empty context hard-floor for general queries, preventing forced `create_ticket` when general queries have empty RAG context.
- 2026-10-19T16:20:00+05:30: Modified `app/prompt_defaults.py` and `docs/prompts_group1_configurable.md`: added dedicated section for General Product & Informational Inquiries instructing the agent to never call `escalate_and_create_ticket` for general product questions.
- 2026-10-19T16:20:45+05:30: Modified `tests/test_agent_tools.py`: updated `test_01_tool_schemas` for 5 primary tools, added `test_10_general_query_escalation_denied`, `test_11_duplicate_ticket_escalation_blocked`, and `test_12_general_query_preserves_troubleshooting_step`.
- 2026-10-19T16:22:40+05:30: Executed full unit test suite discover in worker container: 145/145 tests passed in 20.420s with 0 failures or regressions.
- 2026-10-19T16:23:05+05:30: Restarted `mail_ai_worker` and `mail_ai_api` containers via `docker compose restart worker api` to load modified code into running processes.
- 2026-10-19T16:24:45+05:30: Executed `check_pipeline_health.py` confirming 100% subsystem operational health (Qdrant, Redis, MySQL, Embed service, and all Docker containers).

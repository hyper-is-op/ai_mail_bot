# Step 140: Fix Thread Inquiry Ticket Escalation and Scoring

- 2026-10-19T16:32:00+05:30: Initialized Step 140 to eliminate ticket creation on thread follow-ups with ticket update subjects and prevent low-score ticket creation on general queries.
- 2026-10-19T16:32:56+05:30: Modified `app/pipeline/agent.py`: added `extract_scoring_query` helper to strip threading artifacts (`Re:`, `Ticket Update: \d+`, `Ticket #\d+`) from the subject before passing query to `evaluate_draft_and_decide`, preventing false scoring penalties.
- 2026-10-19T16:33:20+05:30: Modified `app/pipeline/evaluator.py`: added section 5c informational inquiry guard in `evaluate_draft_and_decide` permitting `auto_send` for `general_query` / `marketing_promotional` / `greeting` when `score >= 60` with valid knowledge, and routing to `draft_mode` if below 60, denying CRM ticket creation.
- 2026-10-19T16:33:42+05:30: Modified `worker/tasks.py`: added guards to bypass `create_ticket_and_reply` when `ctx.intent` is informational or `ctx.ticket_id` is already set, safely dispatching the drafted reply via `dispatch_or_draft_reply`.
- 2026-10-19T16:33:54+05:30: Modified `app/scoring.py`: added `General / Product Inquiries` under `## Valid Support Workflows (Score 85-100)` to prevent scoring evaluator from penalizing product responses on existing ticket threads.
- 2026-10-19T16:34:08+05:30: Modified `tests/test_agent_tools.py`: added unit tests `test_13_extract_scoring_query_clean_subject` and `test_14_evaluator_general_query_bypasses_ticket_creation`.
- 2026-10-19T16:36:16+05:30: Modified `worker/tasks.py`: set `ctx.troubleshooting_step = 0` whenever `ctx.intent in ("general_query", "marketing_promotional", "greeting")` to prevent prior troubleshooting counters from leaking into informational interactions.
- 2026-10-19T16:36:57+05:30: Executed `tests/test_problem_reproduction.py` inside live worker container: both Test 1 (Email #407 `tell me about cz omni`, score 93, status `sent`) and Test 2 (Thread follow-up `Re: Ticket Update: 275424000000582153`, score 90, status `sent`, step 0) PASSED 100% in 21.017s with zero duplicate tickets.
- 2026-10-19T16:37:49+05:30: Executed full automated test suite discovery (`python -m unittest discover tests`) across all suites in live worker container: 149/149 tests passed in 40.493s with 0 failures and 0 errors.


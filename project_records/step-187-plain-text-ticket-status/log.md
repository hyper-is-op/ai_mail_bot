# Step 187: Plain Text Ticket Status Formatting (Eliminate Markdown Syntax)

## Objective
Eliminate raw Markdown syntax (`|` table pipes and `*` asterisks) from customer emails by enforcing strict plain-text instructions in `agent_system_prompt` and adding defensive plain-text sanitization in `app/pipeline/agent.py` so outbound plain-text emails render naturally without ASCII syntax noise.

## Execution Log
- 2026-10-29T16:48:30+05:30: Initiated Step 187. Diagnosed that outbound emails in `app/mailer.py` are dispatched strictly as `text/plain` via MIMEText, rendering Markdown table pipes and asterisks as raw literal characters in customer email clients.
- 2026-10-29T16:49:10+05:30: Implemented `strip_markdown_decorations(text)` in `app/llm_utils.py` to defensively convert markdown table rows into hyphenated bullet points, strip table divider lines, and strip bold/italic markdown markers while converting leading asterisks to plain hyphens.
- 2026-10-29T16:49:40+05:30: Integrated `strip_markdown_decorations` into `app/pipeline/agent.py` immediately after ReAct LLM synthesis and prior to evaluator quality scoring.
- 2026-10-29T16:50:15+05:30: Updated `agent_system_prompt` in `app/prompt_defaults.py` to mandate plain-text hyphens (`-`) for ticket status inquiries and explicitly forbidden table pipes (`|`) or markdown asterisks (`*`) in constraints.
- 2026-10-29T16:50:50+05:30: Restarted Docker containers `mail_ai_worker` and `mail_ai_api` to pick up code changes.
- 2026-10-29T16:51:50+05:30: Executed live verification test `tests/test_plain_text_status.py` inside `mail_ai_api` container. Confirmed live generation on Zoho ticket #275424000000661001 produced pure plain-text bullets without `|` or `*`, achieving Quality Score 88 and decision `auto_send`.
- 2026-10-29T16:52:38+05:30: Executed full automated regression suite `tests/run_all.py` inside Docker (Task ID task-389). All 220 tests passed successfully (0 failures, 0 errors, 1 skipped).

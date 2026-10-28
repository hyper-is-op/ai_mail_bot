# Step 161: Fix Marketing Leakage, Thread Entanglement, and History Pollution - Log

- **2026-10-23T15:10:00+05:30**: Initialized step-161 to eliminate marketing email leakage, improper thread entanglement on broadcast blasts, conversation history pollution from dropped emails, and false outbound 'sent' statuses on suppressed delivery.
- **2026-10-23T15:13:00+05:30**: Modified `app/pipeline/filters.py`: expanded broadcast sender detection in `apply_deterministic_filters` to catch broadcast and bulk sending subdomains (e.g. `mail.*`, `newsletter.*`, `updates.*`, `campaign.*`) while exempting standard 2-part domains (like `mail.com`, `mail.ru`), and set `ctx.is_resolved = True` on daemon/bounce and broadcast halts.
- **2026-10-23T15:13:25+05:30**: Modified `app/chat_history.py`: updated `get_history_from_sql` to exclude `no_action_needed` emails from SQL conversation history reconstitution, preventing dropped marketing emails from leaking as unanswered customer messages into future turns.
- **2026-10-23T15:14:00+05:30**: Modified `worker/tasks.py`:
  1. Updated `check_and_resolve_thread_entanglement` candidate query to exclude `no_action_needed`, `system_bounce_dropped`, and `marketing_promotional`/`off_topic_nonsense` intents, preventing dropped marketing emails from acting as open conversation anchors.
  2. Moved `apply_deterministic_filters` execution before `check_and_resolve_thread_entanglement` so bounced or broadcast messages are dropped before any cross-thread entanglement evaluation occurs.
  3. Decoupled the `marketing_promotional` drop gate at line 818 from `ctx.history`, ensuring marketing blasts halt cleanly without LLM drafting or sending, and set `ctx.is_resolved = True`.
- **2026-10-23T15:14:30+05:30**: Modified `app/pipeline/dispatcher.py`: changed unmonitored broadcast delivery suppression return status from `"sent"` to `"no_action_needed"` to maintain lifecycle truth in database logs and dashboards.
- **2026-10-23T15:15:30+05:30**: Added unit tests in `tests/test_pipeline_filters.py` (`test_07_broadcast_subdomain_dropped`, `test_08_public_mail_domain_not_dropped`) and `tests/test_tasks.py` (`test_12_marketing_promotional_dropped_despite_history`).
- **2026-10-23T15:18:00+05:30**: Executed database remediation script: updated logs in `email_logs` for `th_0cb93a9f6077` and any zombie dropped rows to `status = 'no_action_needed'` and `is_resolved = 1`.
- **2026-10-23T15:19:00+05:30**: Restarted Celery worker container (`mail_ai_worker`) to reload Python code and flush worker in-memory bytecode.
- **2026-10-23T15:20:00+05:30**: Verified full regression test suite inside Docker (`docker compose exec -T api python3 tests/run_all.py`): 185/185 unit and integration tests passing in 31.93s with zero failures. Verified `diagnostic_tools/inspect_thread.py th_0cb93a9f6077` displays all 4 logs cleanly as `[ NO_ACTION_NEEDED ]` and `State: RESOLVED`.


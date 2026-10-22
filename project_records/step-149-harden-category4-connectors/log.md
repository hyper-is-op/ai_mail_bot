# Step 149: Harden Category 4 Connectors - Log

- **2026-10-21T02:13:05+05:30**: Initialized step to harden Category 4 entity connectors: implementing BOLA/IDOR email verification with PII masking and manual review routing, tenant-level custom regex matching with ReDoS safeguards, multi-entity disambiguation (order vs ticket), Redis sliding-window rate limiting, and 5xx/timeout circuit breaking.
- **2026-10-21T02:15:35+05:30**: Updated `app/connector_config/table.py` with `id_pattern_regex VARCHAR(255) NULL` and `owner_email_path VARCHAR(255) NULL` column definitions and automatic `ALTER TABLE` startup migrations.
- **2026-10-21T02:15:46+05:30**: Added `validate_id_pattern_regex` in `app/connector_config/validation.py` to validate regex compilation and guard against ReDoS/syntax errors.
- **2026-10-21T02:17:02+05:30**: Updated `execute_connector` in `app/connector_executor.py` to extract `owner_email` via JMESPath and detect `upstream_outage` on timeouts and HTTP 5xx responses.
- **2026-10-21T02:17:33+05:30**: Updated `app/connector_config/dispatch.py` to select new columns in `get_live_config`, added `check_connector_rate_limit` (5 calls per 10m sliding window in Redis DB 0), added `redact_sensitive_pii` to mask sensitive personal info on email mismatch, and updated `run_ticket_status_lookup`, `run_order_status_lookup`, and `run_payment_status_lookup`.
- **2026-10-21T02:18:56+05:30**: Updated `app/pipeline/tools.py` (`lookup_payment_status`, `lookup_ticket_status`, `lookup_ticket_or_order_status`) to log `Connector_Rate_Limited`, `CRM_Upstream_Outage`, and `BOLA_Ownership_Mismatch`, passing context flags to `ctx.context_data`.
- **2026-10-21T02:19:13+05:30**: Updated `evaluate_draft_and_decide` in `app/pipeline/evaluator.py` to route `upstream_outage`, `rate_limited`, and unverified BOLA ownership directly to `draft_mode` (`pending_manual_review`), and updated `app/pipeline/agent.py` to extract and pass these flags.
- **2026-10-21T02:19:53+05:30**: Enhanced `extract_ticket_and_order_ids` in `app/llm_utils.py` to accept `custom_regex`, added `extract_entities_categorized`, exported in `app/llm.py`, and updated `worker/tasks.py` to disambiguate single order + single ticket inquiries without halting for clarification.
- **2026-10-21T02:21:37+05:30**: Created `tests/test_connectors_security.py` covering BOLA ownership verification, PII masking, evaluator draft routing, sliding-window rate limiting, circuit breaking on 5xx/timeout, custom regex extraction, and multi-entity disambiguation.
- **2026-10-21T02:24:40+05:30**: Executed full test runner via `docker exec mail_ai_worker python3 tests/run_all.py`: all 164/164 tests passed cleanly in 32.48s with 0 errors and 0 failures.



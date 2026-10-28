# Step 178: Centralize DB Lifecycle and Schema

## Objective
Centralize all 25 MySQL schema definitions into `app/schema/tables.py`, provide a unified synchronous pre-flight runner `run_sync_database_init()` in `app/db_init.py`, wire it across `api`, `worker`, and `listener`, and remove MySQL metadata lock overhead from inline hot-path DDL calls (`_ensure_table`).

## Actions
- **2026-10-28T14:48:45+05:30**: Initiated Step 178. Plan approved by user.
- **2026-10-28T14:50:58+05:30**: Created `app/schema/__init__.py` and `app/schema/tables.py` consolidating all 25 active table definitions as the single source of truth.
- **2026-10-28T14:53:06+05:30**: Added `run_sync_database_init()` to `app/db_init.py` executing centralized table DDL and migrations synchronously; streamlined `initialize_database_and_services()` to invoke it via thread offload.
- **2026-10-28T14:53:21+05:30**: Wired `run_sync_database_init()` into `worker/celery_worker.py` under `@worker_init.connect` (`init_worker_database`) guaranteeing table presence before Celery consumes queue tasks.
- **2026-10-28T14:53:36+05:30**: Replaced ad-hoc accounts table check in `worker/imap_reader.py` with `run_sync_database_init()` before starting IMAP listener loop.
- **2026-10-28T14:54:12+05:30**: Removed hot-path DDL checks (`_ensure_table`) from `app/chat_history.py` (`upsert_ticket_history`, `get_ticket_history`) and `app/email_credential.py` (`create_email_record_db`).
- **2026-10-28T14:54:49+05:30**: Removed hot-path DDL checks from `app/rate_limiter.py` (`is_sender_exempt`), `app/keyword_filter.py` (`get_blocked_keywords`, `get_blocked_keyword_exceptions`, `insert_blocked_email`), and `app/api/analytics.py`.
- **2026-10-28T14:58:27+05:30**: Added test isolation cleanup for `action_logs` and `action_outbox` in `tests/run_all.py`.
- **2026-10-28T14:59:19+05:30**: Executed backend test suite (`python tests/run_all.py`); all 220 tests passed cleanly in 37.96s (100% OK, skipped=1).
- **2026-10-28T14:59:51+05:30**: Verified clean frontend production bundle (`pnpm run build` / `tsc && vite build`) in 9.95s.

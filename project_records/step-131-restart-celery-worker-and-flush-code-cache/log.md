# Step 131: Restart Celery Worker to Flush In-Memory Bytecode Cache

## Timestamp: 2026-10-16T16:53:00+05:30

## Objective
Diagnose why an inbound email with `(no subject)` and body `tell me about cz onmi` sent at 4:42 PM resulted in an outbound reply with `Re: Ticket Update: 275424000000582077`:
1. Inspect database log row 322 and container uptime.
2. Identify that `mail_ai_worker` had been running continuously for 5 hours without restart; Celery forks did not reload the code changes made in `app/pipeline/dispatcher.py` (Step 129).
3. Restart `mail_ai_worker` to flush in-memory Python bytecode cache without touching IMAP polling (`mail_ai_listener`).
4. Verify Celery worker reinitializes cleanly with `embed_service` connectivity.

## Execution
1. Queried `email_logs` for ID 322: confirmed incoming subject was normalized to `tell me about cz onmi`, but outbound subject was dispatched as `Re: Ticket Update: 275424000000582077` due to Celery holding pre-Step 129 bytecode in memory.
2. Executed `docker compose restart worker` to reload all updated application modules into the Celery worker process pool.
3. Verified via `docker compose ps` and `docker logs mail_ai_worker`: worker initialized with startup gate passing and connected to Redis/MySQL.

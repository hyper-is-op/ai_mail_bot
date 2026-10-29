# Decisions: Reprocessing Email Log #786

## Decision: Execution via Celery Production Pipeline vs Synchronous Scratch Run
- **Context:** Email log #786 failed due to expired/invalid Zoho OAuth credentials and was held in `pending_manual_review`.
- **Options Considered:**
  1. *Synchronous Scratch Execution:* Run `run_support_agent` directly in a Python script. Bypasses Celery, but doesn't exercise the full production worker lifecycle.
  2. *Production Pipeline Re-dispatch (Chosen):* Use the standard pipeline retry payload (`__retry_log_id__: 786`) dispatched via `process_email_task.delay()`. Ensures exact production worker execution, thread resolution, outbox handling, Redis synchronization, and live notification publishing.
- **Draft #9 Handling:**
  - Upon successful dispatch and state transition of #786 to `sent`, stale draft #9 will be marked `discarded` with reason `Superseded by re-processed automated status reply` so it does not linger in the operator's pending review queue.

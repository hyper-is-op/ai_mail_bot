# Decisions: step-51-test-and-verify-conversation-scenarios

## ContextVar Cleanup in Worker Task Lifecycle
- **Context:** During multi-tenant Celery task execution, `current_client_id.set(client_id)` assigns the tenant identifier into Python's `ContextVar`.
- **Issue:** Without resetting the token in the `finally` block, long-lived worker threads retain the tenant ID of the last processed task, causing subsequent tasks or tests executing in the same process to inherit the wrong tenant context.
- **Decision:** Explicitly call `current_client_id.reset(ctx_token)` inside the `finally` block of `process_email_task` in `worker/tasks.py`.

# Technical Decisions - Step 67

## 1. Dead-Letter Queue (DLQ) & Task Retry Architecture
- **Choice**: Dispatch retries via Celery (`process_email_task.delay(data)`) after resetting `email_logs.status = 'pending'` and creating a fresh `task-retry-{id}-{ts}` identifier.
- **Alternatives Considered**: In-process synchronous execution via FastAPI endpoint.
- **Reasoning**: In-process execution would block API worker threads during LLM/RAG generation (5-15 seconds) and bypass Redis rate limiting and retry safeguards. Celery keeps execution async and resilient.

## 2. Closed-Loop RAG Feedback Data Storage
- **Choice**: Create dedicated standalone Q&A document in client's Qdrant vector collection with `source: human_approved_draft` rather than appending/mutating uploaded user files.
- **Reasoning**: Mutating source files (.pdf, .docx, .md) risks file corruption, breaks immutable document integrity, and prevents surgical rollback or deletion.

## 3. SLA & Worker Webhook Alert Architecture
- **Choice**: Store alert preferences in `email_accounts` with a 30-minute Redis cooldown (`alert_cooldown:{client_id}:{type}`) and support standard JSON webhooks compatible with Slack / Discord / PagerDuty.
- **Reasoning**: Avoids alert storms during prolonged outages while keeping zero external dependencies.

## 4. Period-over-Period Delta Calculation
- **Choice**: Compute baseline equivalent prior time window (yesterday for today, prior 7d for 7d, prior 30d for 30d) in SQL and return relative percentage change $\Delta\%$ in dashboard stats.
- **Reasoning**: Provides immediate contextual operational trends without requiring frontend timeseries math.

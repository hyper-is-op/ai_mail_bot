# Diagnostic Tools Suite

Comprehensive CLI diagnostic tools for troubleshooting and inspecting conversations, email processing lifecycles, vector RAG retrieval, and pipeline health.

All tools support dual-mode execution:
- Run directly on the host machine: `python3 diagnostic_tools/<tool>.py ...` (auto-detects project `.venv` and `.env`)
- Or run inside Docker containers: `docker exec mail_ai_worker python diagnostic_tools/<tool>.py ...`

---

## 1. Thread & Email Inspector (`inspect_thread.py`)

Inspects any conversation thread, email log ID, RFC Message-ID, or both. Correlates records across **Email Logs**, **LLM Logs**, **Draft Emails**, **Action Logs / Outbox**, and **Redis Session Cache**.

### Usage
```bash
# By Thread ID
python3 diagnostic_tools/inspect_thread.py th_e3897a2164b8

# By Email Log ID
python3 diagnostic_tools/inspect_thread.py 371
python3 diagnostic_tools/inspect_thread.py #372

# Composite (both Thread ID and Email ID)
python3 diagnostic_tools/inspect_thread.py th_aacab939cfa5 372

# By Message-ID
python3 diagnostic_tools/inspect_thread.py "<CAOSZpAbP0iyxRMDSrj5Er+adGx1HnvkrXHPgizyofw-fUdj1=A@mail.gmail.com>"

# Show full email bodies and draft replies (untruncated)
python3 diagnostic_tools/inspect_thread.py 372 --full

# Output structured JSON for automation or jq
python3 diagnostic_tools/inspect_thread.py 372 --json
```

### Telemetry Extracted
1. **Thread Overview**: Total emails, client ID, resolved state, current troubleshooting step.
2. **Automated Root Cause Triage**: Automatically flags drops (e.g. `off_topic_nonsense`, `marketing_promotional`), RAG empty searches (`Knowledge_Search_Empty`), low score escalations, auto-send passes, and pending human drafts.
3. **Email Logs Timeline**: Subject, sender, status, intent, sentiment, priority, full pipeline steps (`execution_steps`), inbound body, outbound reply.
4. **LLM Invocations & Telemetry**: Per-call breakdown of caller function, model name, prompt tokens, completion tokens, latency (ms), and cost ($).
5. **Human Drafts Queue**: Confidence score, ticket ID, reviewer, review timestamps, rejection reasons.
6. **Outbox Action Logs**: External CRM ticket numbers (Zoho Desk), SMTP delivery confirmations, errors.
7. **Redis DB 1 Cache**: In-memory conversation state, cached message count, remaining TTL.

---

## 2. Recent Logs Triage (`triage_recent.py`)

Rapidly lists and filters recent email logs to identify problematic threads.

### Usage
```bash
# List last 15 emails across all categories
python3 diagnostic_tools/triage_recent.py

# Filter dropped / suppressed emails
python3 diagnostic_tools/triage_recent.py --dropped

# Filter CRM escalated / ticket-created emails
python3 diagnostic_tools/triage_recent.py --escalated

# Filter autonomous auto-sent emails
python3 diagnostic_tools/triage_recent.py --sent

# Filter low evaluator scores (< 80)
python3 diagnostic_tools/triage_recent.py --low-score

# Filter by Client ID and adjust limit
python3 diagnostic_tools/triage_recent.py -c CLI-4159FFCF -n 25
```

---

## 3. RAG & Knowledge Base Inspector (`inspect_rag.py`)

Tests semantic search queries against both the **Qdrant Vector Store** (`mail_ai_knowledge`) and the **Local JSON Fallback Store** (`knowledge_fallback/fallback_<client_id>.json`).

### Usage
```bash
# Test a search query
python3 diagnostic_tools/inspect_rag.py "cz omni"

# Specify client ID and score threshold
python3 diagnostic_tools/inspect_rag.py "cz callblast setup" -c CLI-4159FFCF -t 0.52

# Return top 10 chunks
python3 diagnostic_tools/inspect_rag.py "predictive dialer" -k 10
```

### Outputs
- Embed service latency and vector dimensions (384 dims)
- Cosine similarity scores for each matched chunk with `HIGH`, `PASS`, or `BELOW_FLOOR` badges
- Fallback JSON hybrid scoring results
- Direct diagnosis of whether a query would trigger `Knowledge_Search_Empty` and force CRM escalation.

---

## 4. Pipeline & Subsystem Health Auditor (`check_pipeline_health.py`)

Audits the entire pipeline infrastructure in seconds.

### Usage
```bash
python3 diagnostic_tools/check_pipeline_health.py
```

### Checks Performed
- **Docker Containers**: `mail_ai_api`, `mail_ai_worker`, `mail_ai_listener`, `mail_ai_redis`, `mail_ai_qdrant`, `mail_ai_embed_service`.
- **MySQL Database**: Ping latency and table counts (`email_logs`, `llm_logs`, `action_logs`, etc.).
- **Redis**: DB 0 (Celery broker) and DB 1 (Chat history session cache).
- **Qdrant**: Collection health and indexed point counts.
- **Embedding Microservice**: Port 8500 health, model name, and embedding latency.

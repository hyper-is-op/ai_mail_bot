# Step 29: Decisions - Dashboard Telemetry and Triage Upgrade

### 1. Real Worker Heartbeat vs Naive Database Account Count
- **Options Considered**:
  - *Option A*: Continue using `metrics.active_accounts > 0` to declare the daemon active.
  - *Option B*: Real-time Redis heartbeat key (`imap_worker:heartbeat` & `imap_sync:{client_id}`) updated on each polling cycle and checked on dashboard fetch.
- **Decision**: Option B. Checking DB rows merely verifies credentials exist; it gives false confidence if the worker crashed or hung. Storing and checking the last sweep timestamp in Redis allows the dashboard to accurately indicate whether the ingestion daemon is genuinely alive (<60s) or stalled/offline.

### 2. Confidence Distribution vs Aggregate Average
- **Options Considered**:
  - *Option A*: Display only an aggregate `avg_confidence`.
  - *Option B*: Supplement or replace with confidence tiering (High ≥85%, Borderline 70-85%, Low <70% risk tier).
- **Decision**: Option B. An aggregate 85% average masks dangerous low-confidence responses. Operators need immediate counts of low-confidence emails to inspect potential hallucinations before or during review.

### 3. Queue SLA vs Model Inference Latency
- **Options Considered**:
  - *Option A*: Display only LLM inference latency.
  - *Option B*: Track queue age (oldest pending draft created timestamp) alongside model latency.
- **Decision**: Option B. Model latency is an internal system metric; queue age is an operational SLA metric that warns operators if incoming emails are sitting unhandled.

### 4. Replacing Keyword Regex "Orders Tracked" with Risk & Quality Signals
- **Options Considered**:
  - *Option A*: Keep counting emails with "order" in subject/body and calling it "Connector Lookups".
  - *Option B*: Surface genuine risk triage signals: Escalation/Negative Sentiment count (`sentiment IN ('Frustrated', 'Urgent', 'Negative')`) and Connector status.
- **Decision**: Option B. Naive keyword search was misleading. Real customer sentiment alerts provide genuine operational value.

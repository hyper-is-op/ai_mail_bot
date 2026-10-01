# Step 32: Decisions - LLM Telemetry and Cost Architecture Upgrade

### 1. Database Schema Extension for Correlation
- **Options Considered**:
  - *Option A*: Maintain separate mapping table between `email_logs` and `llm_logs`.
  - *Option B*: Add nullable `email_log_id INT DEFAULT NULL` and `thread_id VARCHAR(100) DEFAULT NULL` columns directly to `llm_logs`.
- **Decision**: Option B. Adding columns directly avoids multi-table joins on high-frequency telemetry writes and allows instant thread/email unit-cost attribution.

### 2. Time-Windowing Query Engine (24h, 7d, 30d, All)
- **Options Considered**:
  - *Option A*: Filter all lifetime data client-side in the browser.
  - *Option B*: Parameterize `/llm/metrics/{client_id}` with `time_window` query parameter and aggregate via SQL with indexed `created_at`.
- **Decision**: Option B. Client-side filtering fails as telemetry tables grow to tens of thousands of rows. SQL aggregation with date intervals ensures constant-time response and accurate historical rollups.

### 3. Separation of Productive vs Guardrail Overhead
- **Options Considered**:
  - *Option A*: Rely solely on raw `caller_function` string names.
  - *Option B*: Categorize callers into "Productive Operations" (`generate_reply_llm`, `detect_intent_llm`) and "Guardrail / Evaluation" (`llm_score`, `generate_summary_llm`, safety checks), computing the exact percentage "Guardrail Tax".
- **Decision**: Option B. Gives operators actionable insight into how much compute is spent validating and scoring versus generating customer replies.

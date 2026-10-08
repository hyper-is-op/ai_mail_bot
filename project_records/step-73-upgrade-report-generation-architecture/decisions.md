# Technical Decisions: Step 73

## 1. Replacing Synthetic Heuristic CSAT with Verified Sentiment Scores
- **Context:** The previous implementation calculated fake CSAT scores (e.g., 4.9 for positive, 2.4 for negative, 3.4 for manual review) and presented them as genuine CSAT telemetry.
- **Decision:** Replaced `ai_inferred_csat` with `sentiment_score` (-1.0 for negative/frustrated, 0.0 for neutral, +1.0 for positive/delighted) alongside the existing conversational sentiment trajectory shift (e.g., `Frustrated → Resolved`).
- **Rationale:** Prevents fabricated customer satisfaction metrics during audits or client reviews while still providing quantitative sentiment direction.

## 2. Replacing Correlated SQL Subqueries with Pre-Aggregated GROUP BYs
- **Context:** Querying thousands of report rows was executing two correlated subqueries per row (`SELECT COUNT(*) FROM email_logs WHERE thread_id = ...` and `SELECT SUM(cost) FROM llm_logs WHERE ...`), creating quadratic performance degradation on larger datasets.
- **Decision:** Pre-aggregated turn counts and thread costs using grouped subqueries joined on `thread_id`.
- **Rationale:** Drastically reduces query latency and resource contention on the database instance.

## 3. Enforcing UTC Date Bounds in Report Filtering
- **Context:** Filter logic previously used MySQL server `CURDATE()` and local date math, leading to discrepancies depending on server timezone versus client timezone.
- **Decision:** Shifted to `UTC_TIMESTAMP()` and explicit `00:00:00` to `23:59:59` timestamp boundaries.
- **Rationale:** Ensures report exports match consistent UTC standards regardless of where the server or client is hosted.

# Step 24 Decisions - Dashboard Live Feed and Real Latency

## Context & Rationale
1. Previous throughput latency on Dashboard was hardcoded to `~1.8s / email`. We replace it with real average roundtrip latency fetched dynamically from `api.getLlmMetrics(cid)`.
2. Operators had no visibility into live inbound emails from the Dashboard. We add a compact "Live Inbound Processing Stream" mini-table showing the 5 most recent handled emails with sender, subject, outcome badge, and timestamp.
3. Operations dashboard lacked auto-refresh capabilities, forcing manual clicks. We add an auto-refresh selector (`Off`, `30s`, `60s`) with an active polling heartbeat timer.

## Implementation Details
- Auto-refresh configured via `setInterval` inside `useEffect` watching `autoRefreshRate` and `selectedClientId`.
- Recent emails retrieved via `api.getEmails(cid)` and sliced to top 5 most recent.
- Latency mapped from `llmMetrics?.totals?.avg_latency`.

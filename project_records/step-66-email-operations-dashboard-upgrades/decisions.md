# Decisions: Email Operations Dashboard Upgrades

## 1. Actionable Metric Deep-Linking
- **Options**:
  1. Plain stat display without interactivity.
  2. Direct navigation with URL query params to `/drafts`, `/inbox`, and `/tickets`.
- **Decision**: Option 2. Link each metric card (e.g. `Hallucination Risk`, `System Bounces`, `KB Misses`, `Low Confidence`) directly to its filtered destination view (`/drafts?subfilter=hallucination_risk`, `/inbox?status=system_bounce_dropped`, `/tickets?reason=kb_miss`).

## 2. Ingestion Pipeline & Worker Health
- **Options**:
  1. Rely purely on frontend WebSocket status.
  2. Expose real-time worker queue depth, Celery heartbeat status, and IMAP poll timestamp via `/stats/{client_id}`.
- **Decision**: Option 2. Add an `ingestion_health` payload to `/stats/{client_id}` that inspects Redis queue length and Celery task heartbeat, returning queue depth, worker status, and oldest unhandled ingestion latency.

## 3. First-Contact Resolution (FCR) vs. Multi-Turn Deflection
- **Options**:
  1. Keep single Customer Resolution Rate (CRR) percentage.
  2. Decompose deflection into One-Touch (FCR, turn=1), Multi-Turn (turns 2-4), and Runaway Risk (5+ turns).
- **Decision**: Option 2. Operators need to know if automated solutions are immediate or dragged out.

## 4. Intent Automation Matrix
- **Options**:
  1. Simple volume distribution pie chart.
  2. Tabular matrix correlating Intent with Total Volume, Auto-Send %, Average Turns to Close, and Primary Escalation Trigger.
- **Decision**: Option 2. Allows management to pinpoint which specific business areas lack KB coverage or API stability.

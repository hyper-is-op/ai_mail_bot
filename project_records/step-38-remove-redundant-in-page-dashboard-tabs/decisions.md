# Step 38: Decisions - Remove Redundant In-Page Dashboard Tabs

### 1. Eliminating Double Navigation on Dashboard
- **Rationale**: Having both a sidebar nested sub-menu and an in-page tab bar for the exact same sub-views introduced visual clutter and header incoherence.
- **Decision**: Remove the in-page tab bar (`[ Email Traffic & Ingestion ] [ LLM Tokens & AI Telemetry ]`). When `tab=llm`, render `LlmAnalytics` directly with its native title and controls. When `tab=email` (or default `/dashboard`), render the Email Operations Dashboard header and live heartbeat metrics.

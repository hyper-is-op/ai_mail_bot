# Step 35: Decisions - Consolidate LLM Telemetry into Dashboard

### 1. Elimination of Navigation Redundancy & Category Misalignment
- **Options Considered**:
  - *Option A*: Remove `LLM Cost & Telemetry` from Sidebar (`Configuration` section) and preserve unified tab toggling on `/dashboard`.
  - *Option B*: Remove the tab from `/dashboard` and move LLM Cost & Telemetry to a separate top-level sidebar category.
- **Decision**: Option A (chosen by user). Prevents clutter in the sidebar, corrects the conceptual mistake of labeling telemetry as "Configuration", and keeps all high-level operational and AI performance metrics in the central Dashboard.

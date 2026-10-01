# Step 37: Decisions - Add Nested Dashboard Sub-Menu in Sidebar

### 1. Structure of Dashboard in Sidebar
- **Options Considered**:
  - *Option A*: Flat links in an Overview section.
  - *Option B*: Collapsible nested sub-menu with parent item 'Dashboard' and child links 'Email Traffic & Ingestion' (`/dashboard?tab=email`) and 'LLM Tokens & Telemetry' (`/dashboard?tab=llm`).
- **Decision**: Option B (selected by user). Keeps the sidebar visually hierarchy-driven while giving 1-click access to both sub-views without cluttering top-level navigation.

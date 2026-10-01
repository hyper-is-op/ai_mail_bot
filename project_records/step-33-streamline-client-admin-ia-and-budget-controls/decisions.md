# Step 33: Decisions - Streamline Client and Admin IA and Budget Controls

### 1. Persona-Focused Sidebar Reorganization
- **Options Considered**:
  - *Option A*: Keep identical 10-item menu for both clients and admins.
  - *Option B*: Tailor navigation to user role: clients see core operational workflows (`Dashboard`, `Mail Monitor`, `Drafts`, `Tickets`, `Mailbox`, `Knowledge Base`, `LLM Usage`, `Settings`); developer/infrastructure tools (`AI Pipeline Trace`, `Integrations & Webhooks`) are moved under `Administration` for Admins only.
- **Decision**: Option B. Prevents cognitive overload for non-technical customer support reps and operators who do not need internal Celery traces or raw webhook schemas.

### 2. LLM Telemetry Promotion
- **Options Considered**:
  - *Option A*: Leave LLM telemetry hidden as a query param tab (`/dashboard?tab=llm`).
  - *Option B*: Promote `/llm-analytics` to a direct first-class route with its own sidebar link, while preserving the Dashboard tab for backward compatibility.
- **Decision**: Option B. AI costs and token metrics are a primary concern for business operators and deserve direct access.

### 3. Inline Monthly Budget Control in Admin Clients
- **Options Considered**:
  - *Option A*: Leave budget configuration to direct database updates or curl commands.
  - *Option B*: Expose `monthly_budget_usd` alongside `cost_multiplier` in `AdminClients.tsx` and wire to `api.setClientCostConfig` so admins can set budget ceilings directly in the UI.
- **Decision**: Option B. Closes the gap where budget telemetry displayed alerts but gave admins no mechanism to configure the limits.

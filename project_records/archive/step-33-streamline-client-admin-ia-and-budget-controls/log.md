# Step 33: Streamline Client and Admin Information Architecture and Budget Controls

- **Timestamp**: 2026-09-29 14:30:00 +05:30
- **Action**: Initiated IA reorganization and budget control implementation. Scope includes promoting LLM Telemetry to a dedicated route and sidebar entry, pruning redundant Home link from primary nav, restricting developer tools (AI Pipeline Trace and Raw Webhook Payloads) from non-admin clients into the Administration section, providing an inline Monthly LLM Budget ($) input in Admin Clients, and adding a clear Fleet Overview banner on Settings when 'ALL' is selected.

- **Timestamp**: 2026-09-29 14:32:00 +05:30
- **Action**: Modified `frontend/src/App.tsx` to render `<LlmAnalytics />` directly at `/llm-analytics`. Updated `frontend/src/components/Sidebar.tsx` to remove duplicate Home link, move AI Pipeline Trace and Webhooks into Administration (admin-only), and add LLM Cost & Telemetry under Configuration. Updated `frontend/src/pages/AdminClients.tsx` to add `monthly_budget_usd` input alongside `cost_multiplier` and wired `handleSaveProfile` to update both client profile and cost config. Added Fleet Overview banner to `frontend/src/pages/Settings.tsx` for `ALL` clients.

- **Timestamp**: 2026-09-29 14:34:00 +05:30
- **Action**: Executed `pnpm --dir frontend run build`. Verification passed with 0 TypeScript/compilation errors (`tsc && vite build` succeeded in 12.32s).

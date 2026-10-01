## Context & Rationale
The application had navigation and UX issues identified during review:
1. Static title "Settings" was hardcoded in the Topbar regardless of which page the user navigated to.
2. Sidebar presented an unstructured flat list of 10-12 items with jargon ("Reference Status", "System Connector", "Mail (Monitor/Control)").
3. Both `Sidebar.tsx` and `Topbar.tsx` were maintaining duplicate 15s polling intervals against `/drafts/pending-count`.

## Decisions Made
- **Dynamic Route Titles**: Mapped `location.pathname` to human-readable titles (e.g., "Mail Monitor", "Knowledge Base (RAG)", "Settings & Policies", "Integrations & Webhooks") in [Topbar.tsx](file:///home/hyper_is_op/mail_ai_automation/frontend/src/components/Topbar.tsx).
- **Grouped Sidebar Navigation**: Partitioned navigation into logical categories in [Sidebar.tsx](file:///home/hyper_is_op/mail_ai_automation/frontend/src/components/Sidebar.tsx):
  - **Operations**: Mail Monitor, Drafts & Approvals (with badge), Tickets & Escalations.
  - **Configuration**: Mailbox Accounts, Knowledge Base (RAG), Integrations & Webhooks, Settings & Policies.
  - **Analytics & Admin**: LLM Analytics, Clients Management, AI & Models Config.
- **Shared AppState Context**: Introduced [AppStateContext.tsx](file:///home/hyper_is_op/mail_ai_automation/frontend/src/context/AppStateContext.tsx) wrapped in [Layout.tsx](file:///home/hyper_is_op/mail_ai_automation/frontend/src/components/Layout.tsx) to deduplicate network polling for pending draft counts across the shell.
- **Refined Quick Search**: Aligned the search bar categories and placeholder text ("Search modules, settings, or tools...").

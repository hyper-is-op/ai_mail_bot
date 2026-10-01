# Decision: 4-Tier Functional Sidebar & Consolidated Profile Menu

## Problem Statement
- `Knowledge Base (RAG)` was misplaced inside `Operations`, which mixed static AI training context with live email processing streams (`Mail Monitor`, `Tickets & Escalations`).
- Non-admin client operators had no access to `Administration` in the sidebar, making it awkward to check their own `Mailbox Accounts` or `Integrations & Webhooks`.
- `/home` (Configuration Hub) was completely unlinked in the UI, rendering it orphaned.
- The top-right profile dropdown contained duplicate links (`Mailbox Accounts`) while missing the overview portal (`/home`).

## Decision
- Establish a dedicated **AI & Knowledge** tier in the sidebar:
  - `Knowledge Base (RAG)`
  - `AI Pipeline Trace`
- Keep **Operations** purely operational:
  - `Mail Monitor`
  - `Drafts & Approvals`
  - `Tickets & Escalations`
- Make **Management / Administration** accessible across roles:
  - `Mailbox Accounts` and `Integrations & Webhooks` accessible to both Clients and Admins.
  - `Clients Management` and `AI & Models Config` strictly Admin-only.
- Profile Dropdown:
  - Serves as the system gateway for `Configuration Hub` (`/home`) and `Settings & Policies` (`/settings`).

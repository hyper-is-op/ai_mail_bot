# Step 36: Decisions - Reorganize Configuration into Operations and Admin

### 1. Dissolution of the Sidebar Configuration Section
- **Rationale**: The previous `Configuration` group awkwardly mashed together operational content (`Knowledge Base`), tenant account setup (`Mailbox Accounts`), and system preferences (`Settings & Policies`). 
- **Decisions**:
  - `Knowledge Base (RAG)` is core AI domain knowledge managed by support ops, so it moves directly into `Operations`.
  - `Settings & Policies` is system and profile preferences, so it is accessed via the top-right user profile menu (standard SaaS pattern).
  - `Mailbox Accounts` for Admin is global mailbox infrastructure, so it moves into `Administration`. For Clients, it is accessible via their user profile dropdown (and searchable globally).

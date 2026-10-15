# Technical Decisions - Step 50: Sync Frontend Codebase to Smart_Mail_Agent_FE

## Decision: Synchronization via `rsync -av --delete`

### Context
User requested clearing `/home/hyper_is_op/Smart_Mail_Agent_FE` and copying all contents from `/home/hyper_is_op/mail_ai_automation/frontend`.

### Analysis & Risks
1. A raw `rm -rf` of `/home/hyper_is_op/Smart_Mail_Agent_FE` would delete ~300MB of identical `node_modules` dependencies, which would either need to be slowly re-copied or re-installed via package managers, creating unnecessary I/O thrashing and potential symlink corruption.
2. An `rsync -av --delete` ensures:
   - All obsolete files in target (e.g. `ApiTesting.tsx`, `OrderTracking.tsx`, `SystemHealth.tsx`, obsolete build hashes) are deleted.
   - All new directories (`fluent/`, `context/`) and modified files (`App.tsx`, `Sidebar.tsx`, `Topbar.tsx`, `Dashboard.tsx`, etc.) are updated.
   - Identical dependency files are preserved without redundant disk re-writes.
   - The target directory becomes an exact byte-for-byte replica of source frontend.

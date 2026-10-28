# Step 181 Log: Fix Login 401 Redirect Loop

- **2026-10-28T15:23:30+05:30**: Initialized step-181 to resolve rapid reload and error message wipe on invalid login credential submission at subpath `/Smart_Mail_Agent/login`.
- **2026-10-28T15:24:00+05:30**: Modified `handleAuthFailure` in `frontend/src/lib/api/core.ts` to suppress redirects when 401 response originates from `/login`, `/register`, or `/forgot-password`, and resolved subpath `window.__APP_CONFIG__.BASENAME` before navigating on expired sessions.
- **2026-10-28T15:24:33+05:30**: Verified clean compilation in workspace via `pnpm run build` (0 errors, 9.59s).
- **2026-10-28T15:24:50+05:30**: Synced updated `core.ts` to `/home/hyper_is_op/Smart_Mail_Agent_FE/src/lib/api/core.ts`.
- **2026-10-28T15:25:17+05:30**: Compiled production bundle in `/home/hyper_is_op/Smart_Mail_Agent_FE` via `pnpm run build` (`index-wDbfHp36.js`, `index-DKlAIkV5.css`).
- **2026-10-28T15:25:34+05:30**: Deployed production bundle to `/var/www/html/Smart_Mail_Agent/`, purged obsolete bundle chunk `index-Dpj4gDva.js`, and preserved `config.js` (`BASENAME: "/Smart_Mail_Agent"`).
- **2026-10-28T15:25:41+05:30**: Committed web root changes to Git repo as commit `8f85ff0`.
- **2026-10-28T15:25:49+05:30**: Verified live HTTP 200 responses via curl for `index.html`, `config.js`, `index-wDbfHp36.js`, and `index-DKlAIkV5.css` on `http://172.16.3.215/Smart_Mail_Agent/`.

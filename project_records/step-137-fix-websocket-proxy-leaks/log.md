# Step 137: Fix WebSocket Proxy Leaks

## 2026-10-19 13:15:00 IST
- Identified root cause of Vite WebSocket ECONNRESET and socket hang up errors:
  1. Component unmount in Inbox.tsx failed to guard onclose callbacks, causing async reconnection timeouts to spawn orphaned background loops and multiply concurrent WebSockets to 6-8.
  2. Vite proxy lacked an error handler on /ws, dumping ECONNRESET/socket hang up traces to stdout during dev restarts.
  3. Uvicorn in docker-compose.yml watched the entire /app tree including tests/ and diagnostic_tools/, triggering unnecessary server restarts on test/diagnostic tool edits.

## 2026-10-19 13:16:30 IST
- Patched frontend/src/pages/Inbox.tsx with isCleanedUp lifecycle guard, explicit close code 1000, and cleared onclose/onerror/onmessage/onopen handlers on cleanup to eliminate zombie reconnect loops.
- Updated frontend/vite.config.ts /ws proxy with configure hook to gracefully suppress ECONNRESET, ECONNREFUSED, and socket hang up traces during dev restarts.
- Updated docker-compose.yml api service command with --reload-dir app to confine Uvicorn reloads to application code.
- Initiated frontend build verification to ensure zero TypeScript regressions.

## 2026-10-19 14:26:00 IST
- Production frontend build passed cleanly (tsc && vite build in 11.29s).
- Full test suite passed (140/140 unit tests in 20.488s).
- Recreated api container (docker compose up -d api) to apply --reload-dir app.
- Verified logs: Active WebSocket connections dropped from 6-8 down to 1 (`Active connections: 1`), confirming zombie socket multiplication is resolved.



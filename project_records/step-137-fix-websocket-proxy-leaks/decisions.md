# Decisions: Fix WebSocket Proxy Leaks

## Decision 1: React Lifecycle Guarding in Inbox.tsx
- **Options considered**:
  1. Rely on `ws.close()` without status code or callback nulling.
  2. Implement an active lifecycle flag (`isCleanedUp`), set `ws.onclose = null` upon cleanup, specify clean closure code `1000`, and clear timeouts.
- **Choice**: Option 2.
- **Reasoning**: `ws.close()` triggers `onclose` asynchronously with code 1005 (not 1000). Without setting `isCleanedUp = true` and clearing `ws.onclose`, the `onclose` listener treated the component cleanup as an unexpected disconnection and scheduled a reconnect timeout, leaving zombie loops that compounded into 6-8 concurrent WebSocket connections per user session.

## Decision 2: Suppress Vite Dev Proxy Transient Connection Resets
- **Options considered**:
  1. Leave default Vite proxy error handler to output uncaught ECONNRESET / socket hang up errors.
  2. Add `configure` hook on `/ws` proxy in `vite.config.ts` to swallow transient dev restart resets (ECONNRESET, ECONNREFUSED, socket hang up) while still logging genuine fatal errors.
- **Choice**: Option 2.
- **Reasoning**: In development environments with hot-reloading backends, TCP resets during server reload are expected and normal. Logging full error traces clutters the terminal.

## Decision 3: Narrow Uvicorn Reload Directory in docker-compose.yml
- **Options considered**:
  1. Keep default `--reload` watching all mounted directories (`/app`, including `tests/` and `diagnostic_tools/`).
  2. Pass `--reload-dir /app/app` to Uvicorn in `docker-compose.yml`.
- **Choice**: Option 2.
- **Reasoning**: Only changes to API application logic in `app/` should trigger an API server reload. Running tests or modifying diagnostic tools should not restart the API or sever active client WebSockets.

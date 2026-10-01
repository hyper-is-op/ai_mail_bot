# Step 12: Authenticate Frontend WebSocket Connection

## 2026-09-28 01:48:45
- Inspected backend WebSocket implementation in `app/main.py`. The `/ws` endpoint enforces authentication: `websocket_endpoint(websocket: WebSocket, token: str = None)`. If `token` is missing or invalid, it immediately rejects the connection with code `4001`.
- Inspected frontend implementation in `frontend/src/pages/Inbox.tsx`. Found that `connectWS` instantiated `new WebSocket(wsUrl)` without extracting the user's session token from `localStorage` or passing `?token=<token>`.
- Identified that without the token parameter, the backend constantly rejected the connection on arrival, causing repeated 4001 disconnection and reconnect loops every 4 seconds.
- Updating `frontend/src/pages/Inbox.tsx` to retrieve the active session token from `localStorage.getItem('user')` and append `?token=${encodeURIComponent(token)}` to `wsUrl`.
- Adding safeguards to ensure connection is skipped or handled cleanly if unauthenticated.

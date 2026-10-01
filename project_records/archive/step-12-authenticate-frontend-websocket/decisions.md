# Step 12 Decisions: Authenticating Frontend WebSocket Connection

## WebSocket Authentication Mechanism
- **Context:** The FastAPI backend `/ws` endpoint requires a session token via query parameter (`token: str = None`) and looks up the active session in Redis via `get_session(token)`.
- **Options Considered:**
  1. *Remove backend authentication on `/ws`:* Insecure. Anyone connecting to `/ws` could listen to real-time email ingestion metadata across clients or trigger unauthenticated connections.
  2. *Send authentication via initial WebSocket message handshake (`{"type": "AUTH", "token": "..."}`):* Would require altering the backend endpoint lifespan and connection manager handling, breaking any other clients expecting the current query param contract.
  3. *Pass session token via query param in `Inbox.tsx` (Chosen):* Follows the existing backend contract defined in `app/main.py:239`, reuses the authenticated session token stored in `localStorage.getItem('user')`, and restores immediate connectivity without backend schema changes.

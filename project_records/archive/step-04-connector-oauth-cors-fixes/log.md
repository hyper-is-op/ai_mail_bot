# Step 04: Connector OAuth Handshake and CORS Fixes
- **Timestamp:** 2026-09-15 12:00 IST
- **Action:** Added OAuth token auto-fallback and CORS whitelist support.
- **Details:**
  1. Updated `app/main.py`, `.env`, and `.env.example` to allow port 80 origins and strip trailing slashes for `email-azentik-ai.c-zentrix.com`.
  2. Implemented `authorization_code` grant handling and automatic fallback in `app/api/connectors.py` to convert Grant Tokens to permanent Refresh Tokens.
  3. Added UI support in `frontend/src/components/payload-config/ConnectorEditorModal.tsx` and updated state management in `frontend/src/pages/PayloadConfig.tsx`.

# Step 26 Decisions - Dashboard Deep Linking and Heartbeat

## Context & Rationale
1. Clicking rows in the Dashboard's Live Inbound Processing Stream previously redirected to `/inbox` root without selecting the clicked email, causing friction.
2. The Dashboard showed aggregate numbers but had no visible signal showing that the background ingestion listener daemon is active.
3. Inbound emails were missing intent category and sentiment tags, concealing customer urgency and query types.

## Changes Made
- **Deep Linking**: Navigating with `/inbox?id=${item.id}` and selecting the matching thread in `Inbox.tsx`.
- **Daemon Heartbeat Pill**: Added live ingestion heartbeat badge in Dashboard header indicating listener state (`Active (Polling)` vs `Standby`).
- **Classification & Sentiment**: Displayed category tag and sentiment dot on each live stream item.

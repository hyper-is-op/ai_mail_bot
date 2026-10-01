# Step 13: Fix Selection Reset During Inbox Background Sync

## 2026-09-28T11:56:40+05:30 - Initiated Investigation
- Observed reported defect: Selecting any conversation other than the top one resets back to the top item after 1-2 seconds.
- Identified background polling (every 3.5s) triggering re-renders with fresh `emailsList` data.
- Located bug in `useEffect` selection sync logic in `frontend/src/pages/Inbox.tsx` where loose sender fallback `t.sender.toLowerCase() === selectedThread.sender?.toLowerCase()` matched the first thread at index 0 from the same sender, or inappropriately fell back to `filteredThreads[0]`.

## 2026-09-28T11:57:00+05:30 - Implemented Fix
- Updated `Inbox.tsx` to preserve `selectedThread` by exact key (`t.key === selectedThread.key`), eliminating sender collision fallback.
- Added explicit tab change handler `handleTabChange` to reset selection only on intentional tab switches, avoiding unexpected top selection resets.
- Kept thread details stable across live WebSocket updates and background polling cycles.

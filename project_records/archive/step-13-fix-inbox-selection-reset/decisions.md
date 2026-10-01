# Decision: Stable Thread Selection During Background Ingestion and Polling

## Problem
In `Mail (Monitor/Control)`, background polling (every 3.5s) and incoming WebSocket notifications refresh `emailsList`. Whenever the list recomputed, an auto-selection `useEffect` tried to update the active item.
However:
1. It used `filteredThreads.find(t => t.key === selectedThread.key || t.sender.toLowerCase() === selectedThread.sender?.toLowerCase())`. When multiple threads share the same sender, `find` picked index 0 (the topmost thread of that sender).
2. If `selectedThread` was set to a specific thread that still existed in the filtered list, any mismatch or fallback caused immediate reassignment to `filteredThreads[0]`.

## Options Considered
1. **Remove auto-selection completely**:
   - Pros: Never resets automatically.
   - Cons: Empty pane on first load until user clicks something. Poor UX.
2. **Key-based preservation with tab change reset**:
   - Only select `filteredThreads[0]` if `selectedThread` is null/empty.
   - If `selectedThread` exists, search exclusively by exact unique key `t.key === selectedThread.key`.
   - Only reset to `null` or top item when the user intentionally switches tabs (`handleTabChange`) or changes the active client tenant.
   - Pros: Rock solid stability during live polling and background ingestion. No flicker or jumping to index 0.

## Chosen Solution
Option 2: Use exact key lookup without sender fallback, and manage selection resets on user-driven actions (tab switches, client changes).

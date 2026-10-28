# Step 172: Universal Clipboard Fallback and Badge Selection

## Log
- 2026-10-27T14:17:15+05:30: Initialized step to implement universal clipboard fallback for insecure HTTP contexts and enable badge text selection across the frontend.
- 2026-10-27T14:17:30+05:30: Created `frontend/src/lib/clipboard.ts` with `copyToClipboard` implementing primary `navigator.clipboard.writeText` under secure contexts and an offscreen `<textarea>` `document.execCommand('copy')` fallback for insecure HTTP contexts (e.g. LAN IP `http://172.16.3.215:1947`).
- 2026-10-27T14:18:00+05:30: Updated `ReferenceBadge.tsx` to use `copyToClipboard`, removed container-level `select-none`, marked badge ID text as `select-text`, and enabled container-level click-to-copy when no custom `onClick` handler is attached.
- 2026-10-27T14:18:30+05:30: Updated `Tickets.tsx`, `AiProcessing.tsx`, and `KnowledgeBase.tsx` to route all clipboard write operations through the universal `copyToClipboard` helper.
- 2026-10-27T14:20:20+05:30: Verified clean TypeScript validation (`pnpm tsc --noEmit`) and compiled production bundle (`pnpm run build` completed in 9.59s).
- 2026-10-27T14:21:27+05:30: Ran backend unit tests via docker api container — 6/6 tests passed in 2.83s.


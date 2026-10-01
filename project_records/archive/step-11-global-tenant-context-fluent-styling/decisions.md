# Decision: Centralizing Multi-Tenant Client State and Unifying Fluent Card Tokens

## Context
Previously, each page (`Dashboard`, `Inbox`, `Drafts`, `Tickets`, `KnowledgeBase`, `PayloadConfig`, `LlmAnalytics`) maintained its own local `selectedClientId` state and ran a duplicate `useEffect` to fetch `api.getAllEmailAccounts()`. This caused several major defects:
1. Switching the active client on one page did not persist when navigating to another page, forcing the admin to re-select the client repeatedly.
2. Code duplication across 7+ components fetching the same client accounts list.
3. Inconsistent UI headers, where pages had varying ad-hoc dropdowns, banners, and discordant styles (`bg-white/5` vs `win11-card`).

## Options Considered
1. **Keep per-page client dropdowns but sync them via URL query parameters (`?client_id=...`)**:
   - *Pros*: Sharable URLs.
   - *Cons*: Clutters every route; still leaves duplicate selector UI on every single view; requires boilerplate routing synchronization on each page.
2. **Elevate client state to `AppStateContext` and render a single global tenant selector in `Topbar.tsx`**:
   - *Pros*: Complete deduplication of client loading logic; single persistent tenant selection across all routes (persisted in `localStorage`); cleans up page header real estate across all 7 views.
   - *Cons*: Requires updating all consuming pages to use `useAppState()`.

## Chosen Approach
Option 2: Elevate `selectedClientId`, `setSelectedClientId`, `clients`, and `refreshClients` to `AppStateContext`. Display a single unified client selector in `Topbar.tsx` for admin users. Each page now cleanly consumes `selectedClientId` from `useAppState()` without local state management or redundant API calls. Standardize KPI and filter styling on `Tickets.tsx` to `.win11-card`.

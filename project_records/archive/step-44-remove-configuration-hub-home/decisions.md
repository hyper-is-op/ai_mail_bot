# Decision: Remove Legacy Configuration Hub (/home)

## Problem Statement
The user explicitly instructed to delete `Configuration Hub` (`/home`). It created confusion because its contents (read-only summaries of mailboxes, connectors, master bot toggles, and RAG document counts) overlapped with dedicated, interactive pages like `/settings`, `/accounts`, and `/dashboard`.

## Solution
- Delete `frontend/src/pages/Home.tsx`.
- Remove `/home` route from `frontend/src/App.tsx`.
- Remove `/home` link from `Topbar.tsx` profile dropdown and search list.
- If `/home` is accessed, redirect to `/dashboard`.

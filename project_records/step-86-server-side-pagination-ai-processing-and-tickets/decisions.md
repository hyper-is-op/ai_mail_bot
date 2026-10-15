# Step 86 Decisions: Server-Side Pagination for AI Processing and Tickets

## Problem Statement
AI Processing (`/ai-processing`) and Tickets (`/tickets`) previously pulled unpaginated records, loading all rows in-memory. As message volume scales, querying all rows degrades database performance and UI rendering latency.

## Options Considered

### Option A: Pure Frontend Client-Side Pagination
- **Pros**: Zero backend modifications needed.
- **Cons**: Still fetches 100% of rows over the network, failing to address database query load, network payload size, or scalability as volume grows past thousands of rows.

### Option B: Unified Server-Side Pagination with Backward Compatibility (Chosen)
- **Pros**:
  1. Offloads row filtering and limiting to Postgres `LIMIT %s OFFSET %s`.
  2. Computes total counts, pages, and KPI metrics on the server.
  3. Returns a structured `{ items, total, page, page_size, total_pages, metrics }` envelope when `page` parameter is supplied, while preserving raw array returns when `page is None` so existing unpaginated consumers (like `Inbox.tsx` and `Dashboard.tsx`) remain 100% functional without breaking changes.
  4. Delivers unified UI controls (25 / 50 / 100 rows per page, record counter, Previous / Next controls) on both pages.
- **Cons**: Requires coordinating query parameters between FastAPI endpoints and React query state.

# Decisions: Step 105 - Inbox Universal Search Expansion

## Problem
In `http://172.16.3.215:1947/inbox`, the search input under "Mail (Monitor/Control)" only matched:
- `thread.sender`
- `thread.subject`
- `email.preview`
- `email.reply`

Searching by:
1. **Ticket ID** (e.g. `TK-101`) returned 0 results.
2. **Thread ID** (e.g. `th_9479...`) returned 0 results.
3. **Mail Log ID / Email ID** (e.g. `123` or `#123`) returned 0 results unless the digit existed in the body text.
4. Furthermore, the backend endpoint `GET /emails/{client_id}` in `app/api/emails.py` did not join or project `ticket_id` into the unpaginated inbox items.

## Chosen Solution
1. **Enrich Backend `GET /emails/{client_id}` in `app/api/emails.py`**:
   - `LEFT JOIN ticket_record` so each email log row carries correlated `ticket_id`.
   - Include `"ticket_id": r[17]` in the returned dictionary for each email log item.
2. **Expand Inbox Search Predicate in `frontend/src/pages/Inbox.tsx`**:
   - For all standard tabs: match `query` against `thread.sender`, `thread.subject`, `email.preview`, `email.reply`, `email.body`, `email.ticket_id`, `email.thread_id`, `String(email.id)`, and `#${email.id}`.
   - For Paused and Blocked tabs: also include `String(item.id)` and `#${item.id}`.
3. **Update Search Input Placeholder in `frontend/src/components/inbox/InboxSidebar.tsx`**:
   - Provide clear placeholder `"Search by subject, email, content, #ID, thread, or ticket..."` to reflect supported search criteria.

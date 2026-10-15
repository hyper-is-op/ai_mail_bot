# Decisions: Step 77 - Multi-Column Report Search and Filtering

## Decision: Comprehensive 13-Column Search & Filtering Engine in Reports

### Context
In the Ticketing & Resolution Audit Reports view (`/reports`), the search box previously only queried `e.subject`, `e.from_email`, `e.summary`, and `e.body`. When users searched for other visible columns—such as numeric ID `#123`, Thread ID `th_...`, Ticket ID, timestamps/dates, technical intent, resolution mode (RAG Deflected, Ticket Escalated), status (Resolved, Escalated, Under Review), escalation reasons (`kb_miss`), turns count, confidence score, sentiment shift (`Delighted`, `Neutral`), sentiment scores, or estimated costs—the query returned zero or incomplete results.

### Options Considered
1. **Option A (Chosen): Full Multi-Column Search with Field Selector Dropdown & Universal Search Fallback**
   - Provide a Column Scope selector in the search UI with options: `All Columns (Universal)`, `ID / Thread`, `Timestamp`, `Customer Email`, `Subject & Summary`, `Intent`, `Resolution Mode`, `Status`, `Escalation Reason`, `Turns`, `Score`, `Sentiment Shift`, `Sentiment Score`, and `Est. Cost`.
   - Update `_build_report_conditions` in `app/api/analytics.py` to evaluate the targeted column, or when "All Columns" is selected, search across all 13 columns simultaneously.
   - Join pre-aggregated turns (`tc`) and costs (`lc`) in the count query to avoid missing column reference errors during pagination and summary metric calculations.
   - Propagate `search_field` across both paginated JSON (`/reports/ticketing/{client_id}`) and streaming CSV export (`/reports/export/{client_id}`).
2. **Option B: Pure Client-Side Filtering**
   - Rejected. Because reports are paginated on the server across thousands of email interactions, filtering strictly in the browser only affects the current 25 rows on screen, giving misleading KPI sums and incorrect pagination counts.

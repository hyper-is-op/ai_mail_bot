# Step 84: Decisions - Add ID and Thread Columns to AI Processing

## Technical Choices

1. **Surfacing Mail Log ID and Thread ID via `ReferenceBadge`**
   - *Problem*: In `http://localhost:1947/ai-processing`, each processed email was listed without its primary message log ID (`email_logs.id`) or conversation thread identifier (`thread_id`), making cross-referencing between Mail Monitor, Tickets, and Reports tedious.
   - *Solution*: Deployed the reusable `ReferenceBadge` component (`type="message"` with `#` prefix for Mail ID, and `type="thread"` with `th_...` styling for Thread ID). Both badges support 1-click clipboard copy with animated visual feedback.

2. **Full Trace Multi-Field Search Expansion**
   - *Problem*: Search in AI Processing previously only matched sender, subject, category, and preview text.
   - *Solution*: Updated filter logic in `filteredLogs` to match against `log.id` (with or without `#` prefix) and `log.thread_id`, as well as `intent`.

3. **Drawer Inspection Metadata Strip & Step 1 Enrichment**
   - *Problem*: Inspecting a trace did not highlight the thread ID or allow easily copying the mail log ID.
   - *Solution*: Added Mail ID and Thread ID badges to the drawer header, expanded the `pipeline` summary grid to 4 cards (Mail ID, Thread ID, Sentiment, Confidence), and added a dedicated metadata strip to the `payload` tab.

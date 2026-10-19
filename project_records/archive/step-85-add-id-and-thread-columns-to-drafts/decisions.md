# Step 85: Decisions

## Decision 1: Resolving and Schema Storage for Thread ID in Drafts
- **Options Considered**:
  1. Only query `email_logs.thread_id` dynamically via `LEFT JOIN` without altering `draft_emails` schema.
  2. Alter `draft_emails` to add `thread_id VARCHAR(255)`, backfill existing rows from `email_logs`, and query using `COALESCE(d.thread_id, e.thread_id)`.
- **Reasoning**:
  Option 2 guarantees both backward compatibility for historical drafts and standalone durability for future drafts created independently or through pipelines without requiring complex join dependencies everywhere.

## Decision 2: Display Format for Drafts ID Column
- **Options Considered**:
  1. Only show Draft ID (`#<draft.id>`).
  2. Only show Mail Log ID (`#<draft.email_log_id>`).
  3. Show Mail ID (`#<email_log_id ?? draft.id>`) via `ReferenceBadge` with `Draft #<id>` subtext.
- **Reasoning**:
  Option 3 provides complete clarity for operators. When investigating an email across Mail Monitor, AI Processing, Tickets, and Drafts, the primary identifier is the message/log ID, while the internal Draft ID remains clearly visible and distinguishable.

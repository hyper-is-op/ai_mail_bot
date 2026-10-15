# Step 83: Decisions - Ticket Customer Email, Thread ID, and Intent Architecture

## Technical Choices

1. **Customer Email Resolution via `email_logs` Join**
   - *Problem*: `ticket_record.mail_id` previously stored the RFC 2822 Message-ID (e.g., `<CAOSZpAa...gmail.com>`) or internal identifier (`msg-275...`), causing the Tickets table to display raw message header strings as the "Customer Email".
   - *Solution*: In `get_tickets_logs_endpoint` (`app/api/emails.py`), join `ticket_record` with `email_logs` on `t.mail_id = e.message_id OR (t.thread_id = e.thread_id AND t.thread_id IS NOT NULL) OR t.mail_id = CONCAT('msg-', e.id)` to extract genuine `e.from_email`, `e.id`, and `e.thread_id`.

2. **Presentation of ID, Thread ID, and Intent in Tickets UI**
   - *Table Layout*:
     - Column 1: `Ticket / ID` (`ReferenceBadge` for ticket ID, plus small `#<email_log_id>` message badge).
     - Column 2: `Thread ID` (`ReferenceBadge` with click-to-copy).
     - Column 3: `Customer Email` (clean, verified `customer_email`).
     - Column 4: `Subject`.
     - Column 5: `Intent` (pill badge e.g. `order_tracking`, `technical_issue`).
     - Column 6: `Priority`.
     - Column 7: `Sentiment`.
     - Column 8: `Status`.
     - Column 9: `Created At`.
     - Column 10: `Action`.
   - *Drawer Inspection*:
     - Render `Ticket ID`, `Thread ID`, `Email ID`, and `Intent` badges in the details metadata grid.

# Step 81: Decisions - Mail Monitor Identifier Placement

## Technical Choices

1. **Selective Placement (Conversation Pane Only) vs. Universal Badging**
   - *Options Considered*:
     - A: Place thread ID badges on all sidebar thread cards in addition to the detail pane.
     - B: Place thread ID badge in conversation header and message ID badge in message bubbles only; omit from compact sidebar cards.
   - *Choice*: Option B. Prevents visual noise and vertical stretching in narrow sidebar cards (~340px) while surfacing identification exactly where operators take action or perform debugging.

2. **Backend Query Expansion**
   - *Choice*: Add `thread_id` to the `SELECT` projection in `get_emails_logs_endpoint` (`app/api/emails.py`) to provide live thread continuity data to the frontend.

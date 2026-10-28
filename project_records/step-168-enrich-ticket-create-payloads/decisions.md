# Decisions - Step 168: Enrich Ticket Create Payloads

- **Context-Level Priority Normalization**:
  - *Context*: Zendesk expects lowercase string priority (`urgent`, `high`, `normal`, `low`) while Freshdesk expects numeric integers (`1`=Low, `2`=Medium, `3`=High, `4`=Urgent), while our system uses titlecase strings (`Critical`, `Urgent`, `High`, `Medium`, `Low`).
  - *Choice*: Compute both `priority_lower` and `priority_num` deterministically inside `build_context_data_base()`. This keeps templates simple and prevents needing complex template logic or custom Jinja.

- **Name Splitting Strategy**:
  - *Context*: Zoho Desk requires `lastName` and optionally `firstName`. Shoving the full name into `lastName` breaks downstream greetings and CRM reporting.
  - *Choice*: Split `customer_name` by whitespace into `first_name` and `last_name`. If a user has only one name (e.g. `"John"`), set `first_name="John"` and `last_name="Customer"` to satisfy mandatory `lastName` API constraints cleanly.

- **Non-Breaking Schema Extension**:
  - *Context*: Existing templates use `{{customer_name}}` and `{{priority}}`.
  - *Choice*: Retain all existing context keys unchanged. The new keys (`{{first_name}}`, `{{last_name}}`, `{{thread_id}}`, `{{priority_lower}}`, `{{priority_num}}`) are additive.

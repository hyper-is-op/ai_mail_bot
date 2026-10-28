# Decisions - Step 169: Fix Ticket Payload Gaps

- **Sender Name Precedence**:
  - *Context*: Emails often have display names in `From: "Dr. Jane Doe" <jdoe@company.com>` which Mail AI stores in `ctx.sender_name`. Currently, `build_context_data_base()` ignores `sender_name` and splits the email username `jdoe` into `firstName="Jdoe", lastName="Customer"`.
  - *Choice*: Accept optional `customer_name: Optional[str] = None` in `build_context_data_base()`. If passed and non-empty, use it as primary source for name splitting; otherwise fallback to extracting from email.

- **Name Fallback Remediation**:
  - *Context*: If `from_email` is empty or lacks an identifiable name, `extract_name_from_email` returns `"Customer"`. The previous splitting logic matched `len(name_parts) == 1`, resulting in `firstName="Customer", lastName="Customer"`, leaving `"Valued", "Customer"` as dead code.
  - *Choice*: If the extracted/provided name is empty or matches `"customer"` (case-insensitive), set `first_name="Valued"`, `last_name="Customer"`, and `customer_name="Valued Customer"`.

- **Zendesk Thread ID Linking**:
  - *Context*: Zendesk API v2 supports `ticket.external_id` as a native, first-class string field.
  - *Choice*: Add `"external_id": "{{thread_id}}"` to `zendesk_ticket_create` request template so tickets created in Zendesk are automatically indexed with the conversation thread in Mail AI.

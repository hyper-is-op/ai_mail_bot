# Step 154: Preserve Exact Email Thread Continuity - Technical Decisions

## 1. Subject Mutation vs Strict Thread Continuity in Gmail
- **Options Considered**:
  1. Continue appending `[Ticket #<id>]` to the email subject.
  2. Stop mutating the subject line on ticket escalation replies, emitting strictly `Re: <original_subject>`, and retaining the ticket ID in the email body and headers.
- **Decision**: Option 2.
- **Reasoning**: Gmail's threading algorithm enforces that conversation subjects must match identically. Mutating the subject by appending `[Ticket #...]` forces Gmail to split the ticket confirmation into a separate conversation thread in the recipient's inbox. Emitting an unmutated subject guarantees 100% thread continuity in Gmail, Outlook, Apple Mail, and Thunderbird.

## 2. RFC 5322 References Chaining
- **Options Considered**:
  1. Set `message["References"] = in_reply_to` only.
  2. Accumulate prior message references: `message["References"] = f"{existing_references} {in_reply_to}".strip()`.
- **Decision**: Option 2.
- **Reasoning**: RFC 5322 section 3.6.4 specifies that the `References` header should contain the cumulative chain of parent message identifiers in chronological order. Chaining the full lineage ensures robust multi-turn threading across all mail user agents.

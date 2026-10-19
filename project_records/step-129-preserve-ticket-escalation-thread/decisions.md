# Architectural Decisions: Email Thread Continuity on Ticket Escalation

## Problem
In `create_ticket_and_reply` (`app/pipeline/dispatcher.py`), when dispatching the ticket confirmation reply, the subject was hardcoded to:
```python
subject=f"Ticket Update: {outgoing_ticket_id}"
```
This produced an outbound subject like `Re: Ticket Update: 275424000000599999`, dropping the customer's original subject (e.g. `Need help with dialer crash`).

Although SMTP headers `In-Reply-To` and `References` were set:
1. Microsoft Outlook and Office 365 group email conversations based on `Conversation-Topic` (the normalized subject). A complete change in subject breaks Outlook's thread tracking and forks the confirmation into a new, separate conversation.
2. Apple Mail and Thunderbird frequently break threads or display detached messages when subject lines diverge.
3. Customer experience degrades when the context of their original subject line disappears from their inbox.

## Decision
1. In `app/pipeline/dispatcher.py`, normalize the thread subject from `data.get("subject")` or `effective_subject`.
2. Clean leading `Re:` / `Fwd:` prefixes to prevent redundant repetition when appending tags.
3. If the normalized subject does not already contain the ticket ID, append ` [Ticket #{outgoing_ticket_id}]`.
4. Pass this consolidated subject into `dispatch_or_draft_reply`, where standard `Re: ` prefixing and `In-Reply-To` / `References` headers are applied.
5. If the original subject was generic/empty (e.g. `Support Request`, `No Subject`), keep `[Ticket #{outgoing_ticket_id}]` as the identifier.

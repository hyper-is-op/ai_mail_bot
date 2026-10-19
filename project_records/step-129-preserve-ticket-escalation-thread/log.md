# Step 129: Preserve Thread Subject & Continuity on Ticket Escalation Reply

## Timestamp: 2026-10-16T15:42:00+05:30

## Objective
Ensure ticket creation confirmation emails stay strictly inside the customer's existing email thread across all email clients (especially Microsoft Outlook, Office 365, Apple Mail, and Thunderbird):
1. In `app/pipeline/dispatcher.py`, preserve the customer's original subject line rather than replacing it with `Ticket Update: <ticket_id>`.
2. Format the outbound subject as `Re: <original_subject> [Ticket #<ticket_id>]` (or simply `Re: <original_subject>` if the ticket ID is already present).
3. Preserve `In-Reply-To` and `References` headers referencing `message_id`.
4. Validate that email clients receive consistent subject and headers to maintain single-thread continuity.
5. Verify 100% pass on unit regression tests.

## Execution
1. Updated `app/pipeline/dispatcher.py`:
   - Extracted `raw_subj` from `data.get("subject")` or `effective_subject`.
   - Cleaned any leading `Re:` / `Fwd:` prefixes via regex (`re.sub(r"^(?:re\s*:\s*|fwd\s*:\s*)+", "", raw_subj, flags=re.IGNORECASE).strip()`).
   - Appended ` [Ticket #{outgoing_ticket_id}]` if not already present.
   - Forwarded `thread_subject` to `dispatch_or_draft_reply`, ensuring `Re: ` is prepended without duplication and `In-Reply-To` / `References` headers are bound to the incoming `message_id`.
2. Authored automated unit test suite `tests/test_ticket_threading.py` (`TestTicketThreading`):
   - `test_original_subject_preserved_with_ticket_tag`: Verified `subject` is formatted as `Re: CZ dialer server crash in production [Ticket #275424000000599999]` and `in_reply_to` header matches `<msg-unique-123@telecom.com>`.
   - `test_existing_re_prefix_cleanly_handled_without_duplication`: Verified multiple `Re: Re: ` prefixes are stripped to avoid duplicate prefixes.
   - `test_no_duplicate_ticket_tag_if_already_present`: Verified existing ticket ID tags in subject are not duplicated.
3. Executed full test suite inside `mail_ai_worker`:
   - `python -m unittest discover tests` -> **120/120 tests passed** in 14.423s.


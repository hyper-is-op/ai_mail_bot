# Step 25 Decisions - Fix Dashboard Recent Emails Field Mapping

## Context & Rationale
On the Dashboard's Live Inbound Processing Stream table, the sender column displayed "Unknown Sender". Inspection of `/app/api/emails.py` revealed that the backend returns the email sender under the dictionary key `sender` (e.g. `{"sender": r[1]}`), whereas the frontend was reading `item.from_email`.

## Changes Made
- Updated field mapping in `Dashboard.tsx` to read `item.sender || item.from_email || item.from || 'Direct Message'`.
- Updated time field to read `item.time || item.created_at`.

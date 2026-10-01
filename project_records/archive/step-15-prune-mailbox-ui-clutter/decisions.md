# Decisions: Step 15 - Prune Redundant UI Clutter from Client Mailboxes Page

## 1. Removal of Non-Functional / Demo Setting Rows
- **Problem**: In [EmailAccounts.tsx](file:///home/hyper_is_op/mail_ai_automation/frontend/src/pages/EmailAccounts.tsx), under "Registered Mailboxes & Protocols", there were two static placeholder rows:
  - "OAuth2 & Google Workspace Security": Only triggered an informational toast alert ("OAuth2 handshake verified with fallback IMAP") with no actionable controls.
  - "Ingestion Rate Limiting & Queue Buffer": Only triggered an informational toast alert ("Configured rate limit: SENDER_HOURLY_RATE_LIMIT = 120/hr.") with no actionable controls.
- **Decision**: Removed both placeholder rows. Only the functional "Client IMAP Mailboxes & Credentials" row and the functional expandable client credential cards remain, eliminating fake UI clutter and keeping the focus on actual mailbox configuration.

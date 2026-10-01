# Decisions: Step 14 - Align Mailbox Accounts UI with Single-Mailbox Architecture

## 1. Client-to-Mailbox 1:1 Explicit Representation
- **Problem**: The UI previously had generic "Add mailbox account" and "Add account" buttons with a free-text `Client ID` field. This gave users the impression that:
  1. Multiple mailboxes could be added to one client account.
  2. Mailbox accounts could be created independently of client records without onboarding a user.
  In reality, entering an existing `client_id` silently overwritten the client's single registered mailbox in `email_accounts`.
- **Options Considered**:
  - *Option A*: Change backend schema immediately to support 1:N mailboxes per client. (Out of scope, requires database migration, altering imap_reader loops, credential service caching, and logging schemas).
  - *Option B*: Redesign the frontend UI in [EmailAccounts.tsx](file:///home/hyper_is_op/mail_ai_automation/frontend/src/pages/EmailAccounts.tsx) to clearly indicate the 1:1 relationship, change "+ Add mailbox account" to "+ Connect Client Mailbox", provide a client dropdown selector showing existing mailbox attachment status, and document that updating a client's mailbox replaces credentials.
- **Decision**: Implemented Option B.

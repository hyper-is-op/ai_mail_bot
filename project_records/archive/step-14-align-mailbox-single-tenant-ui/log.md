# Log: Step 14 - Align Mailbox Accounts UI with Single-Mailbox Architecture

- 2026-09-28T12:35:00+05:30: Initiated task to clarify 1:1 client-to-mailbox constraints in EmailAccounts UI.
- 2026-09-28T12:40:23+05:30: Replaced misleading "Add mailbox account" / "Add account" terminology with "Connect Client Mailbox".
- 2026-09-28T12:40:41+05:30: Updated the modal in `EmailAccounts.tsx` to provide an explicit client selection dropdown showing existing mailbox status, clear guidance explaining that each client account binds to 1 IMAP mailbox, and added a quick link to client onboarding.
- 2026-09-28T12:41:15+05:30: Refined page title and description to "Client Mailboxes & Listeners".
- 2026-09-28T12:42:01+05:30: Verified clean TypeScript build (`tsc && vite build` exited with code 0).

# Log: Step 76 - Fix Admin Mailbox Credentials Display

- 2026-10-08T15:21:00+05:30: Identified root causes in GET /email-accounts: (1) SQL aliased user login email (u.email) as 'email' instead of actual mailbox address (ea.email), and (2) returned raw Fernet encrypted ciphertext for password instead of decrypting via _decrypt_imap_password.
- 2026-10-08T15:21:22+05:30: Patched get_all_email_accounts_endpoint in app/api/connectors.py to query COALESCE(ea.email, '') AS email, preserve u.email AS login_email, and decrypt passwords using _decrypt_imap_password.
- 2026-10-08T15:21:40+05:30: Updated frontend/src/pages/EmailAccounts.tsx to display login email badge next to client ID while showing accurate IMAP mailbox address.
- 2026-10-08T15:22:15+05:30: Ran frontend build verification via pnpm run build (passed cleanly in 11.07s).
- 2026-10-08T15:23:03+05:30: Aligned test_14 assertion with Step 73 UTC timestamp header and executed full backend test suite in docker (91/91 passed in 14.31s).
- 2026-10-08T15:23:32+05:30: Verified live GET /email-accounts returns authentic IMAP address and decrypted App Password for client accounts.

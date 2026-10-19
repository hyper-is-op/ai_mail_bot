# Decisions: Step 76 - Fix Admin Mailbox Credentials Display

## Decision: Return Authentic IMAP Address and Decrypted App Password in GET /email-accounts

### Context
When administrators viewed the MailBox Account configuration section (`/email-accounts`), each client row displayed the client user's web login email (from the `users` table) instead of the configured IMAP address (from the `email_accounts` table). Additionally, the IMAP App Password showed the raw Fernet encrypted ciphertext (`gAAAAAB...`) instead of the decrypted 16-character Google App Password.

### Options Considered
1. **Option A (Chosen): Fix Backend Endpoint Query & Decryption Pipeline**
   - In `app/api/connectors.py`:
     - Select `COALESCE(ea.email, '') AS email` and `COALESCE(ea.email, '') AS imap_email` for IMAP address.
     - Select `u.email AS login_email` so the dashboard user login email is preserved for management views.
     - Decrypt `password` in Python using `_decrypt_imap_password(raw_pw, client_id=cid)`.
   - In `frontend/src/pages/EmailAccounts.tsx`:
     - Render `acc.email` as the true IMAP address and populate the editor fields with decrypted `acc.password`.
     - Display `acc.login_email` as a secondary descriptor so admins can distinguish portal user login from support IMAP mailboxes.
2. **Option B: Decrypt on Frontend**
   - Rejected. The frontend does not and should not hold cryptographic master keys (Fernet) for decryption. Decryption belongs on the authenticated backend.

# Technical Decisions - Step 68

## 1. Alert Settings Persistence for Unconnected Tenants
- **Choice**: When `UPDATE email_accounts` updates 0 rows and the client has no existing record, execute an `INSERT INTO email_accounts` with stub credentials (`alerts-{client_id}@internal.system`).
- **Alternatives Considered**: Reject request with 400 asking user to connect IMAP first, or store alerts in a separate table.
- **Reasoning**: A separate table would require a new table migration and break schema normalization across accounts. Rejecting with 400 impairs user experience by forcing operators to configure IMAP credentials before setting up monitoring webhooks. Inserting a stub record guarantees persistence while seamlessly allowing `save_email_account` to populate real credentials later without overwriting webhook configs.

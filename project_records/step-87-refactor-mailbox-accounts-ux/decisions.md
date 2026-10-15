# Step 87: Decisions - Refactor Mailbox Accounts UX

## Context
The `/accounts` (Client Mailboxes) view had a global "+ Connect Mailbox" button on the top right that opened a flyout modal allowing users to enter a Client ID or select one from a dropdown and input IMAP credentials.

## Problems Identified
1. **Domain Mismatch:** In the database (`email_accounts`), `client_id` has a unique constraint (`UNIQUE KEY uk_client_id`). One client holds at most one primary mailbox.
2. **Accidental Credential Overwrite:** Selecting an existing client with a configured mailbox in the modal silently overwrote production IMAP credentials with no overwrite warning.
3. **Orphan Records:** Submitting a custom Client ID created an orphan row in `email_accounts` which was invisible in queries relying on `users LEFT JOIN email_accounts`.
4. **Duplicate UI Flows:** The page already contained expandable inline cards for every tenant.

## Decisions Made
1. **Remove the "+ Connect Mailbox" Modal:** Eliminated the modal dialog, state variables, and header button.
2. **Contextual Action per Row:**
   - Unconfigured clients now show an explicit "Connect" button directly next to their "Unconfigured" badge in the row action slot.
   - Clicking "Connect" expands the inline credential form for that specific client.
3. **Segmented Status Filter Tabs:**
   - Added filter tabs: `All (${count})`, `Connected (${count})`, and `Unconfigured (${count})`.
   - Allows administrators to immediately isolate clients lacking IMAP configuration without scanning through the entire list.
4. **Direct Tenant Management Navigation:**
   - Added a "Manage Clients" header action linking to `/admin/clients` so admins can create new client tenants through the authoritative entity management screen.

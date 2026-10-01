# Decisions - Step 19

## Decision 1: Remove Top Hardware Boxes & Intermediate Protocol Card
- **Context**: The `EmailAccounts` view displayed a 4-column grid of square cards showing up to 3 client mailboxes plus a dashed box, followed by a "Registered Mailboxes & Protocols" card with a single action row, before finally displaying the full list of mailboxes under "Configured Mailbox Credentials".
- **Problem**: The top cards were superficial duplicates of the mailbox rows below them. The intermediate card was an empty wrapper holding only a search input and duplicate "Connect mailbox" button. This forced users to scroll past redundant containers to reach their actual configuration drawers.
- **Choice**: Remove both redundant sections. Move the "+ Connect Mailbox" primary action to the page header next to the Refresh button. Place the live search input in the header action of the "Configured Mailbox Credentials" card.
- **Result**: A clean, single-purpose interface where users can immediately view, search, and edit credentials for every client mailbox.

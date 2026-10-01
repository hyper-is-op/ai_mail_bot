# Decisions - Step 16

## Decision 1: Remove "Incoming Mailbox Stream Listener" Master Toggle
- **Context**: The `EmailAccounts` view displayed a Windows 11 style toggle card titled "Incoming Mailbox Stream Listener" claiming to control background polling of mailboxes every 15 seconds.
- **Investigation**: The component bound this solely to local React state (`useState(true)`). It never communicated with any backend API. The background IMAP worker (`worker/imap_reader.py`) executes continuously inside the Docker container `mail_worker` via Celery.
- **Options Considered**:
  1. Build a new daemon process control system in FastAPI and Docker/Celery to actually pause the Celery reader task.
  2. Remove the toggle completely from the UI.
- **Choice**: Option 2. Process orchestration for backend worker containers belongs in infrastructure/system operations, or in Settings under the existing Master Bot Kill Switch which already properly gates email ingestion processing. Having a mock switch in the mailbox view is deceptive and leads users to believe background polling stopped when it did not.

## Decision 2: Remove the 3-Dots Button on Mailbox Cards
- **Context**: The top entity cards contained a `<button>` with `<MoreVertical>` icon in the top right corner.
- **Investigation**: Clicking the button called `openEditDrawer(acc.client_id)`, identical to the primary action button on the card.
- **Options Considered**:
  1. Build a full context menu with additional options.
  2. Remove the button.
- **Choice**: Option 2. There are no secondary mailbox actions needed that aren't already handled by "Configure" or "Connect & Edit". Removing the button reduces clutter and confusion.

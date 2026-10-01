# Decisions: Step 07 - Accounts Page Windows 11 Template B Redesign

## 1. Application of Template B to Mailbox Accounts
- **Choice**: Structure `/accounts` matching Windows 11 "Bluetooth & devices" (Screenshots 2 & 5):
  - Top paired entity cards: Each connected mailbox (`client_id`, `email`) rendered as a distinct hardware-style card with an icon, connection status (IMAP/SMTP SSL), a "Test & Sync" button, and an options `...` dropdown menu.
  - An authentic `[+] Add Mailbox Account` card at the end of the top row.
  - A Master Ingestion Switch card ("Mailbox Listening Stream: Active [Off/On toggle]").
  - Grouped settings expander rows below for IMAP Ports & Protocols, OAuth2 App Passwords, and Sync Rate Limiting.
- **Reasoning**: This gives connected email inboxes the exact hardware-device visual identity seen in the Windows 11 Settings app, establishing parity with all three screenshot archetypes while preserving full CRUD and connection testing functionality.

# Decision: Real Operational System Alert Center vs Raw Email Mirror

## Problem Statement
The Topbar notification bell previously retrieved the 5 most recent emails via `api.getEmails(user.client_id)` and labelled them as notifications. This had 4 critical flaws:
1. Multi-tenant blindness: `selectedClientId` was completely ignored; Admins saw nothing or stale client data.
2. Misleading domain model: Normal inbound customer emails were masquerading as system notifications, while real operational incidents (LLM budget breaches, IMAP worker disconnections, webhook failures, failed delivery alerts) were never surfaced.
3. Volatile read state: Stored purely in ephemeral localStorage (`read_notif_ids`), resetting across browsers or sessions.
4. Deep link misdirection: Clicking an item navigated to `/inbox` without switching active client or sub-tabs, frequently failing to load the item.

## Chosen Solution
Implement a dedicated `/notifications/{client_id}` operational alert engine:
- Aggregates real operational telemetry:
  1. **LLM Budget Quota Warnings**: Alerts when client or system LLM spend crosses >=90% (Warning) or >=100% (Critical) of configured monthly quota.
  2. **Worker Daemon & Mailbox Heartbeat**: Stalls or offline IMAP sync alerts if last heartbeat exceeds tolerance.
  3. **Actionable Pipeline Failures**: Unresolved email processing errors (`failed`, `send_failed`, `ticket_creation_failed`) requiring attention, with deep-links to `/inbox?tab=failed`.
  4. **Human Review Backlog**: Real-time counter of replies awaiting human authorization (`pending_manual_review`) deep-linking to `/inbox?tab=pending`.
  5. **Critical / Urgent Sentiment Inbound Escalations**: High-priority negative sentiment customer emails needing immediate operator intervention.
- Frontend binds to `selectedClientId` from `useAppState()` for instant tenant reactivity.
- Persistent read tracking across session keys and direct deep-linking with appropriate query parameters.

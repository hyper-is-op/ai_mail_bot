# Mail AI Automation — Client-Side Workflow Specification

This document describes the complete client-facing workflow: how an incoming customer email is received, processed, and responded to, and what actions a client (not an admin) can take to configure, monitor, and intervene in that pipeline. Admin-only capabilities (approving connector configs, managing global caps, cross-client views, LLM provider configuration) are intentionally out of scope.

---

## 1. Client Onboarding & Account Setup

A client's account is created by an admin (`POST /admin/create-client`), which atomically provisions:
- A login account (`users` table, `role=client`)
- An IMAP/email configuration (`email_accounts` table) — inbox email/password, score threshold, response tone, agent type, department/company name

Once created, the client logs in via `POST /login` and receives a Bearer token used for all subsequent authenticated requests. All client-facing endpoints enforce that a client can only access their own `client_id` — a client cannot view or modify another client's data.

### Client-editable profile settings
`POST /client/profile` — a client may update their own `department_name` and `company_name`.

`POST /accept-email` — a client can (re)configure their inbox email/password, score confidence threshold, and response tone.

---

## 2. Inbound Email Ingestion

Incoming customer emails reach the system in one of two ways:
1. **IMAP polling** — a background listener continuously checks the client's configured inbox for unseen messages.
2. **REST ingestion** — `POST /process-email` accepts a pre-parsed email (`client_id`, `from_email`, `subject`, `body`) and queues it for processing.

Every ingested email is handed to an asynchronous background task (Celery) — the client does not wait for a synchronous reply; the API immediately returns `{"status": "queued"}`.

---

## 3. Processing Pipeline (What Happens To Every Email)

Each email goes through a sequence of checks and routing decisions before a client ever sees an outcome.

### 3.1 Pre-routing checks
- **Duplicate/retry protection** — the same task is never processed twice.
- **Paused sender check** — if the sender's email address is on the client's pause list, the email is captured (see Section 6) and no auto-reply is generated.
- **Blocked keyword check** — if the email's subject/body matches a client-configured blocked keyword, it is routed to a review queue instead of being auto-processed (see Section 7).
- **Intent detection** — an AI step classifies the email's intent (general question vs. ticket/order status inquiry), extracts any ticket/order IDs mentioned, and assesses customer sentiment and priority.
- **Multiple ticket IDs** — if more than one ticket/order ID is detected in a single email, the client's customer is automatically asked to clarify which one they mean; no further processing occurs until they reply.

### 3.2 Path A — Direct Ticket/Order Status Inquiry
Triggered when the email clearly references a specific ticket or order ID.
- The system looks up that ticket's current status via the client's configured connector (see Section 8).
- **If found:** an AI-drafted reply summarizing the ticket status is generated and automatically sent to the customer.
- **If not found:** the customer is sent a polite message asking them to double-check the ticket ID and confirm it in their next reply. The conversation enters a "pending verification" state.

### 3.3 Path B — Knowledge Base Lookup
Triggered for general questions with no specific ticket ID.
- The client's uploaded knowledge base (FAQs, policy documents, etc. — see Section 9) is searched for relevant context.
- If relevant context is found, an AI reply is drafted and **scored** for quality/confidence (0–100).
- **If the score meets or exceeds the client's configured threshold:** the reply is sent automatically.
- **If the score is below threshold, or no relevant knowledge was found:** the reply is discarded and the email escalates to Path C — the customer never sees the low-confidence draft.

### 3.4 Path C — Escalation & Ticket Creation
This path handles everything that couldn't be answered directly or confidently:
- **Follow-up to a "pending verification" conversation:** the system re-attempts the ticket lookup using the ID the customer confirmed. Success → normal status reply. Still not found → the conversation moves to a "verification failed" state.
- **"Verification failed" follow-up:** the system stops trying to match an ID and instead creates a brand-new support ticket from the customer's description, then sends a ticket-created acknowledgment.
- **No ticket ID found anywhere in the conversation:** a new support ticket is created directly, and the customer receives an acknowledgment with the new ticket reference.
- **Ambiguous history (multiple past ticket IDs found in the conversation, unclear which is relevant):** the customer is asked to clarify.

### 3.5 Manual Review Fallback
At several points, automated handling can be intentionally skipped in favor of human review:
- A client-configurable feature flag can disable auto-ticket-creation or auto-send entirely.
- Any failure creating a ticket, sending an email, or evaluating a reply falls back to a "pending manual review" state rather than silently failing.

---

## 4. Client Feature Controls

A client's automation behavior is governed by toggleable feature flags (set via admin, visible to the client):
- **Ticket creation** — whether the system may auto-create tickets.
- **Auto-send** — whether high-confidence replies are sent automatically, or held for manual approval.
- **RAG (knowledge base)** — whether the knowledge-base lookup path is used at all.
- **Order/ticket tracking** — whether ticket-ID detection and status lookups are attempted.
- **Manual reply** — whether manual reply tooling is available.

---

## 5. Reviewing & Managing Processed Emails

`GET /emails/{client_id}` — a client can view a complete, chronological log of every email processed for their account: sender, subject, body, AI-generated reply (if any), confidence score, current status (New / Replied / Ticket Generated / Failed / Pending Review), sentiment, priority, and a step-by-step trace of what the system did with that email.

`GET /tickets/{client_id}` — a client can view every support ticket created on their behalf, with status, priority, sentiment, and timestamps.

`GET /dashboard/stats/{client_id}` — summary statistics: total emails, pending emails, AI replies sent, failed sends, tickets generated, orders tracked, average AI confidence, and a time-series chart, filterable by date range (today, yesterday, this month, last month, custom range).

### Approving a held reply
If a reply was generated but held for manual approval (auto-send disabled, or below-threshold), a client can approve and send it as-is:
`POST /approve-pending-reply` — sends the already-drafted reply exactly as generated.

### Sending a fully custom reply
`POST /manual-reply` — a client can compose and send their own reply text to any customer, bypassing AI generation entirely. This same endpoint is also how a client resolves items sitting in the two review queues below (Sections 6 and 7) — passing the relevant record ID marks that queue item as resolved, but **only if the email actually sends successfully**; a failed send leaves the queue item untouched so nothing is silently lost.

---

## 6. Pausing a Sender & Reviewing Paused History

A client can pause automated handling for a specific customer email address — useful when a human wants to personally manage an ongoing conversation without the AI interjecting.

- `POST /pause-email` — pause a sender (no auto-reply will be generated for any future email from this address).
- `POST /unpause-email` — resume automated handling for that sender.
- `GET /paused-emails/{client_id}` — list currently paused sender addresses.

**Every email received from a paused sender while the pause is active is still captured**, not dropped, so nothing is lost while a human is handling the conversation manually:
- It's logged in the main email log with a `paused` status (visible via `GET /emails/{client_id}`).
- It's also captured in a dedicated **paused-email review queue**, so a client can specifically triage "everything that came in while I had this sender paused" without digging through the general log.

`GET /paused-email-history/{client_id}` — view the paused-email review queue.
- Optional `?status=` filter: `pending_review` (default state, not yet actioned), `ignored` (reviewed, no action needed), or `replied` (handled).
- Optional `?group_by_email=true` — groups results by sender address instead of a flat chronological list.
- Both parameters can be combined.

`PATCH /paused-email-history/{client_id}/{record_id}` — manually mark a queued item as `ignored` (a simple bookkeeping action, does not send anything) — for actually replying and marking as `replied` in one action, use `POST /manual-reply` with `paused_history_record_id` set (see Section 5).

A queue item stays in the history permanently as a record, even after the sender is unpaused — unpausing only stops *new* emails from that sender being added to the queue going forward; it does not clear or archive what's already there.

---

## 7. Blocked Keywords & Their Review Queue

A client can configure a list of keywords that, when matched in an incoming email's subject or body, divert that email away from normal automated processing.

- `POST /blocked-keywords/add` — add a keyword to the client's block list.
- `DELETE /blocked-keywords/{client_id}/{keyword}` — remove one.
- `GET /blocked-keywords/{client_id}` — list current blocked keywords.

### Block policy
A client chooses what happens when a keyword match occurs:
`POST /blocked-keywords/policy` — set policy to either:
- `reply` — the matched email is queued for manual human review (default), or
- `ignore` — the matched email is silently logged and no review action is expected.

`GET /blocked-keywords/policy/{client_id}` — check the current policy.

### Reviewing blocked emails
`GET /blocked-emails/{client_id}` — view the blocked-email review queue, optionally filtered by `?status=` (`pending_review`, `ignored`, `replied`).

`PATCH /blocked-emails/{client_id}/{record_id}` — manually mark one item `ignored` or `replied` (a bookkeeping-only action).

`PATCH /blocked-emails/{client_id}/bulk-ignore` — mark **all** currently pending-review blocked emails as `ignored` in one action, useful for clearing a backlog.

To actually reply to a blocked email (rather than just marking it handled), use `POST /manual-reply` with `blocked_record_id` set — the record is only marked `replied` once the email genuinely sends.

---

## 8. Connecting a CRM / Ticketing System (Connectors)

Instead of the system being hardcoded to one specific CRM, a client connects their own external ticketing/CRM system through a **connector configuration** — a definition of what URL to call, how to authenticate, how to format the outgoing request, and how to interpret the response.

### Creating a connector
`POST /admin/connector-configs` — a client may create a connector config for their account. Required information:
- **Trigger type** — what kind of action this connector handles (e.g. checking order/ticket status, or creating a new ticket).
- **HTTP method & URL** — how to reach the client's CRM endpoint. *(Note: the target URL must be pre-approved on a security allowlist before the connector can go live — this is an admin action.)*
- **Request template** — how to format the outgoing request, using system-provided placeholders (customer email, subject, message body, ticket ID, sentiment, priority, etc.) that get filled in automatically for each email.
- **Response mapping** — how to extract the pieces of information the system needs (e.g. ticket ID, current status) out of whatever shape the CRM's response comes back in.
- **Authentication** — bearer token, basic auth, or an API key (as a header or query parameter). Secrets are encrypted before storage and never exposed back in plain text.

A newly created connector starts in `pending_approval` status — it is **not** used to process real emails until an admin reviews and approves it. This ensures nothing a client configures can silently start making live calls to an external system, or be misused to reach an internal/unintended address, without review.

### Letting AI draft the connector for you
Writing a request template and response mapping by hand requires knowing exactly what placeholders the system supports and how to write response-extraction rules. To make this easier:

`POST /admin/connector-configs/generate-preview` — describe your CRM in plain language (what fields it expects in a request, and what its response looks like — ideally with a real example response), and the system will draft a request template and response mapping for you automatically.

**This is preview-only** — nothing is saved. Review the draft, edit it if needed, and then submit it normally via the create endpoint above to actually save it for approval.

### Updating an existing connector
`POST /admin/connector-configs/regenerate` — submit a replacement configuration for a connector you already have. This creates a *new* pending-approval version; your current live connector keeps working exactly as before, uninterrupted, until the new version is reviewed and approved — there is no downtime or gap in service while an update is under review.

### Viewing your connectors
`GET /admin/connector-configs/{client_id}` — list all of your connector configurations and their current status (draft, pending approval, live, or disabled). Any configuration whose response-extraction rules rely on a regex pattern is specifically flagged for extra reviewer attention.

### What a client cannot do
Approving a connector to go live, or rejecting one, is an **admin-only** action — a client can create and submit configurations, but cannot self-approve them.

---

## 9. Knowledge Base (RAG)

A client can upload reference material — policies, FAQs, product documentation — that the system searches when answering general questions (Path B above).

- `POST /rag/upload` — add a knowledge entry directly (title + text content).
- `POST /rag/upload-file` — upload a PDF, DOC, DOCX, or TXT file; its text is extracted and indexed automatically.
- `GET /rag/documents/{client_id}` — list uploaded knowledge documents.
- `DELETE /rag/documents/{client_id}/{doc_id}` — remove a document.
- `POST /rag/query` / `POST /rag/retrieve` — manually test what the knowledge base would return for a given question, useful for verifying coverage before relying on it in production.

---

## 10. Conversation History

`GET /chat-history/{client_id}/{from_email}` — view the recent conversation thread with a specific customer (last N messages, both customer and system replies).

`DELETE /chat-history/{client_id}/{from_email}` — clear the short-term cached conversation history for a customer. (Note: this clears a fast-access cache only; the permanent ticket-level history record is not affected.)

---

## 11. Real-Time Updates

The client dashboard maintains a live connection (WebSocket) to receive real-time notifications whenever a new email is processed, so the dashboard can refresh without manual polling.

---

## 12. Cost & Usage Visibility

`GET /llm/metrics/{client_id}` — view AI usage statistics: total requests, token usage, cost, average latency, broken down by model and by which part of the pipeline (intent classification, reply drafting, etc.), plus a recent-activity log.

`GET /budget-status/{client_id}` — view current-month AI spend against a configured monthly budget (if one is set by an admin), with status (on track / warning / exceeded). This is informational only — it never blocks processing, even if a budget is exceeded.

---

## Summary: Client Action Reference

| Category | Client Can | Client Cannot |
|---|---|---|
| Account | Update own profile, email config, thresholds | Create/delete accounts, reset others' passwords |
| Emails | View logs, approve/send replies, manual reply | View other clients' emails |
| Pausing | Pause/unpause senders, review paused-email queue | — |
| Blocked keywords | Configure keywords & policy, review queue | — |
| Connectors | Create, edit/regenerate, generate-with-AI, view own | Approve or reject own connectors |
| Knowledge base | Upload, query, delete own documents | — |
| Tickets | View own tickets | — |
| Usage/cost | View own usage & budget status | Set own budget or caps |
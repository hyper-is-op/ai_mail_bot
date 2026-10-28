# Step 162: Harden Email Filters, Clarification Loops, and Threat Escalation - Decisions

## Context
Analysis of current inbound email processing revealed five distinct reliability and operational blind spots:
1. Subdomain heuristic `parts[0] in ("mail", ...)` risks silently dropping corporate emails (e.g. `user@mail.acme.com`).
2. Multi-entity and compound-intent clarification triggers lack turn-awareness, creating infinite ping-pong loops when customers repeat multiple issues.
3. Severe legal and hostile threats are held passively in drafts mislabeled as `RAG_Miss` without supervisor alerts.
4. Blocked keywords lack exception whitelisting, intercepting benign technical terminology.
5. Inbound sender rate-limiting applies a flat 30 emails/hr threshold without tenant-scoped allowlisting.

## Decisions Made

1. **RFC Email Header Ingestion & Hybrid Bulk Detection**:
   - *Decision*: Ingest `Auto-Submitted`, `List-Unsubscribe`, `Precedence`, and `X-Auto-Response-Suppress` in `worker/imap_reader.py`. Pass to `PipelineContext.headers`.
   - *Filter Logic*: Use protocol-level headers (`List-Unsubscribe`, `Precedence: bulk/junk`, `Auto-Submitted`) for 100% deterministic drops. Protect generic corporate subdomains (e.g., `mail.<company>.com`) unless accompanied by promotional prefixes or RFC bulk headers.

2. **Clarification Turn Ceiling & History State Persistence**:
   - *Decision*: Enforce a hard ceiling of 1 clarification turn per interaction. Inspect immediate prior support message in history; if already a clarification, do not ask again.
   - *Entity Fallback*: Prioritize ticket ID over order ID (`ticket_id = ticket_ids[0] if ticket_ids else order_ids[0]`).
   - *Compound Intent Fallback*: Prioritize highest-severity intent (`technical_support` > `ticket_create` > `ticket_status` > `general_query`) and proceed with single-issue support.
   - *Memory Persistence*: Push both the incoming customer message and the outbound clarification reply to Redis (`push_message`) with `meta={"action": "clarification_sent"}` to keep Redis and MySQL in sync.

3. **Active Real-Time Alerting on Hostile / Legal Threats**:
   - *Decision*: Correct log step attribution to `Routed_To_Pending_Review:Hostile_Legal_Threat` (removing incorrect `RAG_Miss` tag).
   - *Telemetry*: When priority is `Critical`/`Urgent` and `escalation_reason == "Hostile_Legal_Threat"`, publish a specialized `LEGAL_ESCALATION_ALERT` event over Redis `email_updates`.

4. **Deterministic Keyword Filter Exceptions**:
   - *Decision*: Add `blocked_keyword_exceptions` table `(client_id, keyword, allowed_phrase)` in `app/db_init.py`.
   - *Matching*: If a blocked keyword matches, check associated allowed phrases in memory. If an exception matches (e.g. `"hackathon"` when `"hack"` is blocked), bypass the block without invoking LLMs.

5. **Tenant-Scoped Rate Limiting Exemptions**:
   - *Decision*: Add `rate_limit_exemptions` table `(client_id, sender_or_domain, reason)` in `app/db_init.py`.
   - *Caching*: Check `ratelimit:exempt:{client_id}` in Redis (300s TTL). If sender or `@domain` is exempt, return `(True, 0)` immediately.

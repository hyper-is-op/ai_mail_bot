# Current System State Snapshot

**Last Updated:** 2026-09-14 17:32 IST  
**Git Commit/Branch:** `master` (All Milestones 1, 2, 3, 4 + Post-Milestone Production Rollout Verified)

---

## 1. System Architecture Overview

```
[Inbound Email (IMAP / REST)] 
       │ (MIME Headers: Message-ID, In-Reply-To, References, X-API-Key / Bearer)
       ▼
[Celery Worker: process_email_task]
       │
       ├─► [Thread Linkage & History Fallback] (RFC-822 Linkage + SQL Reconstitution)
       │
       ├─► [Deterministic Filters] (Bounces, Marketing, Paused, Keywords)
       │
       ├─► [Stateful Diagnostic Agent] (3-Turn Problem Diagnosis + Resolution Detector)
       │         │
       │         ├─► [lookup_order_status] (Shopify / WooCommerce / ERP order lookup)
       │         ├─► [lookup_payment_status] (Stripe / Razorpay / Zoho Books payment lookup)
       │         ├─► [lookup_ticket_status] (Zoho Desk / Freshdesk ticket lookup)
       │         ├─► [search_knowledge_base] (Qdrant RAG + Per-tenant JSON fallback)
       │         └─► [escalate_and_create_ticket] (Triggered only after troubleshooting fails)
       │
       ├─► [Outbox / SMTP / Drafts] (Idempotent delivery)
       │
       └─► [Logging & Notification] (email_logs with thread_id/troubleshooting_step + Redis Pub/Sub)
```

---

## 2. Component Health & Status

| Subsystem | Underlying Technology | Current Status | Capabilities & Hardening |
|---|---|---|---|
| **Queue / Worker** | Celery + Redis (DB 0) | Operational | Fully thread-aware (`resolve_thread_id`), tracks `troubleshooting_step`, runs background outbox sweeper. |
| **Database** | MySQL 8.0 / MariaDB (PyMySQL) | Operational | Schema updated: `message_id`, `in_reply_to`, `thread_id`, `is_resolved`, `troubleshooting_step` indexed. |
| **Vector DB** | Qdrant (`mail_ai_knowledge`) | Hardened | Strict runtime assertions rejecting empty or `"ALL"` tenant searches; physical per-client fallback JSON storage (`chroma_db/fallback_{client_id}.json`). |
| **Credential Crypto** | `app/secrets_crypto.py` (HKDF + Fernet) | Hardened | Tenant-derived Fernet keys via HKDF (`client_id` salt) with legacy master key fallback. |
| **Ingestion Auth** | FastAPI (`app/auth_deps.py`) | Secured | `POST /process-email` protected by API key / webhook secret (`INGESTION_API_KEY`) or Bearer session. |
| **Embeddings** | `embed_service.py` (FastAPI / e5-small) | Operational | 384-dimensional vector embeddings on port 8500. |
| **Connectors & API** | `connector_executor.py` + `dispatch.py` | Operational | Supports `ticket_create`, `ticket_status`, `order_status`, `payment_status`. Dedicated operator REST endpoints (`POST /order-status`, `POST /payment-status`, `POST /ticket-status`). |
| **Chat History** | Redis (DB 1) + SQL Reconstitution | Operational | Redis hot cache backed by full cold-start SQL transcript reconstruction from `email_logs`. |
| **IMAP Listener** | `worker/imap_reader.py` | Operational | Captures RFC-822 `Message-ID`, `In-Reply-To`, and `References`. |
| **Frontend UI** | React + Vite + Tailwind | Operational | Unified multi-system **Status Lookup** workspace with tabbed switching (Orders, Payments, Support Tickets). |

---

## 3. Active Configuration & Environment

- **Database:** MySQL on `mail_ai_mysql:3306` (or localhost)
- **Redis Broker:** `redis://mail_ai_redis:6379/0`
- **Redis Cache/History:** `redis://mail_ai_redis:6379/1`
- **Qdrant:** `http://mail_ai_qdrant:6333`
- **Embedding Service:** `http://mail_ai_embed_service:8500`
- **Ingestion Key:** `INGESTION_API_KEY` configured in `.env`
- **Master Encryption Key:** `CONNECTOR_SECRET_ENCRYPTION_KEY` configured in `.env`
- **Default LLM Provider:** Groq (`qwen/qwen3.6-27b` / `llama-3.3-70b-versatile`)

- **Test Suite Status:** 67/67 unit tests passing (0 failures, 0 errors) — 100% test coverage across all 4 production milestones.

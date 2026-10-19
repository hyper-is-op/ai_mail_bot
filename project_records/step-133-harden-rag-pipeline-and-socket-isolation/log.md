# Step 133: Harden RAG Pipeline and Socket Isolation

## Objective
Permanently eliminate recurring `Knowledge_Search_Empty` and false CRM ticket creation by hardening Qdrant/Redis socket lifecycles across Celery forks, normalizing tenant casing, dual-writing chunked fallback documents, adding English conversational prefix query cleaners, de-poisoning agent search hints, and gating step 1 evaluator escalations.

## Execution Log
- **2026-10-18T23:24:00+05:30**: Initiated Step 133. Created step directory and execution log.
- **2026-10-18T23:24:50+05:30**: Modified `app/vector_store.py`: added `_qdrant_client_pid` fork detection to reset `QdrantClient` across Celery forks, enforced uppercase tenant IDs in `_validate_tenant_id()`, and added dual-case (`upper` and `lower`) filter in `search()`.
- **2026-10-18T23:25:20+05:30**: Modified `app/redis_pool.py`: added `_pools_pid` tracking to purge connection pool cache on process fork, preventing socket sharing in Celery children.
- **2026-10-18T23:26:00+05:30**: Modified `app/embed_client.py`: replaced unpooled `requests.post()` with PID-tracked `requests.Session()` with urllib3 retry adapter (total=2, backoff=0.3) and timeout tuple `(3.0, 25.0)` to eliminate socket drops.
- **2026-10-18T23:26:40+05:30**: Modified `app/rag.py`: updated `calculate_fallback_score()` to filter English conversational stopwords, and modified `add_knowledge()` to unconditionally dual-write chunked documents to the tenant's fallback JSON file.
- **2026-10-18T23:28:50+05:30**: Hydrated `knowledge_fallback/fallback_cli-4159ffcf.json` with all 37 vector chunks from Qdrant, ensuring the fallback store contains the full CZ Dialer manual and product documentation.
- **2026-10-18T23:29:20+05:30**: Added `clean_conversational_query()` to `app/text_cleaning.py` to strip conversational prefixes like "tell me about", "what is", "can you explain".
- **2026-10-18T23:29:45+05:30**: Modified `app/pipeline/tools.py`: implemented 4-stage cascading fallback in `search_knowledge_base`, refined query schema description in `SUPPORT_TOOLS`, and replaced ticket-escalating empty hint with guidance toward general overview/clarification.
- **2026-10-18T23:30:00+05:30**: Modified `app/pipeline/evaluator.py`: added `draft_mode` route for Step 1 clarification drafts (score >= 30) instead of unconditional hard floor ticket creation.
- **2026-10-18T23:30:30+05:30**: Restarted `mail_ai_worker` and `mail_ai_api` containers to ensure running processes load updated Python code.
- **2026-10-18T23:31:00+05:30**: Executed `check_352.py` unit suite: verified conversational query stripping, fallback Jaccard matching (score 0.65), 37 hydrated fallback chunks, and live Qdrant retrieval (2,111 chars retrieved).
- **2026-10-18T23:32:00+05:30**: Injected exact Email #352 inquiry payload ("tell me about CZ Dialer") into pipeline: created Email Log #354, verified intent `general_query`, tool call `search_knowledge_base` returning `Knowledge_Search_Success`, evaluation score 91 (`auto_send`), live SMTP dispatch to customer, and 0 CRM tickets created.



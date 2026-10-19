# Decisions: Step 133

## 1. Process-Level Fork Guard for Qdrant and Redis
- **Problem**: Celery's prefork pool forks worker child processes after parent initialization. When connection pools (Qdrant httpx client, Redis connection pool) are initialized before fork, child processes share open TCP sockets, causing connection corruption and silent query dropouts (`search()` returning `[]`).
- **Options Considered**:
  - A: Re-instantiate on every single request. (High socket connection overhead).
  - B: Track process IDs (`os.getpid()`) against pool instances, identical to the pattern proven in `app/db.py`. (Optimal: zero overhead per request within a process, guaranteed clean sockets upon fork).
- **Decision**: Option B. Implement `_qdrant_client_pid` and `_pools_pid` checks across `app/vector_store.py` and `app/redis_pool.py`.

## 2. Dual-Write Chunked Fallback Knowledge
- **Problem**: `app/rag.py:add_knowledge()` previously only saved to fallback JSON when Qdrant failed. As a result, when Qdrant succeeded during ingestion, the fallback JSON was left starved (missing 31 of 32 chunks including the entire CZ Dialer section).
- **Decision**: Always dual-write chunked documents (`split_text(content)`) to `fallback_<client_id>.json` on every upload, ensuring the fallback store is always an exact offline mirror of Qdrant.

## 3. Conversational English Query Cleaning & Multi-Stage Cascading
- **Problem**: Customers ask questions with conversational starters ("tell me about CZ Dialer"). Qdrant search works, but if conversational queries drop into fallback, Jaccard math penalizes them below the 0.20 cutoff. In addition, `tools.py` blocked retries if `fallback_query.lower() == query.lower()`.
- **Decision**: Add English conversational phrase stripping in `app/text_cleaning.py`, remove the equality block in `tools.py`, and allow automatic fallback cascading (primary query -> entity keyword query -> subject line).

## 4. De-poisoning the Empty Search Tool Hint
- **Problem**: `search_knowledge_base` returned a hint explicitly advising the LLM to *"escalate and create a ticket"*, causing the model to abandon helpful answers and draft ticket notices for general queries.
- **Decision**: Reword the tool hint to guide the agent toward helpful general overviews and clarification questions, prohibiting ticket escalation on general informational queries.

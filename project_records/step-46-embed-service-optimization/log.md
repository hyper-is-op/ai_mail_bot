# Step 46: RAG Embedding Service Stability and Query Caching

## Task Objective
Eliminate embedding service timeouts during RAG retrieval by:
1. Increasing HTTP client timeout in `app/embed_client.py` from 10s to 25s (configurable via `EMBED_TIMEOUT_SECONDS`).
2. Constraining PyTorch thread thrashing on CPU (`OMP_NUM_THREADS`, `MKL_NUM_THREADS`, `TORCH_NUM_THREADS`) in `docker-compose.yml` and `embed_service.py`.
3. Adding Redis-backed vector caching in `app/embed_client.py` with automatic fallback to local LRU memory cache for repetitive query embeddings.

## Actions
- 2026-09-29T17:24:35+05:30: Initialized step-46.
- 2026-09-29T17:25:30+05:30: Configured CPU thread limits (`OMP_NUM_THREADS=2`, `MKL_NUM_THREADS=2`, `TORCH_NUM_THREADS=2`) in `docker-compose.yml` and `embed_service.py` to stop CPU thrashing across worker containers.
- 2026-09-29T17:26:20+05:30: Updated `app/embed_client.py`:
  - Increased HTTP client timeout from 10s to 25s (`EMBED_TIMEOUT_SECONDS=25`).
  - Added Redis query vector caching (`embed_cache:query:<sha256>`) with 24h TTL and in-memory LRU fallback.
- 2026-09-29T17:26:50+05:30: Restarted `mail_ai_embed_service`, `mail_ai_worker`, and `mail_ai_api`.
- 2026-09-29T17:30:40+05:30: Benchmark results:
  - First query computation took **0.205s** (down from >10s timeout failure).
  - Subsequent query took **0.0007s** (0.7ms) via Redis cache hit.

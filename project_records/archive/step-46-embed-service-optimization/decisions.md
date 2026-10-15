# Decision: Embedding Service CPU Optimization and Query Caching

## Problem Statement
When workers execute `search_knowledge_base`, concurrent CPU load causes PyTorch on `mail_ai_embed_service` to spike above the 10-second client timeout, triggering a `requests.exceptions.Timeout` and forcing RAG into degraded JSON fallback mode.

## Chosen Solution
1. **Timeout Relaxation**: Bump client timeout to 25s so high-concurrency bursts do not drop real-time retrieval requests.
2. **CPU Thread Constraining**: Cap OpenMP/MKL/Torch threads to 2 in `embed_service` container to prevent CPU core saturation and context switching penalties.
3. **Query Vector Caching**: Cache query embeddings in Redis (`redis://mail_ai_redis:6379/0`, key `embed_cache:query:<hash>`) with a 24-hour TTL. Fall back to an in-process LRU cache if Redis is temporarily unreachable. Repetitive queries (e.g. login issues, pricing, support FAQs) will return vectors in sub-millisecond latency.

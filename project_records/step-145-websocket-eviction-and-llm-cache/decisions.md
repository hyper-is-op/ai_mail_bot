# Step 145: Architectural Decisions

## 1. WebSocket Session Re-validation Strategy

- **Context**: The completeness audit identified that authenticated WebSocket connections were validated only on initial connect. Once opened, connections could remain open indefinitely even after token expiry in Redis (`session:<token>`), receiving broadcast events.
- **Options Considered**:
  1. *Per-message validation in broadcast*: Check `get_session(token)` for every connected socket on every broadcast call.
     - *Tradeoff*: High Redis query amplification during bursty inbound email processing (e.g., 50 broadcasts/min x 20 clients = 1,000 Redis reads/min).
  2. *Throttled multi-point re-validation (60s threshold + idle timeout + ping)*:
     - Check `now - last_validated > 60` during broadcast.
     - Re-validate on incoming client `"ping"` frames.
     - Enforce a 60-second `asyncio.wait_for` idle timeout in the receive loop, re-validating if no messages arrive.
     - If expired at any point, close with code 4001 ("Session expired") and disconnect.
     - *Tradeoff*: Zero noticeable overhead on Redis while bounding ghost socket lifetime to at most 60 seconds after token expiration.
- **Decision**: Adopted Option 2.

## 2. Multi-Worker LLM Config Cache Synchronization

- **Context**: `_llm_configs_cache` in `app/llm_config.py` was a purely in-process dictionary with a 30s TTL. With multiple Celery worker forks and the FastAPI API container running separately, updating a tenant's LLM configuration in admin settings meant workers could continue using stale configs for up to 30 seconds.
- **Options Considered**:
  1. *Eliminate caching completely*: Query MySQL on every LLM resolution.
     - *Tradeoff*: Introduces unnecessary database queries and decryption overhead on high-throughput email processing turns.
  2. *Redis-backed shared cache with explicit write invalidation*:
     - Cache global configs under `llm_cfg:{config_id}` in Redis with 30s TTL.
     - Check Redis first, falling back to local memory and MySQL.
     - Invalidate specific keys or all keys in Redis on config creation, update, or deletion in `app/api/settings/llm_routes.py`.
     - *Tradeoff*: Instant cross-process cache invalidation across all Celery workers and API instances without incurring database query load on every turn.
- **Decision**: Adopted Option 2.

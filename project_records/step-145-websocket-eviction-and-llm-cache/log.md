# Step 145: WebSocket Token Expiry Eviction and Cross-Process LLM Config Invalidation

- 2026-10-20T11:17:30+05:30: Initialized Step 145 to implement server-side WebSocket session expiry eviction and cross-process Redis caching/invalidation for LLM configurations.
- 2026-10-20T11:18:03+05:30: Modified `app/main.py`: added `last_validated` and `token` tracking to `websocket.state`. Enhanced `ConnectionManager.broadcast` with 60s throttled session re-validation against Redis, closing expired sockets with code 4001. Added 60s idle timeout and heartbeat ping session re-validation in `websocket_endpoint`.
- 2026-10-20T11:18:38+05:30: Modified `app/llm_config.py`: implemented Redis-backed cross-process caching (`llm_cfg:{config_id}`) in `get_llm_config` with 30s TTL and local fallback. Added `invalidate_llm_cache` function to purge Redis and local caches on config mutations.
- 2026-10-20T11:19:16+05:30: Modified `app/api/settings/llm_routes.py`: added `invalidate_llm_cache` triggers on `set_client_llm_config`, `save_globally_available_llm_config_endpoint`, and `delete_globally_available_llm_config_endpoint`.
- 2026-10-20T11:19:44+05:30: Created `tests/test_ws_eviction_and_llm_cache.py`: added 3 automated unit tests covering WebSocket broadcast eviction on expired session, retention on valid session, and Redis LLM config caching/invalidation.
- 2026-10-20T11:19:56+05:30: Executed `tests/test_ws_eviction_and_llm_cache.py` inside live `mail_ai_worker` container: 3/3 tests passed in 0.018s.
- 2026-10-20T11:20:44+05:30: Executed full test suite discovery (`python -m unittest discover tests`) in live `mail_ai_worker` container: 152/152 tests passed in 35.914s with 0 failures and 0 errors.


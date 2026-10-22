"""
Unit Test Suite for Step 145:
1. Server-side WebSocket session expiry eviction (broadcast + ping)
2. Cross-process LLM config caching in Redis and explicit invalidation
"""

import unittest
import asyncio
from unittest.mock import MagicMock, patch
from app.main import ConnectionManager
from app.llm_config import get_llm_config, invalidate_llm_cache, _llm_configs_cache


class TestWsEvictionAndLlmCache(unittest.IsolatedAsyncioTestCase):

    async def test_01_broadcast_evicts_expired_session(self):
        """ConnectionManager.broadcast should close and evict connection if session expired."""
        manager = ConnectionManager()
        mock_ws = MagicMock()
        mock_ws.state = MagicMock()
        mock_ws.state.token = "test-token-expired"
        mock_ws.state.client_id = "CLI-TEST"
        mock_ws.state.role = "client"
        mock_ws.state.last_validated = 0  # force re-validation (> 60s ago)
        mock_ws.close = MagicMock()

        async def fake_close(code=None, reason=None):
            return None
        mock_ws.close.side_effect = fake_close

        manager.active_connections.append(mock_ws)

        with patch("app.auth.get_session", return_value=None):
            await manager.broadcast("hello", target_client_id="CLI-TEST")

        self.assertNotIn(mock_ws, manager.active_connections)
        mock_ws.close.assert_called_with(code=4001, reason="Session expired")

    async def test_02_broadcast_retains_valid_session(self):
        """ConnectionManager.broadcast retains connection if session is still valid in Redis."""
        manager = ConnectionManager()
        mock_ws = MagicMock()
        mock_ws.state = MagicMock()
        mock_ws.state.token = "test-token-valid"
        mock_ws.state.client_id = "CLI-TEST"
        mock_ws.state.role = "client"
        mock_ws.state.last_validated = 0
        
        async def fake_send(msg):
            return None
        mock_ws.send_text.side_effect = fake_send

        manager.active_connections.append(mock_ws)

        with patch("app.auth.get_session", return_value={"client_id": "CLI-TEST", "role": "client"}):
            await manager.broadcast("hello", target_client_id="CLI-TEST")

        self.assertIn(mock_ws, manager.active_connections)
        self.assertGreater(mock_ws.state.last_validated, 0)
        mock_ws.send_text.assert_called_with("hello")

    def test_03_llm_config_redis_caching_and_invalidation(self):
        """get_llm_config caches in Redis and invalidate_llm_cache clears it."""
        mock_redis = MagicMock()
        redis_storage = {}

        def fake_get(key):
            return redis_storage.get(key)

        def fake_set(key, val, ex=None):
            redis_storage[key] = val

        def fake_delete(*keys):
            for k in keys:
                redis_storage.pop(k, None)

        def fake_keys(pattern):
            return [k for k in redis_storage if k.startswith("llm_cfg:")]

        mock_redis.get.side_effect = fake_get
        mock_redis.set.side_effect = fake_set
        mock_redis.delete.side_effect = fake_delete
        mock_redis.keys.side_effect = fake_keys

        # Clear in-memory
        _llm_configs_cache.clear()

        db_mock_row = ("groq", "test-api-key", "https://api.groq.com", "qwen-32b", None, "Test Groq")
        
        with patch("app.redis_pool.get_redis_main", return_value=mock_redis), \
             patch("app.db.get_db_ctx") as mock_db:
            
            mock_cursor = MagicMock()
            mock_cursor.fetchone.return_value = db_mock_row
            mock_db.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value = mock_cursor

            # 1. First fetch -> misses Redis -> queries DB -> writes Redis
            cfg1 = get_llm_config(999)
            self.assertIsNotNone(cfg1)
            self.assertEqual(cfg1["provider"], "groq")
            self.assertIn("llm_cfg:999", redis_storage)
            self.assertEqual(mock_cursor.execute.call_count, 1)

            # 2. Second fetch -> hits Redis -> no second DB query
            mock_cursor.execute.reset_mock()
            _llm_configs_cache.clear()  # clear in-memory to force Redis read
            cfg2 = get_llm_config(999)
            self.assertEqual(cfg2["provider"], "groq")
            self.assertEqual(mock_cursor.execute.call_count, 0)

            # 3. Invalidate specific config -> removes from Redis & memory
            invalidate_llm_cache(999)
            self.assertNotIn("llm_cfg:999", redis_storage)
            self.assertNotIn(999, _llm_configs_cache)

            # 4. Invalidate all -> removes all llm_cfg keys
            redis_storage["llm_cfg:1001"] = '{"provider": "openai"}'
            invalidate_llm_cache(None)
            self.assertNotIn("llm_cfg:1001", redis_storage)


if __name__ == "__main__":
    unittest.main()

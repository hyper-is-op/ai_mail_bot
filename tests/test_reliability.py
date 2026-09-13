import unittest
import time
import os
import tempfile
from unittest.mock import patch

from app.llm_circuit_breaker import CircuitBreaker
from app.utils import normalize_subject


class TestCircuitBreaker(unittest.TestCase):
    def setUp(self):
        self.cb = CircuitBreaker(failure_threshold=3, recovery_timeout=1)

    def test_circuit_initially_closed(self):
        self.assertFalse(self.cb.is_open("openai"))

    def test_circuit_trips_after_threshold(self):
        self.cb.record_failure("groq")
        self.cb.record_failure("groq")
        self.assertFalse(self.cb.is_open("groq"))
        
        # 3rd failure hits threshold of 3
        self.cb.record_failure("groq")
        self.assertTrue(self.cb.is_open("groq"))

    def test_record_success_resets_counter(self):
        self.cb.record_failure("gemini")
        self.cb.record_failure("gemini")
        self.cb.record_success("gemini")
        self.assertFalse(self.cb.is_open("gemini"))
        
        # Another failure starts from 1, not 3
        self.cb.record_failure("gemini")
        self.assertFalse(self.cb.is_open("gemini"))

    def test_circuit_recovers_after_timeout(self):
        self.cb.record_failure("anthropic")
        self.cb.record_failure("anthropic")
        self.cb.record_failure("anthropic")
        self.assertTrue(self.cb.is_open("anthropic"))

        # Wait for recovery timeout (1 sec)
        time.sleep(1.1)
        self.assertFalse(self.cb.is_open("anthropic"))


class TestFallbackDbConcurrency(unittest.TestCase):
    def test_save_and_load_fallback_db(self):
        import sys
        from unittest.mock import MagicMock
        sys.modules.setdefault("qdrant_client", MagicMock())
        sys.modules.setdefault("qdrant_client.models", MagicMock())
        sys.modules.setdefault("qdrant_client.http", MagicMock())
        sys.modules.setdefault("qdrant_client.http.exceptions", MagicMock())
        import app.rag as rag
        with tempfile.TemporaryDirectory() as tmpdir:
            test_db_path = os.path.join(tmpdir, "test_fallback.json")
            with patch.object(rag, "FALLBACK_DB_PATH", test_db_path):
                # Empty initially
                self.assertEqual(rag.load_fallback_db(), {})

                # Save data
                payload = {"doc_1": {"text": "hello world", "client_id": "test_client"}}
                rag.save_fallback_db(payload)

                # Load data
                loaded = rag.load_fallback_db()
                self.assertEqual(loaded, payload)


class TestNormalizeSubject(unittest.TestCase):
    def test_fallback_to_body_first_line(self):
        self.assertEqual(normalize_subject("", "Need password reset urgently\nMore details..."), "Need password reset urgently")
        self.assertEqual(normalize_subject("(no subject)", "Billing discrepancy noticed"), "Billing discrepancy noticed")

    def test_fallback_to_default(self):
        self.assertEqual(normalize_subject(""), "Support Request")
        self.assertEqual(normalize_subject("   "), "Support Request")
        self.assertEqual(normalize_subject("none"), "Support Request")

    def test_valid_subject_preserved(self):
        self.assertEqual(normalize_subject("Re: Urgent issue"), "Re: Urgent issue")


if __name__ == "__main__":
    unittest.main()

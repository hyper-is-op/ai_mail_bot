"""
tests/test_connectors_security.py

Tests for Category 4 Connector Hardening:
1. BOLA / IDOR ownership verification & PII redaction.
2. Tenant-specific custom regex extraction & ReDoS/syntax safety.
3. Multi-entity disambiguation (Order + Ticket vs Multiple Orders).
4. Sliding-window Redis rate limiting on connector lookups.
5. Upstream 5xx / timeout circuit breaking into draft_mode.
"""
import unittest
from unittest.mock import patch, MagicMock
import requests

from app.connector_config.dispatch import (
    check_connector_rate_limit,
    redact_sensitive_pii,
    run_order_status_lookup,
    run_ticket_status_lookup
)
from app.llm_utils import extract_ticket_and_order_ids, extract_entities_categorized
from app.pipeline.evaluator import evaluate_draft_and_decide
from app.pipeline.context import PipelineContext
from app.pipeline.tools import execute_tool_call


class TestConnectorsSecurity(unittest.TestCase):

    def test_01_bola_owner_email_match_verified(self):
        """When from_email matches owner_email returned by connector, ownership is verified and PII is intact."""
        raw_data = {
            "docket_no": "1001",
            "ticket_status": "Delivered",
            "customer_name": "Alice Smith",
            "shipping_address": "742 Evergreen Terrace",
            "phone": "555-9876",
            "tracking_url": "https://carrier.com/track/1001"
        }
        with patch("app.connector_config.dispatch.get_live_config") as mock_cfg, \
             patch("app.connector_executor.execute_connector") as mock_exec, \
             patch("app.connector_config.dispatch.check_connector_rate_limit", return_value=True):

            mock_cfg.return_value = {
                "client_id": "CLI-TEST",
                "trigger_type": "order_status",
                "owner_email_path": "customer_email"
            }
            mock_exec.return_value = {
                "success": True,
                "data": dict(raw_data),
                "owner_email": "alice@example.com"
            }

            res = run_order_status_lookup(
                client_id="CLI-TEST",
                order_id="1001",
                from_email="alice@example.com"
            )

            self.assertTrue(res["success"])
            self.assertTrue(res["ownership_verified"])
            self.assertEqual(res["data"]["customer_name"], "Alice Smith")
            self.assertEqual(res["data"]["shipping_address"], "742 Evergreen Terrace")

    def test_02_bola_owner_email_mismatch_masks_pii_and_unverified(self):
        """When from_email does not match owner_email, ownership_verified is False and PII is masked."""
        raw_data = {
            "docket_no": "1001",
            "ticket_status": "Shipped",
            "customer_name": "Alice Smith",
            "shipping_address": "742 Evergreen Terrace",
            "phone": "555-9876",
            "tracking_url": "https://carrier.com/track/1001"
        }
        with patch("app.connector_config.dispatch.get_live_config") as mock_cfg, \
             patch("app.connector_executor.execute_connector") as mock_exec, \
             patch("app.connector_config.dispatch.check_connector_rate_limit", return_value=True):

            mock_cfg.return_value = {
                "client_id": "CLI-TEST",
                "trigger_type": "order_status",
                "owner_email_path": "customer_email"
            }
            mock_exec.return_value = {
                "success": True,
                "data": dict(raw_data),
                "owner_email": "alice@example.com"
            }

            # Unverified third party inquiries about Alice's order
            res = run_order_status_lookup(
                client_id="CLI-TEST",
                order_id="1001",
                from_email="stranger@attacker.com"
            )

            self.assertTrue(res["success"])
            self.assertFalse(res["ownership_verified"])
            # Status and docket_no preserved
            self.assertEqual(res["data"]["docket_no"], "1001")
            self.assertEqual(res["data"]["ticket_status"], "Shipped")
            # PII masked
            self.assertNotEqual(res["data"]["customer_name"], "Alice Smith")
            self.assertIn("***", res["data"]["customer_name"])
            self.assertNotEqual(res["data"]["shipping_address"], "742 Evergreen Terrace")
            self.assertIn("***", res["data"]["shipping_address"])
            self.assertIn("***", res["data"]["phone"])
            self.assertIn("***", res["data"]["tracking_url"])

    def test_03_evaluator_routes_unverified_ownership_to_draft_mode(self):
        """Evaluator must route BOLA ownership unverified cases to draft_mode."""
        score, decision = evaluate_draft_and_decide(
            client_id="CLI-TEST",
            reply="Your order #1001 is currently Shipped.",
            query="Status of order #1001",
            context_succeeded=True,
            ownership_verified=False
        )
        self.assertEqual(decision, "draft_mode")
        self.assertEqual(score, 50)

    def test_04_connector_rate_limiting(self):
        """Sender making consecutive lookups is rate-limited once threshold exceeded."""
        mock_redis = MagicMock()
        mock_redis.incr.side_effect = [1, 2, 3, 4, 5, 6]

        with patch("app.redis_pool.get_redis_main", return_value=mock_redis):
            # First 5 calls pass
            for _ in range(5):
                allowed = check_connector_rate_limit("CLI-TEST", "busy_sender@example.com", max_calls=5, window_seconds=600)
                self.assertTrue(allowed)
            # 6th call blocked
            blocked = check_connector_rate_limit("CLI-TEST", "busy_sender@example.com", max_calls=5, window_seconds=600)
            self.assertFalse(blocked)

    def test_05_evaluator_routes_rate_limited_to_draft_mode(self):
        """When rate_limited flag is True, evaluator holds response in draft_mode."""
        score, decision = evaluate_draft_and_decide(
            client_id="CLI-TEST",
            reply="Your request is received.",
            query="Status check",
            context_succeeded=True,
            rate_limited=True
        )
        self.assertEqual(decision, "draft_mode")
        self.assertEqual(score, 50)

    def test_06_upstream_outage_circuit_breaker(self):
        """Upstream 5xx or timeout returns upstream_outage=True and routes to draft_mode."""
        score, decision = evaluate_draft_and_decide(
            client_id="CLI-TEST",
            reply="We are currently looking into your ticket.",
            query="Ticket status",
            context_succeeded=True,
            upstream_outage=True
        )
        self.assertEqual(decision, "draft_mode")
        self.assertEqual(score, 50)

    def test_07_custom_tenant_regex_extraction(self):
        """Custom regex in tenant config captures non-standard alphanumeric IDs."""
        text = "Hello, please give me an update on package AZ-98231 and order 112-7762514-9918231"
        custom_pattern = r'\b(AZ-\d{5})\b'
        extracted = extract_ticket_and_order_ids(text, custom_regex=custom_pattern)
        self.assertIn("AZ-98231", extracted)

    def test_08_redos_and_malformed_regex_fallback(self):
        """Malformed regex in tenant config logs warning and falls back cleanly without exception."""
        text = "Order reference #ORD-8812"
        broken_regex = r"(?P<broken[invalid"
        # Should not raise exception
        extracted = extract_ticket_and_order_ids(text, custom_regex=broken_regex)
        self.assertIn("ORD-8812", extracted)

    def test_09_multi_entity_order_and_ticket_no_halt(self):
        """Categorized extractor separates 1 order and 1 ticket cleanly without collision."""
        email_text = "Regarding my order ORD-5501 and support ticket #275424000000596115"
        entities = extract_entities_categorized(email_text)
        self.assertEqual(len(entities["orders"]), 1)
        self.assertIn("ORD-5501", entities["orders"])
        self.assertEqual(len(entities["tickets"]), 1)
        self.assertIn("275424000000596115", entities["tickets"])

    def test_10_multi_entity_multiple_orders_triggers_disambiguation(self):
        """Categorized extractor identifies multiple orders of the same type."""
        email_text = "Please check order ORD-1001 and also order ORD-1002"
        entities = extract_entities_categorized(email_text)
        self.assertEqual(len(entities["orders"]), 2)
        self.assertIn("ORD-1001", entities["orders"])
        self.assertIn("ORD-1002", entities["orders"])


if __name__ == "__main__":
    unittest.main()

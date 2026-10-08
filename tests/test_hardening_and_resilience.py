"""
Test Suite for Step 67: Operational Hardening and Resilience
Tests:
1. DLQ One-Click Retry (in-place re-dispatch without row duplication)
2. Closed-Loop RAG Feedback (add_to_kb toggle on draft send)
3. Proactive SLA and Poison Pill Webhook Alerts with Redis Cooldown
4. Period-over-Period Delta calculation in Dashboard Stats
"""

import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.auth_deps import get_current_user
from app.alert_service import trigger_alert_if_needed

class TestHardeningAndResilience(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.dependency_overrides[get_current_user] = lambda: {
            "email": "admin@example.com", 
            "username": "Admin", 
            "role": "admin", 
            "client_id": None
        }
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()

    @patch("app.api.emails.get_db_ctx")
    @patch("app.api.emails.process_email_task.delay")
    def test_01_dlq_retry_in_place(self, mock_delay, mock_db):
        """POST /emails/{email_log_id}/retry should reset status to pending and dispatch task with retry_log_id."""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = (
            "CLI-TEST", "user@test.com", "Need assistance", "Help body", "<p>Help body</p>", "<msg-101>", None, "th_123"
        )
        mock_db.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value = mock_cursor

        mock_task = MagicMock()
        mock_task.id = "task-requeued-101"
        mock_delay.return_value = mock_task

        response = self.client.post("/emails/101/retry")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("status"), "requeued")
        self.assertEqual(data.get("email_log_id"), 101)
        self.assertEqual(data.get("task_id"), "task-requeued-101")
        self.assertTrue(mock_delay.called)
        
        task_call_args = mock_delay.call_args[0][0]
        self.assertEqual(task_call_args.get("__retry_log_id__"), 101)
        self.assertEqual(task_call_args.get("client_id"), "CLI-TEST")

    @patch("app.api.drafts.get_draft")
    @patch("app.api.drafts.send_single_draft")
    @patch("app.rag.add_knowledge")
    def test_02_draft_send_with_closed_loop_rag(self, mock_add_knowledge, mock_send_single, mock_get_draft):
        """Sending draft with add_to_kb=True must call add_knowledge with verified solution."""
        mock_get_draft.return_value = {
            "id": 55,
            "client_id": "CLI-TEST",
            "sender": "customer@test.com",
            "subject": "Re: Setup instructions",
            "draft_reply": "Here is the exact setup procedure.",
            "original_body": "How do I set up the VPN?",
            "thread_id": "th_vpn_setup",
        }
        mock_send_single.return_value = {"success": True, "draft_id": 55}
        mock_add_knowledge.return_value = "doc-rag-55"

        payload = {
            "add_to_kb": True,
            "kb_title": "Verified Solution: VPN Setup Instructions"
        }
        response = self.client.post("/drafts/55/send", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get("success"))
        self.assertTrue(data.get("added_to_kb"))
        self.assertEqual(data.get("kb_doc_id"), "doc-rag-55")

        self.assertTrue(mock_add_knowledge.called)
        call_args = mock_add_knowledge.call_args[0]
        self.assertEqual(call_args[0], "CLI-TEST") # client_id
        self.assertIn("Verified Solution", call_args[1]) # title
        self.assertIn("Customer Inquired", call_args[2]) # content

    @patch("app.alert_service.get_db_ctx")
    @patch("app.alert_service.get_redis_main")
    @patch("app.alert_service.dispatch_webhook")
    def test_03_proactive_alert_service_and_cooldown(self, mock_dispatch, mock_redis, mock_db):
        """trigger_alert_if_needed sends webhook when enabled and respects Redis cooldown."""
        mock_dispatch.return_value = True
        
        # Mock Redis allowing first call, blocking second call
        redis_mock = MagicMock()
        redis_mock.set.side_effect = [True, False]
        mock_redis.return_value = redis_mock

        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = (
            "https://hooks.slack.com/services/TEST/123", "ops@test.com", 1, 1, 4
        )
        mock_db.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value = mock_cursor

        # First call: should deliver alert
        sent_1 = trigger_alert_if_needed("CLI-TEST", "worker_stall", "Celery worker offline", "Worker heartbeat missed")
        self.assertTrue(sent_1)
        self.assertTrue(mock_dispatch.called)

        # Second call: suppressed by 30-min cooldown
        sent_2 = trigger_alert_if_needed("CLI-TEST", "worker_stall", "Celery worker offline", "Worker heartbeat missed")
        self.assertFalse(sent_2)

    @patch("app.api.analytics.get_db_ctx")
    def test_04_period_over_period_deltas(self, mock_db):
        """GET /dashboard/stats/{client_id} must return populated deltas structure."""
        mock_cursor = MagicMock()
        # Mock describe and queries using fetchall
        mock_cursor.fetchall.side_effect = [
            [("client_id", "int"), ("created_at", "datetime"), ("status", "varchar")], # DESCRIBE email_logs
            [("client_id", "varchar")], # DESCRIBE email_accounts
            [], # chart rows
            [(10, 5)], # hourly profile rows
            [], # intent matrix rows
            [], # ticket intent breakdown
            [], # accounts breakdown if any
        ]
        # Mock count/metrics returns
        mock_cursor.fetchone.side_effect = [
            (10,), # total emails
            (0,),  # pending
            (8,),  # ai replies
            (1,),  # failed
            (1,),  # tickets
            (0,),  # orders
            (1,),  # accounts
            (88.5,), # avg confidence
            (80,), # active_threshold from client_settings
            (8, 2, 0), # confidence breakdown: passed, below, floor_risk
            (0,),  # escalation risk
            (0,),  # oldest pending seconds
            (10, 0, 0, 0, 1), # inbound health (total, mkt, spm, blk, bnc)
            (30, 100), # velocity: active_days, total_month_volume
            (12000, 1200, 450, 3100), # execution latency (tot, avg, min, max)
            (1150, 450, 2800), # first action latency (avg, min, max)
            (8, 1), # CRR & deflection (rag_deflected, escalated)
            (5, 30, 10, 90, 1.4), # completed threads (count, avg, min, max, turns)
            (1, 45, 45, 45, 45), # incomplete threads (count, total, avg, min, max)
            (8, 25, 10, 60), # rag timing (count, avg, min, max)
            (1, 55, 55, 55), # ticket timing (count, avg, min, max)
            (0, 0), # active wip
            (5, 5, 0), # sentiment
            (8, 0, 0), # fcr
            (0, 0, 0), # wip aging
            (5, 4, 1), # prior period metrics: 5 total, 4 replies, 1 bounce
        ]
        mock_db.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value = mock_cursor

        response = self.client.get("/dashboard/stats/CLI-TEST?range=today")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("deltas", data)
        deltas = data["deltas"]
        self.assertIn("total_emails_pct", deltas)
        self.assertIn("ai_replies_pct", deltas)
        self.assertIn("automation_rate_pct", deltas)
        self.assertIn("bounce_rate_pct", deltas)
        self.assertIn("execution_latency", data)
        self.assertEqual(data["execution_latency"]["avg_latency_ms"], 1200)
        self.assertIn("completed_conversations", data["conversational_performance"])
        self.assertIn("incomplete_conversations", data["conversational_performance"])
        self.assertIn("rag_resolution_timing", data["conversational_performance"])
        self.assertIn("ticket_escalation_timing", data["conversational_performance"])
        self.assertIn("hourly_profile", data["inbound_health"])
        self.assertIn("chart_data", data)

if __name__ == "__main__":
    unittest.main()

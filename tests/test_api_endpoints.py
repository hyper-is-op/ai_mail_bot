import os
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app

class TestApiEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.admin_email = os.getenv("ADMIN_EMAIL", "mdyazdani0143@gmail.com")
        cls.admin_password = os.getenv("ADMIN_PASSWORD", "adminpassword")
        cls.test_client_id = "CLI-08BDA27B"
        cls.token = None

        # Reset any rate limits on login for testclient
        try:
            import redis
            r = redis.from_url(os.getenv("REDIS_URL", "redis://mail_ai_redis:6379/0"))
            r.delete("rate_limit:testclient:/login")
        except Exception:
            pass

        # Authenticate admin
        res = cls.client.post("/login", json={
            "email": cls.admin_email,
            "password": cls.admin_password
        })
        if res.status_code == 200:
            cls.token = res.json().get("token")

    def setUp(self):
        # Reset testclient rate limits before each test method
        try:
            import redis
            r = redis.from_url(os.getenv("REDIS_URL", "redis://mail_ai_redis:6379/0"))
            r.delete("rate_limit:testclient:/login")
            r.delete("rate_limit:testclient:/process-email")
        except Exception:
            pass

    def test_01_health_check(self):
        """GET / should return 200 OK with running status"""
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("status", data)
        self.assertIn("running", data["status"])

    def test_02_login_validation(self):
        """POST /login with missing payload should return 422 Unprocessable Entity"""
        res = self.client.post("/login", json={})
        self.assertEqual(res.status_code, 422)

    def test_03_login_invalid_credentials(self):
        """POST /login with incorrect password should return 401 Unauthorized"""
        res = self.client.post("/login", json={
            "email": self.admin_email,
            "password": "wrong_password_xyz"
        })
        self.assertEqual(res.status_code, 401)

    def test_04_login_success(self):
        """POST /login with valid admin credentials should return 200 and JWT token"""
        res = self.client.post("/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("token", data)
        user_info = data.get("user") or {}
        self.assertEqual(user_info.get("role"), "admin")

    def test_05_auth_guard_rejection(self):
        """Protected endpoints without Bearer token must return 401 Unauthorized"""
        res = self.client.get("/drafts/count")
        self.assertEqual(res.status_code, 401)

        res_outbox = self.client.get("/admin/action-outbox")
        self.assertEqual(res_outbox.status_code, 401)

        res_allowlist = self.client.get("/admin/url-allowlist")
        self.assertEqual(res_allowlist.status_code, 401)

    def test_06_protected_endpoints_with_token(self):
        """Protected endpoints with valid admin token should return 200 OK"""
        if not self.token:
            self.skipTest("Admin token unavailable")

        headers = {"Authorization": f"Bearer {self.token}"}

        # Drafts count
        res = self.client.get("/drafts/count", headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertIn("pending_count", res.json())

        # Action outbox telemetry
        res = self.client.get("/admin/action-outbox", headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertIn("records", res.json())

        # URL allowlist
        res = self.client.get("/admin/url-allowlist", headers=headers)
        self.assertEqual(res.status_code, 200)

        # Global default LLM
        res = self.client.get("/admin/global-default-llm", headers=headers)
        self.assertEqual(res.status_code, 200)

    def test_07_secured_client_status_routes(self):
        """Client status routes should respond with valid 200 statuses when authenticated"""
        if not self.token:
            self.skipTest("Admin token unavailable")

        headers = {"Authorization": f"Bearer {self.token}"}
        # Master bot status
        res = self.client.get(f"/master-bot-status/{self.test_client_id}", headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertIn("is_effective_enabled", res.json())

        # Budget status
        res = self.client.get(f"/budget-status/{self.test_client_id}", headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertIn("status", res.json())

    def test_08_process_email_validation(self):
        """POST /process-email with empty body and valid auth should return 422"""
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        res = self.client.post("/process-email", json={}, headers=headers)
        self.assertEqual(res.status_code, 422)

    def test_08b_process_email_unauthorized(self):
        """POST /process-email without auth must return 401 Unauthorized"""
        res = self.client.post("/process-email", json={
            "client_id": self.test_client_id,
            "from_email": "customer@example.com",
            "subject": "Help",
            "body": "Issue"
        })
        self.assertEqual(res.status_code, 401)

    def test_08c_process_email_api_key(self):
        """POST /process-email with valid X-API-Key must succeed with 200"""
        api_key = os.getenv("INGESTION_API_KEY", "mail_ai_ingest_secret_token_dev")
        with patch("app.api.emails.process_email_task.delay") as mock_delay:
            res = self.client.post(
                "/process-email",
                json={
                    "client_id": self.test_client_id,
                    "from_email": "customer@example.com",
                    "subject": "Help",
                    "body": "Issue"
                },
                headers={"X-API-Key": api_key}
            )
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json().get("status"), "queued")
            mock_delay.assert_called_once()

    def test_09_outbox_sweep_endpoint(self):
        """POST /admin/action-outbox/sweep should execute and return sweep metrics"""
        if not self.token:
            self.skipTest("Admin token unavailable")

        headers = {"Authorization": f"Bearer {self.token}"}
        res = self.client.post("/admin/action-outbox/sweep", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("status"), "success")
        self.assertIn("swept_count", data)

    def test_10_status_lookup_endpoints(self):
        """POST /order-status, /payment-status, and /ticket-status endpoints"""
        if not self.token:
            self.skipTest("Admin token unavailable")

        headers = {"Authorization": f"Bearer {self.token}"}

        # 1. POST /order-status unauthorized check
        unauth = self.client.post("/order-status", json={"client_id": self.test_client_id, "order_id": "1001"})
        self.assertEqual(unauth.status_code, 401)

        # 2. POST /order-status with mock
        with patch("app.api.connectors.get_order_by_id") as mock_get_order:
            mock_get_order.return_value = {"order_id": "1001", "status": "Shipped"}
            res = self.client.post(
                "/order-status",
                json={"client_id": self.test_client_id, "order_id": "1001"},
                headers=headers
            )
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json().get("data", {}).get("status"), "Shipped")

        # 3. POST /payment-status with mock
        with patch("app.connector_config.run_payment_status_lookup") as mock_pay:
            mock_pay.return_value = {"success": True, "data": {"payment_status": "succeeded", "amount": "99.00"}}
            res = self.client.post(
                "/payment-status",
                json={"client_id": self.test_client_id, "payment_id": "pi_123"},
                headers=headers
            )
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json().get("data", {}).get("payment_status"), "succeeded")

        # 4. POST /ticket-status with mock
        with patch("app.connector_config.run_ticket_status_lookup") as mock_ticket:
            mock_ticket.return_value = {"success": True, "data": {"ticket_status": "Open", "ticket_id": "T-100"}}
            res = self.client.post(
                "/ticket-status",
                json={"client_id": self.test_client_id, "ticket_id": "T-100"},
                headers=headers
            )
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json().get("data", {}).get("ticket_status"), "Open")

    def test_11_health_probe_endpoint(self):
        """GET /health must probe dependencies and return structured health status"""
        res = self.client.get("/health")
        self.assertIn(res.status_code, [200, 503])
        data = res.json()
        self.assertIn("status", data)
        self.assertIn("components", data)
        components = data["components"]
        self.assertIn("database", components)
        self.assertIn("redis", components)
        self.assertIn("qdrant", components)
        self.assertIn("embed_service", components)

        # Test degraded state handling when database fails
        with patch("app.db.get_db_ctx", side_effect=RuntimeError("Database down")):
            res_degraded = self.client.get("/health")
            self.assertEqual(res_degraded.status_code, 503)
            data_degraded = res_degraded.json()
            self.assertEqual(data_degraded.get("status"), "degraded")
            self.assertEqual(data_degraded["components"]["database"]["status"], "unhealthy")

    def test_12_dashboard_inbound_health_and_conversational_stats(self):
        """GET /dashboard/stats/{client_id} must return inbound_health and conversational_performance"""
        if not self.token:
            self.skipTest("Admin token unavailable")
        headers = {"Authorization": f"Bearer {self.token}"}
        res = self.client.get(f"/dashboard/stats/{self.test_client_id}", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        # Inbound health validation
        self.assertIn("inbound_health", data)
        ih = data["inbound_health"]
        self.assertIn("total_inbound", ih)
        self.assertIn("real_inquiries", ih)
        self.assertIn("marketing_count", ih)
        self.assertIn("blocked_count", ih)
        self.assertIn("bounce_count", ih)
        self.assertIn("bounce_rate", ih)
        self.assertIn("delivery_health_score", ih)
        self.assertIn("spam_count", ih)
        self.assertIn("avg_daily_inbound", ih)
        self.assertIn("monthly_inbound_volume", ih)

        # Execution latency validation
        self.assertIn("execution_latency", data)
        el = data["execution_latency"]
        self.assertIn("total_execution_ms", el)
        self.assertIn("avg_latency_ms", el)
        self.assertIn("min_latency_ms", el)
        self.assertIn("max_latency_ms", el)
        self.assertIn("first_action", el)

        # Conversational performance validation
        self.assertIn("conversational_performance", data)
        cp = data["conversational_performance"]
        self.assertIn("customer_resolution_rate", cp)
        self.assertIn("rag_resolved_count", cp)
        self.assertIn("ticket_escalated_count", cp)
        self.assertIn("avg_resolution_turns", cp)
        self.assertIn("avg_resolution_duration_sec", cp)
        self.assertIn("completed_conversations", cp)
        self.assertIn("incomplete_conversations", cp)
        self.assertIn("rag_resolution_timing", cp)
        self.assertIn("ticket_escalation_timing", cp)
        self.assertIn("sentiment_distribution", cp)
        self.assertIn("active_wip_conversations", cp)
        self.assertIn("sentiment_trajectory", cp)
        self.assertIn("inferred_csat", cp)
        self.assertIn("intent_breakdown", cp)

    def test_13_llm_metrics_token_economics(self):
        """GET /llm/metrics/{client_id} must return token_economics with per-email and per-conversation metrics"""
        if not self.token:
            self.skipTest("Admin token unavailable")
        headers = {"Authorization": f"Bearer {self.token}"}
        res = self.client.get(f"/llm/metrics/{self.test_client_id}", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertIn("token_economics", data)
        te = data["token_economics"]
        self.assertIn("avg_cost_per_email", te)
        self.assertIn("avg_tokens_per_email", te)
        self.assertIn("avg_cost_per_conversation", te)
        self.assertIn("avg_tokens_per_conversation", te)
        self.assertIn("avg_turns_per_conversation", te)
        self.assertIn("total_conversations", te)
        self.assertIn("guardrail_overhead_ratio", te)
        self.assertIn("economics_by_intent", te)

        # Test time range filters on LLM metrics endpoint
        for r in ["today", "yesterday", "this_week", "last_week", "this_month", "last_month"]:
            f_res = self.client.get(f"/llm/metrics/{self.test_client_id}?range_type={r}", headers=headers)
            self.assertEqual(f_res.status_code, 200)
            f_data = f_res.json()
            self.assertEqual(f_data.get("status"), "success")
            self.assertEqual(f_data.get("totals", {}).get("range_type"), r)

    def test_14_ticketing_report_and_csv_export(self):
        """GET /reports/ticketing/{client_id} and /reports/export/{client_id} should return audit logs and CSV"""
        if not self.token:
            self.skipTest("Admin token unavailable")
        headers = {"Authorization": f"Bearer {self.token}"}

        # JSON audit report
        res = self.client.get(f"/reports/ticketing/{self.test_client_id}", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("status"), "success")
        self.assertIn("summary", data)
        self.assertIn("pagination", data)
        self.assertIn("records", data)
        self.assertIn("deflection_rate", data["summary"])

        # CSV streaming export
        res_csv = self.client.get(f"/reports/export/{self.test_client_id}", headers=headers)
        self.assertEqual(res_csv.status_code, 200)
        self.assertIn("text/csv", res_csv.headers.get("content-type", ""))
        self.assertIn("attachment; filename=", res_csv.headers.get("content-disposition", ""))
        self.assertTrue(res_csv.text.startswith("ID,Thread ID,Timestamp (UTC),Customer Email"))


if __name__ == "__main__":
    unittest.main()



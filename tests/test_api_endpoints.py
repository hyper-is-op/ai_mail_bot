import os
import unittest
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
        """POST /process-email with empty body should return 422"""
        res = self.client.post("/process-email", json={})
        self.assertEqual(res.status_code, 422)

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


if __name__ == "__main__":
    unittest.main()

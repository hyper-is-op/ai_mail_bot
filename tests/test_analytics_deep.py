import csv
import io
import os
import unittest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.auth import create_session
from app.db import get_db_ctx


class TestAnalyticsDeep(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.admin_client_id = "CLI-ADMIN-TEST"
        cls.tenant_a = "CLI-TENANT-A-DEEP"
        cls.tenant_b = "CLI-TENANT-B-DEEP"
        cls.tenant_empty = "CLI-TENANT-EMPTY-DEEP"

        # Generate fast authentic sessions in Redis for test roles
        cls.admin_token = create_session({
            "id": 9901,
            "client_id": cls.admin_client_id,
            "email": "admin_deep@enterprise.test",
            "role": "admin",
            "name": "Super Admin"
        })

        cls.tenant_a_token = create_session({
            "id": 9902,
            "client_id": cls.tenant_a,
            "email": "user_a@tenant-a.test",
            "role": "client",
            "name": "Tenant A User"
        })

        cls.tenant_b_token = create_session({
            "id": 9903,
            "client_id": cls.tenant_b,
            "email": "user_b@tenant-b.test",
            "role": "client",
            "name": "Tenant B User"
        })

        cls.empty_token = create_session({
            "id": 9904,
            "client_id": cls.tenant_empty,
            "email": "empty@tenant-empty.test",
            "role": "client",
            "name": "Empty User"
        })

        # Clear and seed test database fixtures
        cls._cleanup_fixtures()
        cls._seed_fixtures()

    @classmethod
    def tearDownClass(cls):
        cls._cleanup_fixtures()

    @classmethod
    def _cleanup_fixtures(cls):
        test_cids = (cls.tenant_a, cls.tenant_b, cls.tenant_empty, cls.admin_client_id)
        with get_db_ctx() as db:
            with db.cursor() as cursor:
                cursor.execute(
                    "DELETE FROM email_logs WHERE client_id IN (%s, %s, %s, %s)",
                    test_cids
                )
                cursor.execute(
                    "DELETE FROM llm_logs WHERE client_id IN (%s, %s, %s, %s)",
                    test_cids
                )
                cursor.execute(
                    "DELETE FROM email_accounts WHERE client_id IN (%s, %s, %s, %s)",
                    test_cids
                )
                cursor.execute(
                    "DELETE FROM ticket_record WHERE client_id IN (%s, %s, %s, %s)",
                    test_cids
                )
            db.commit()

    @classmethod
    def _seed_fixtures(cls):
        now = datetime.utcnow()
        yesterday = now - timedelta(days=1)
        last_week = now - timedelta(days=8)

        with get_db_ctx() as db:
            with db.cursor() as cursor:
                # 1. Email Accounts (Tenant A starts week on monday, Tenant B on sunday)
                cursor.execute("""
                    INSERT INTO email_accounts 
                    (client_id, email, password, company_name, department_name, week_start_day, monthly_budget_usd)
                    VALUES 
                    (%s, 'a@test.com', 'dummy_pass_123', 'Tenant A Co', 'Support', 'monday', 100.0),
                    (%s, 'b@test.com', 'dummy_pass_123', 'Tenant B Co', 'Billing', 'sunday', 50.0),
                    (%s, 'empty@test.com', 'dummy_pass_123', 'Empty Co', 'General', 'monday', 0.0)
                """, (cls.tenant_a, cls.tenant_b, cls.tenant_empty))

                # 2. Email Logs for Tenant A
                # Row 1: RAG Resolved inquiry (Today)
                cursor.execute("""
                    INSERT INTO email_logs 
                    (client_id, from_email, subject, body, summary, status, score, sentiment, priority, 
                     thread_id, is_resolved, troubleshooting_step, intent, created_at)
                    VALUES 
                    (%s, 'cust1@example.com', 'Question about subscription refund', 'Need refund please', 
                     'Customer requests refund for annual renewal', 'sent', 85, 'Positive', 'Medium', 
                     'th_deep_01', 1, 1, 'billing', %s)
                """, (cls.tenant_a, now))
                log_id_1 = cursor.lastrowid

                # Row 2: Ticket Escalated inquiry (Today)
                cursor.execute("""
                    INSERT INTO email_logs 
                    (client_id, from_email, subject, body, summary, status, score, sentiment, priority, 
                     thread_id, is_resolved, troubleshooting_step, intent, escalation_reason, created_at)
                    VALUES 
                    (%s, 'cust2@example.com', 'System outage 500 error urgent', 'Server is returning 500 error', 
                     'Outage reported on api gateway', 'ticket_created_and_sent', 40, 'Negative', 'Urgent', 
                     'th_deep_02', 0, 2, 'technical_support', 'low_confidence', %s)
                """, (cls.tenant_a, now))
                log_id_2 = cursor.lastrowid

                # Row 3: Filtered / Dropped early exit bounce (Today)
                cursor.execute("""
                    INSERT INTO email_logs 
                    (client_id, from_email, subject, body, summary, status, score, sentiment, priority, 
                     thread_id, is_resolved, troubleshooting_step, intent, created_at)
                    VALUES 
                    (%s, 'mailer-daemon@google.com', 'Delivery Failure Notice', 'Message bounced', 
                     'Undeliverable mail bounced back', 'system_bounce_dropped', 0, 'Neutral', 'Low', 
                     'th_deep_03', 0, 0, 'marketing_promotional', %s)
                """, (cls.tenant_a, now))

                # Row 4: Historical log from last week
                cursor.execute("""
                    INSERT INTO email_logs 
                    (client_id, from_email, subject, body, summary, status, score, sentiment, priority, 
                     thread_id, is_resolved, troubleshooting_step, intent, created_at)
                    VALUES 
                    (%s, 'cust_old@example.com', 'Old ticket from last week', 'Old question', 
                     'Old archived inquiry', 'sent', 90, 'Neutral', 'Low', 
                     'th_deep_old', 1, 1, 'general_query', %s)
                """, (cls.tenant_a, last_week))

                # 3. Tickets for Tenant A
                cursor.execute("""
                    INSERT INTO ticket_record 
                    (ticket_id, client_id, mail_id, subject, body, status, priority, created_at)
                    VALUES 
                    ('TICK-9902', %s, 'msg_deep_02', 'System outage 500 error urgent', 'Server is returning 500 error', 'Open', 'Urgent', %s)
                """, (cls.tenant_a, now))

                # 4. LLM Logs for Tenant A (with both wholesale cost and billed_cost)
                cursor.execute("""
                    INSERT INTO llm_logs 
                    (client_id, provider, model_name, prompt_tokens, completion_tokens, cost, billed_cost, latency_ms, caller_function, email_log_id, thread_id, created_at)
                    VALUES 
                    (%s, 'groq', 'llama-3.3-70b-versatile', 500, 100, 0.000350, 0.001050, 420, 'generate_support_reply', %s, 'th_deep_01', %s),
                    (%s, 'groq', 'llama-3.3-70b-versatile', 800, 200, 0.000580, 0.001740, 680, 'generate_support_reply', %s, 'th_deep_02', %s)
                """, (cls.tenant_a, log_id_1, now, cls.tenant_a, log_id_2, now))

            db.commit()

    # =========================================================================
    # SUITE A: INBOUND HEALTH & OPERATIONS DASHBOARD
    # =========================================================================

    def test_tc_dash_01_empty_tenant_zero_division_safety(self):
        """TC-DASH-01: Empty tenant must return 200 with all zeroed metrics and zero division safety"""
        headers = {"Authorization": f"Bearer {self.empty_token}"}
        res = self.client.get(f"/dashboard/stats/{self.tenant_empty}", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        ih = data.get("inbound_health", {})
        self.assertEqual(ih.get("total_inbound"), 0)
        self.assertEqual(ih.get("bounce_rate"), 0.0)
        self.assertEqual(ih.get("delivery_health_score"), 100.0)

        cp = data.get("conversational_performance", {})
        self.assertEqual(cp.get("customer_resolution_rate"), 0.0)
        self.assertEqual(cp.get("rag_resolved_count"), 0)
        self.assertEqual(cp.get("ticket_escalated_count"), 0)
        self.assertEqual(cp.get("inferred_csat"), 5.0)

    def test_tc_dash_02_inbound_classification_and_metrics(self):
        """TC-DASH-02: Tenant A inbound classification totals and bounce rate calculation"""
        headers = {"Authorization": f"Bearer {self.tenant_a_token}"}
        res = self.client.get(f"/dashboard/stats/{self.tenant_a}?range_type=today", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        ih = data.get("inbound_health", {})
        # Tenant A has 3 emails created today: 2 real inquiries, 1 dropped/bounce
        self.assertGreaterEqual(ih.get("total_inbound", 0), 3)
        self.assertGreaterEqual(ih.get("real_inquiries", 0), 2)
        self.assertIn("hourly_profile", ih)
        self.assertEqual(len(ih.get("hourly_profile", [])), 24)

    def test_tc_dash_03_time_range_filters(self):
        """TC-DASH-03: range_type parameter correctly scopes results"""
        headers = {"Authorization": f"Bearer {self.tenant_a_token}"}
        # Today should only have 3 rows
        res_today = self.client.get(f"/dashboard/stats/{self.tenant_a}?range_type=today", headers=headers)
        self.assertEqual(res_today.status_code, 200)

        # All time should have at least 4 rows (includes the row from last week)
        res_all = self.client.get(f"/dashboard/stats/{self.tenant_a}?range_type=all", headers=headers)
        self.assertEqual(res_all.status_code, 200)
        total_all = res_all.json().get("inbound_health", {}).get("total_inbound", 0)
        total_today = res_today.json().get("inbound_health", {}).get("total_inbound", 0)
        self.assertGreater(total_all, total_today)

    def test_tc_dash_04_custom_date_range_validation(self):
        """TC-DASH-04: Custom range filters records between start_date and end_date"""
        headers = {"Authorization": f"Bearer {self.tenant_a_token}"}
        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        url = f"/dashboard/stats/{self.tenant_a}?range_type=custom&start_date={today_str}&end_date={today_str}"
        res = self.client.get(url, headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("inbound_health", data)
        self.assertIn("total_emails", data)

    # =========================================================================
    # SUITE B: TOKEN ECONOMICS & ROLE-BASED COST PRIVACY
    # =========================================================================

    def test_tc_llm_01_client_role_cost_masking(self):
        """TC-LLM-01: Client role token must only see billed_cost and cannot view wholesale provider costs"""
        headers = {"Authorization": f"Bearer {self.tenant_a_token}"}
        res = self.client.get(f"/llm/metrics/{self.tenant_a}", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        te = data.get("token_economics", {})
        totals = data.get("totals", {})

        # Client must see authoritative billed cost
        self.assertIn("total_cost", totals)
        self.assertIn("avg_cost_per_email", te)

        # Client must NOT receive internal raw provider costs or profit margins
        self.assertNotIn("raw_cost", totals)
        self.assertNotIn("provider_cost", totals)
        self.assertNotIn("profit_margin", totals)
        self.assertNotIn("margin", totals)

    def test_tc_llm_02_admin_role_cost_transparency(self):
        """TC-LLM-02: Admin role can view billed cost, wholesale cost, and margin analysis"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        res = self.client.get(f"/llm/metrics/{self.tenant_a}", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        totals = data.get("totals", {})
        # Admin view includes dual cost fields
        self.assertIn("total_cost", totals)
        self.assertIn("raw_cost", totals)
        self.assertIn("margin", totals)

    def test_tc_llm_03_per_conversation_economics(self):
        """TC-LLM-03: Verify per-conversation unit economics aggregation"""
        headers = {"Authorization": f"Bearer {self.tenant_a_token}"}
        res = self.client.get(f"/llm/metrics/{self.tenant_a}", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        te = data.get("token_economics", {})
        self.assertGreater(te.get("total_conversations", 0), 0)
        self.assertGreater(te.get("avg_cost_per_conversation", 0), 0)
        self.assertGreater(te.get("avg_tokens_per_conversation", 0), 0)

    # =========================================================================
    # SUITE C: TICKETING & RESOLUTION REPORTS
    # =========================================================================

    def test_tc_rep_01_pagination_and_bounds(self):
        """TC-REP-01: Pagination clamping and correct offset structure"""
        headers = {"Authorization": f"Bearer {self.tenant_a_token}"}
        res = self.client.get(f"/reports/ticketing/{self.tenant_a}?page=1&page_size=5", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        pag = data.get("pagination", {})
        self.assertEqual(pag.get("page"), 1)
        self.assertEqual(pag.get("page_size"), 5)
        self.assertGreaterEqual(pag.get("total_rows", 0), 4)
        self.assertEqual(len(data.get("records", [])), 4)

    def test_tc_rep_02_multi_column_search(self):
        """TC-REP-02: Universal search matching across subject, summary, and email"""
        headers = {"Authorization": f"Bearer {self.tenant_a_token}"}
        # Search by subject keyword
        res_kw = self.client.get(f"/reports/ticketing/{self.tenant_a}?search=outage&search_field=all", headers=headers)
        self.assertEqual(res_kw.status_code, 200)
        records = res_kw.json().get("records", [])
        self.assertTrue(any("outage" in r.get("subject", "").lower() for r in records))

        # Search by specific customer email
        res_em = self.client.get(f"/reports/ticketing/{self.tenant_a}?search=cust1@example.com&search_field=customer_email", headers=headers)
        self.assertEqual(res_em.status_code, 200)
        for r in res_em.json().get("records", []):
            self.assertEqual(r.get("customer_email"), "cust1@example.com")

    def test_tc_rep_03_filter_combinations(self):
        """TC-REP-03: Combinations of intent and resolution_mode filters"""
        headers = {"Authorization": f"Bearer {self.tenant_a_token}"}
        res = self.client.get(
            f"/reports/ticketing/{self.tenant_a}?intent=billing&resolution_mode=rag",
            headers=headers
        )
        self.assertEqual(res.status_code, 200)
        records = res.json().get("records", [])
        self.assertTrue(len(records) >= 1)
        for r in records:
            self.assertEqual(r.get("technical_intent"), "billing")
            self.assertEqual(r.get("resolution_mode"), "RAG Deflected")

    def test_tc_rep_04_filtered_dropped_status(self):
        """TC-REP-04: Filtered / dropped emails show resolution_mode='Filtered / Dropped' and status='Dropped'"""
        headers = {"Authorization": f"Bearer {self.tenant_a_token}"}
        res = self.client.get(
            f"/reports/ticketing/{self.tenant_a}?resolution_mode=dropped",
            headers=headers
        )
        self.assertEqual(res.status_code, 200)
        records = res.json().get("records", [])
        self.assertTrue(len(records) >= 1)
        self.assertEqual(records[0].get("resolution_mode"), "Filtered / Dropped")
        self.assertEqual(records[0].get("status"), "Dropped")

    def test_tc_rep_05_sql_injection_defense(self):
        """TC-REP-05: SQL injection strings in search are sanitized parameterized queries"""
        headers = {"Authorization": f"Bearer {self.tenant_a_token}"}
        malicious_search = "'; DROP TABLE email_logs; --"
        res = self.client.get(
            f"/reports/ticketing/{self.tenant_a}?search={malicious_search}&search_field=all",
            headers=headers
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json().get("records", [])), 0)

    # =========================================================================
    # SUITE D: STREAMING CSV EXPORT
    # =========================================================================

    def test_tc_csv_01_headers_and_content_type(self):
        """TC-CSV-01: CSV export returns streaming RFC-4180 response with correct headers"""
        headers = {"Authorization": f"Bearer {self.tenant_a_token}"}
        res = self.client.get(f"/reports/export/{self.tenant_a}", headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertIn("text/csv", res.headers.get("content-type", ""))
        self.assertIn("attachment; filename=", res.headers.get("content-disposition", ""))

        # Verify CSV column headers for standard client
        reader = csv.reader(io.StringIO(res.text))
        first_row = next(reader)
        expected_cols = [
            "ID", "Thread ID", "Timestamp (UTC)", "Customer Email", "Subject",
            "Summary of Issue", "Technical Intent", "Resolution Mode", "Status",
            "Escalation Reason", "Total Turns", "Confidence Score", "Sentiment",
            "Sentiment Trajectory", "Sentiment Score (-1 to 1)", "Tokens", "Processing Time (s)", "Estimated Cost ($)"
        ]
        self.assertEqual(first_row, expected_cols)

    def test_tc_csv_02_filter_consistency_with_report(self):
        """TC-CSV-02: CSV export applies identical filters as ticketing report endpoint"""
        headers = {"Authorization": f"Bearer {self.tenant_a_token}"}
        res_json = self.client.get(
            f"/reports/ticketing/{self.tenant_a}?intent=billing&resolution_mode=rag",
            headers=headers
        )
        res_csv = self.client.get(
            f"/reports/export/{self.tenant_a}?intent=billing&resolution_mode=rag",
            headers=headers
        )
        self.assertEqual(res_csv.status_code, 200)

        reader = csv.reader(io.StringIO(res_csv.text))
        rows = list(reader)[1:]  # skip header
        self.assertEqual(len(rows), len(res_json.json().get("records", [])))

    # =========================================================================
    # SUITE E: NOTIFICATIONS & BUDGET QUOTAS
    # =========================================================================

    def test_tc_notif_01_notifications_structure(self):
        """TC-NOTIF-01: /notifications/{client_id} returns array without server exception"""
        headers = {"Authorization": f"Bearer {self.tenant_a_token}"}
        res = self.client.get(f"/notifications/{self.tenant_a}", headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertIn("alerts", res.json())
        self.assertIsInstance(res.json()["alerts"], list)

    def test_tc_notif_02_all_tenants_notifications_admin_only(self):
        """TC-NOTIF-02: client_id='ALL' notifications requires admin role"""
        # Client role requesting ALL must fail
        headers_client = {"Authorization": f"Bearer {self.tenant_a_token}"}
        res_fail = self.client.get("/notifications/ALL", headers=headers_client)
        self.assertEqual(res_fail.status_code, 403)

        # Admin role requesting ALL succeeds
        headers_admin = {"Authorization": f"Bearer {self.admin_token}"}
        res_ok = self.client.get("/notifications/ALL", headers=headers_admin)
        self.assertEqual(res_ok.status_code, 200)

    # =========================================================================
    # SUITE F: SECURITY & CROSS-TENANT ISOLATION
    # =========================================================================

    def test_tc_sec_01_unauthenticated_request_rejected(self):
        """TC-SEC-01: Requests without valid bearer token return 401 Unauthorized"""
        endpoints = [
            f"/dashboard/stats/{self.tenant_a}",
            f"/llm/metrics/{self.tenant_a}",
            f"/reports/ticketing/{self.tenant_a}",
            f"/reports/export/{self.tenant_a}",
            f"/notifications/{self.tenant_a}"
        ]
        for ep in endpoints:
            res = self.client.get(ep)
            self.assertEqual(res.status_code, 401, f"Failed to reject unauthenticated request on {ep}")

    def test_tc_sec_02_cross_tenant_access_blocked(self):
        """TC-SEC-02: Tenant A cannot view or export Tenant B data (returns 403 Forbidden)"""
        headers_a = {"Authorization": f"Bearer {self.tenant_a_token}"}
        endpoints_b = [
            f"/dashboard/stats/{self.tenant_b}",
            f"/llm/metrics/{self.tenant_b}",
            f"/reports/ticketing/{self.tenant_b}",
            f"/reports/export/{self.tenant_b}",
            f"/notifications/{self.tenant_b}"
        ]
        for ep in endpoints_b:
            res = self.client.get(ep, headers=headers_a)
            self.assertEqual(res.status_code, 403, f"Cross-tenant leak detected on {ep}")

    def test_tc_sec_03_non_admin_cannot_access_all(self):
        """TC-SEC-03: Non-admin tenant cannot request client_id='ALL'"""
        headers_a = {"Authorization": f"Bearer {self.tenant_a_token}"}
        res_dash = self.client.get("/dashboard/stats/ALL", headers=headers_a)
        self.assertEqual(res_dash.status_code, 403)

        res_rep = self.client.get("/reports/ticketing/ALL", headers=headers_a)
        self.assertEqual(res_rep.status_code, 403)


if __name__ == "__main__":
    unittest.main()

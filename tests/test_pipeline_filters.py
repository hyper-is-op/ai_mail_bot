import unittest
from unittest.mock import MagicMock
from app.pipeline.context import PipelineContext
from app.pipeline.filters import apply_deterministic_filters
from app.llm import extract_ticket_and_order_ids
from app.keyword_filter import is_blocked

class TestPipelineFilters(unittest.TestCase):

    def setUp(self):
        try:
            from app.rate_limiter import get_redis_client
            r = get_redis_client()
            if r:
                r.delete("ratelimit:sender:CLI-TEST:customer@example.com")
                r.delete("ratelimit:sender:CLI-TEST:integrations@vip-partner.com")
                r.delete("ratelimit:exemptions:CLI-TEST")
        except Exception:
            pass

    def test_01_bounce_sender_filtered(self):
        """Emails from mailer-daemon, postmaster, or noreply must be dropped without reply"""
        ctx = PipelineContext.from_task_data("test-task-bounce", {
            "client_id": "CLI-TEST",
            "from_email": "mailer-daemon@googlemail.com",
            "subject": "Delivery Failure",
            "body": "Your message was not delivered."
        })
        cursor = MagicMock()
        halted = apply_deterministic_filters(ctx, cursor)
        self.assertTrue(halted)
        self.assertEqual(ctx.status, "system_bounce_dropped")
        self.assertIn("System_Bounce_Dropped", ctx.execution_steps)

    def test_02_bounce_subject_filtered(self):
        """Emails with delivery status notification subjects must be dropped"""
        ctx = PipelineContext.from_task_data("test-task-sub-bounce", {
            "client_id": "CLI-TEST",
            "from_email": "notifications@somehost.com",
            "subject": "Delivery Status Notification (Failure)",
            "body": "Could not deliver message."
        })
        cursor = MagicMock()
        halted = apply_deterministic_filters(ctx, cursor)
        self.assertTrue(halted)
        self.assertEqual(ctx.status, "system_bounce_dropped")

    def test_03_master_bot_disabled_halt(self):
        """When client or admin bot switch is disabled, processing must halt immediately"""
        ctx = PipelineContext.from_task_data("test-task-halt", {
            "client_id": "CLI-TEST",
            "from_email": "customer@example.com",
            "subject": "Need help with login",
            "body": "Please assist me with my login credentials."
        })
        ctx.features = {"admin_bot_enabled": False, "client_bot_enabled": True}
        cursor = MagicMock()
        halted = apply_deterministic_filters(ctx, cursor)
        self.assertTrue(halted)
        self.assertEqual(ctx.status, "automation_halted")
        self.assertTrue(any("Master_Switch_Halt" in s for s in ctx.execution_steps))

    def test_04_keyword_blocking(self):
        """Blocked keywords should match case-insensitively and block email"""
        blocked_list = ["lawsuit", "attorney", "unacceptable fraud"]
        
        self.assertIsNotNone(is_blocked("I will hire an attorney for this", blocked_list))
        self.assertEqual(is_blocked("I will hire an attorney for this", blocked_list), "attorney")
        self.assertIsNone(is_blocked("Can you please help with my order?", blocked_list))

    def test_05_ticket_id_extraction_single(self):
        """Standard ticket format T-YYMMDD-XXXXX and prefixes should be extracted"""
        text = "Hello, checking the status of ticket T-260505-00117."
        tids = extract_ticket_and_order_ids(text)
        self.assertIn("T-260505-00117", tids)

        text_ord = "Where is my order ORD-10294?"
        tids_ord = extract_ticket_and_order_ids(text_ord)
        self.assertIn("ORD-10294", tids_ord)

    def test_06_ticket_id_extraction_multiple(self):
        """Multiple ticket IDs in single email should be extracted and deduplicated"""
        text = "Regarding ticket T-260505-00117 and also my older order ORD-10294."
        tids = extract_ticket_and_order_ids(text)
        unique_tids = list(dict.fromkeys(tids))
        self.assertEqual(len(unique_tids), 2)
        self.assertIn("T-260505-00117", unique_tids)
        self.assertIn("ORD-10294", unique_tids)
    def test_07_broadcast_subdomain_dropped(self):
        """Broadcast subdomains like mail.internshala.com must be dropped before LLM calls"""
        ctx = PipelineContext.from_task_data("test-task-subdomain-broadcast", {
            "client_id": "CLI-TEST",
            "from_email": "student@mail.internshala.com",
            "subject": "Update: Your UK study journey starts in Delhi on 24 October",
            "body": "Register now for the education fair."
        })
        cursor = MagicMock()
        halted = apply_deterministic_filters(ctx, cursor)
        self.assertTrue(halted)
        self.assertEqual(ctx.status, "no_action_needed")
        self.assertTrue(ctx.is_resolved)
        self.assertIn("Broadcast_Sender_Dropped", ctx.execution_steps)

    def test_08_public_mail_domain_not_dropped(self):
        """Legitimate senders on mail.com or mail.ru must not be falsely dropped"""
        ctx = PipelineContext.from_task_data("test-task-public-mail", {
            "client_id": "CLI-TEST",
            "from_email": "customer@mail.com",
            "subject": "Need help with my account",
            "body": "I cannot access my dashboard."
        })
        cursor = MagicMock()
        cursor.fetchone.return_value = None
        halted = apply_deterministic_filters(ctx, cursor)
        self.assertFalse(halted)
        self.assertNotEqual(ctx.status, "no_action_needed")

    def test_09_rfc_list_unsubscribe_dropped(self):
        """Emails with List-Unsubscribe header must be dropped deterministically as marketing"""
        ctx = PipelineContext.from_task_data("test-task-rfc-unsubscribe", {
            "client_id": "CLI-TEST",
            "from_email": "marketing@acme.com",
            "subject": "Our seasonal newsletter",
            "body": "Check out our latest products.",
            "headers": {"list_unsubscribe": "<https://acme.com/unsub>"}
        })
        cursor = MagicMock()
        halted = apply_deterministic_filters(ctx, cursor)
        self.assertTrue(halted)
        self.assertEqual(ctx.status, "no_action_needed")
        self.assertTrue(ctx.is_resolved)
        self.assertIn("Broadcast_Sender_Dropped", ctx.execution_steps)

    def test_10_rfc_auto_submitted_dropped(self):
        """Emails with Auto-Submitted header must be dropped as automated system bounce/notice"""
        ctx = PipelineContext.from_task_data("test-task-rfc-autosubmit", {
            "client_id": "CLI-TEST",
            "from_email": "system-alert@service.net",
            "subject": "Automated status notification",
            "body": "Server status update.",
            "headers": {"auto_submitted": "auto-generated"}
        })
        cursor = MagicMock()
        halted = apply_deterministic_filters(ctx, cursor)
        self.assertTrue(halted)
        self.assertEqual(ctx.status, "system_bounce_dropped")
        self.assertTrue(ctx.is_resolved)

    def test_11_corporate_mail_subdomain_not_dropped(self):
        """Legitimate enterprise customers sending from mail.<company>.com must NOT be dropped"""
        ctx = PipelineContext.from_task_data("test-task-corp-mail", {
            "client_id": "CLI-TEST",
            "from_email": "alex.smith@mail.enterprise-corp.com",
            "subject": "Need help with API integration",
            "body": "Our endpoint is failing with error 400."
        })
        cursor = MagicMock()
        cursor.fetchone.return_value = None
        halted = apply_deterministic_filters(ctx, cursor)
        self.assertFalse(halted)
        self.assertNotEqual(ctx.status, "no_action_needed")

    def test_12_keyword_exception_allows_email(self):
        """Blocked keyword 'hack' must be bypassed when allowed phrase 'hackathon' is present"""
        from app.keyword_filter import is_blocked
        blocked_list = ["hack", "scam"]
        exceptions = {"hack": ["hackathon", "prevent hack"]}

        # 'hack' alone is blocked
        self.assertEqual(is_blocked("I found a hack for the system", blocked_list, exceptions), "hack")
        # 'hackathon' is allowed via exception
        self.assertIsNone(is_blocked("We are hosting an internal hackathon next week", blocked_list, exceptions))

    def test_13_rate_limit_exemption_allows_sender(self):
        """Exempted senders or domains must bypass hourly rate limit throttling"""
        from app.rate_limiter import check_sender_rate_limit
        cursor = MagicMock()
        # Mock rate_limit_exemptions to return exempt domain
        cursor.fetchall.return_value = [("vip-partner.com",), ("alert@monitoring.org",)]

        # Should be allowed even with limit=0
        allowed, count = check_sender_rate_limit("CLI-TEST", "integrations@vip-partner.com", limit=0, cursor=cursor)
        self.assertTrue(allowed)
        self.assertEqual(count, 0)


if __name__ == "__main__":
    unittest.main()

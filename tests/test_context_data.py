"""
Unit tests for ContextData and format_conversation_thread in app/context_data.py.
Validates 8,000-character ceiling, newest-first turn retention, and defensive truncation.
"""
import unittest

from app.context_data import format_conversation_thread, build_context_data_base


class TestContextDataFormatting(unittest.TestCase):
    def test_01_empty_history_normal_body(self):
        body = "Hello, my database connection is timing out on port 3306."
        res = format_conversation_thread([], body)
        self.assertEqual(res, body)

    def test_02_empty_history_giant_body(self):
        giant_body = "Error dump:\n" + ("X" * 10000)
        res = format_conversation_thread([], giant_body)
        self.assertLessEqual(len(res), 8000)
        self.assertTrue(res.endswith("[...truncated]"))

    def test_03_normal_multiturn_formatting(self):
        history = [
            {"role": "customer", "body": "My phone system is down.", "timestamp": "2026-10-27 10:00:00"},
            {"role": "support", "body": "Please verify if the PRI E1 cable is firmly connected.", "timestamp": "2026-10-27 10:05:00"},
            {"role": "customer", "body": "Cable is connected, green light is blinking.", "timestamp": "2026-10-27 10:10:00"},
        ]
        current_body = "Now the alarm LED turned solid red."
        res = format_conversation_thread(history, current_body)

        self.assertIn("=== LATEST CUSTOMER INQUIRY ===", res)
        self.assertIn("Now the alarm LED turned solid red.", res)
        self.assertIn("=== RECENT THREAD CONTEXT (Last 3 Messages) ===", res)
        self.assertNotIn("Older Omitted", res)
        self.assertIn("My phone system is down.", res)
        self.assertIn("solid red", res)
        self.assertLessEqual(len(res), 8000)

    def test_04_newest_first_turn_retention_on_oversized_history(self):
        # Create 12 turns, each ~800 characters
        history = []
        for i in range(1, 13):
            role = "customer" if i % 2 == 1 else "support"
            body = f"Turn {i} specific diagnostic log detail: " + ("abcdefghij " * 70)
            history.append({
                "role": role,
                "body": body,
                "timestamp": f"2026-10-27 10:{i:02d}:00"
            })

        current_body = "Turn 13 customer latest update: still broken."
        res = format_conversation_thread(history, current_body)

        self.assertLessEqual(len(res), 8000)
        self.assertIn("=== LATEST CUSTOMER INQUIRY ===", res)
        self.assertIn("Turn 13 customer latest update", res)

        # The newest diagnostic turns right before escalation MUST be preserved
        self.assertIn("Turn 12 specific diagnostic log detail", res)
        self.assertIn("Turn 11 specific diagnostic log detail", res)

        # The oldest turns must have been omitted
        self.assertNotIn("Turn 1 specific diagnostic log detail", res)
        self.assertIn("Older Omitted", res)

    def test_05_giant_latest_customer_inquiry_defensive_capping(self):
        # Customer pastes a giant 7,000 char log in the latest message
        giant_latest = "CRASH LOG DUMP:\n" + ("CrashTracebackLine " * 400)
        history = [
            {"role": "customer", "body": "Step 1 diagnosis", "timestamp": "2026-10-27 10:00:00"},
            {"role": "support", "body": "Step 2 response", "timestamp": "2026-10-27 10:05:00"},
            {"role": "customer", "body": "Step 3 final failure details", "timestamp": "2026-10-27 10:10:00"},
        ]

        res = format_conversation_thread(history, giant_latest)

        self.assertLessEqual(len(res), 8000)
        self.assertIn("[...latest message truncated...]", res)
        # History must not be completely starved
        self.assertIn("Step 3 final failure details", res)

    def test_06_build_context_data_base_integration(self):
        ctx_data = build_context_data_base(
            client_id="CLI-TEST",
            from_email="user@test.com",
            subject="Test subject",
            body="Latest issue message",
            cleaned_body="Latest issue message",
            history=[
                {"role": "customer", "body": "Initial issue", "timestamp": "2026-10-27 10:00:00"},
                {"role": "support", "body": "Diagnostic advice", "timestamp": "2026-10-27 10:05:00"},
            ]
        )
        self.assertIn("conversation_history", ctx_data)
        conv = ctx_data["conversation_history"]
        self.assertIn("=== LATEST CUSTOMER INQUIRY ===", conv)
        self.assertIn("Diagnostic advice", conv)
        self.assertLessEqual(len(conv), 8000)

    def test_07_condensed_support_reply_strips_disclaimers_and_caps(self):
        long_support_reply = (
            "Namaste Md Yazdani,\n\n"
            "Pehle toh tension mat lijiye, main aapki madad ke liye yahan hoon. "
            "CZ Desk ka issue aapko fix karne mein help karunga.\n\n"
            "**Step 1:** Apne browser ka cache clear karein (Ctrl + Shift + Delete -> Clear).\n"
            + ("Diagnostic instruction padding line text here. " * 30)
            + "\n\nThanks & Regards,\nDepartment: DEV\nCompany: C-Zentrix\nDisclaimer: confidential information."
        )
        history = [
            {"role": "customer", "body": "cz desk nai chal raha", "timestamp": "2026-10-27 10:00:00"},
            {"role": "support", "body": long_support_reply, "timestamp": "2026-10-27 10:05:00"},
        ]
        res = format_conversation_thread(history, "Step 1 try kiya par nai hua")
        self.assertIn("=== LATEST CUSTOMER INQUIRY ===", res)
        self.assertIn("Step 1 try kiya par nai hua", res)
        self.assertIn("Step 1:", res)
        # Disclaimers and signatures must be stripped
        self.assertNotIn("Disclaimer: confidential information", res)
        self.assertNotIn("Department: DEV", res)
        self.assertLessEqual(len(res), 8000)


if __name__ == "__main__":
    unittest.main()

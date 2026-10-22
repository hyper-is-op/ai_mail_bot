#!/usr/bin/env python3
"""
Unit and integration tests for the diagnostic_tools suite.
Validates identifier resolution, telemetry aggregation, root-cause rule logic,
and CLI formatting.
"""

import unittest
import json
from unittest.mock import patch, MagicMock
from diagnostic_tools.inspect_thread import (
    parse_identifier,
    analyze_findings,
    fetch_thread_data
)
from diagnostic_tools.diag_common import (
    format_datetime,
    truncate,
    status_badge,
    badge
)

class TestDiagnosticTools(unittest.TestCase):

    def test_parse_identifier_numeric(self):
        self.assertEqual(parse_identifier("371"), {"mail_id": "371", "thread_id": None, "msg_id": None})
        self.assertEqual(parse_identifier("#372"), {"mail_id": "372", "thread_id": None, "msg_id": None})

    def test_parse_identifier_thread_id(self):
        self.assertEqual(parse_identifier("th_e3897a2164b8"), {"mail_id": None, "thread_id": "th_e3897a2164b8", "msg_id": None})
        self.assertEqual(parse_identifier("e3897a2164b8"), {"mail_id": None, "thread_id": "th_e3897a2164b8", "msg_id": None})

    def test_parse_identifier_message_id(self):
        mid = "<CAOSZpAbP0iyxRMDSrj5Er+adGx1HnvkrXHPgizyofw-fUdj1=A@mail.gmail.com>"
        self.assertEqual(parse_identifier(mid), {"mail_id": None, "thread_id": None, "msg_id": mid})

    def test_analyze_findings_intent_drop(self):
        mock_data = {
            "emails": [{
                "id": 371,
                "status": "no_action_needed",
                "score": 0,
                "intent": "off_topic_nonsense",
                "execution_steps": json.dumps(["Start", "Intent_Drop:off_topic_nonsense"])
            }],
            "llm_logs": [],
            "action_logs": [],
            "drafts": []
        }
        findings = analyze_findings(mock_data)
        self.assertTrue(any("Dropped By Intent Filter" in f["title"] for f in findings))

    def test_analyze_findings_rag_empty(self):
        mock_data = {
            "emails": [{
                "id": 352,
                "status": "ticket_created_and_sent",
                "score": 0,
                "intent": "general_query",
                "execution_steps": json.dumps(["Start", "Knowledge_Search_Empty", "Agent_Score:0:create_ticket"])
            }],
            "llm_logs": [],
            "action_logs": [],
            "drafts": []
        }
        findings = analyze_findings(mock_data)
        self.assertTrue(any("RAG Retrieval Returned Empty" in f["title"] for f in findings))
        self.assertTrue(any("Escalated To CRM Ticket" in f["title"] for f in findings))

    def test_analyze_findings_auto_send_success(self):
        mock_data = {
            "emails": [{
                "id": 354,
                "status": "sent",
                "score": 91,
                "intent": "general_query",
                "execution_steps": json.dumps(["Start", "Knowledge_Search_Success", "Agent_Score:91:auto_send", "SMTP_Send"])
            }],
            "llm_logs": [],
            "action_logs": [],
            "drafts": []
        }
        findings = analyze_findings(mock_data)
        self.assertTrue(any("Autonomous Auto-Send" in f["title"] for f in findings))

    def test_formatting_utilities(self):
        self.assertEqual(truncate("short text", 20), "short text")
        self.assertEqual(truncate("a very long text that exceeds limit", 10), "a very ...")
        self.assertIn("SENT", status_badge("sent"))
        self.assertIn("NO_ACTION_NEEDED", status_badge("no_action_needed"))

    def test_ansi_helpers(self):
        from diagnostic_tools.diag_common import strip_ansi, ljust_ansi, Color
        colored_str = f"{Color.GREEN}ACTIVE{Color.RESET}"
        self.assertEqual(strip_ansi(colored_str), "ACTIVE")
        padded = ljust_ansi(colored_str, 10)
        self.assertEqual(strip_ansi(padded), "ACTIVE    ")
        self.assertEqual(len(strip_ansi(padded)), 10)

    def test_live_thread_lookup_sanity(self):
        # Query known existing email dynamically
        from diagnostic_tools.diag_common import get_db_cursor
        target_id = None
        target_tid = None
        target_cid = None
        try:
            with get_db_cursor() as cur:
                cur.execute("SELECT id, thread_id, client_id FROM email_logs ORDER BY id DESC LIMIT 1")
                row = cur.fetchone()
                if row:
                    target_id, target_tid, target_cid = row[0], row[1], row[2]
        except Exception:
            pass

        if not target_id:
            self.skipTest("No email logs currently present in database for live thread lookup test")

        data = fetch_thread_data(mail_id=target_id)
        self.assertIn("emails", data)
        self.assertGreaterEqual(len(data["emails"]), 1)
        email_ids = [e["id"] for e in data["emails"]]
        self.assertIn(target_id, email_ids)
        self.assertEqual(data["resolved_thread_id"], target_tid)
        self.assertEqual(data["resolved_client_id"], target_cid)


if __name__ == "__main__":
    unittest.main()

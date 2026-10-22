#!/usr/bin/env python3
"""
tests/test_problem_reproduction.py

Live end-to-end verification reproducing the user's exact reported issues:
1. Email #407: Single-turn inquiry with subject 'infomation request' and body 'tell me about cz omni'.
   Previously triggered Knowledge_Search_Empty, called escalate_and_create_ticket, created ticket 275424000000608001, and scored 0.
2. Email #401/#403/#408: Follow-up inquiry in thread with ticket subject 'Re: Ticket Update: 275424000000582153'.
   Previously created duplicate tickets and incremented troubleshooting step counter.
"""

import sys
import os
import time
import json
import unittest

# Ensure project root is on PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import get_db_ctx
from worker.tasks import process_email_task

CLIENT_ID = "CLI-4159FFCF"
SENDER = "md.yazdani@c-zentrix.com"

def get_latest_log(client_id: str, from_email: str):
    with get_db_ctx() as db:
        with db.cursor() as cursor:
            cursor.execute("""
                SELECT id, client_id, from_email, subject, reply, score, status, execution_steps, summary,
                       message_id, thread_id, troubleshooting_step, is_resolved
                FROM email_logs 
                WHERE client_id = %s AND from_email = %s 
                ORDER BY id DESC LIMIT 1
            """, (client_id, from_email))
            row = cursor.fetchone()
            if not row:
                return {}
            return {
                "id": row[0],
                "client_id": row[1],
                "from_email": row[2],
                "subject": row[3],
                "reply": row[4],
                "score": row[5],
                "status": row[6],
                "execution_steps": json.loads(row[7]) if row[7] else [],
                "summary": row[8],
                "message_id": row[9],
                "thread_id": row[10],
                "troubleshooting_step": row[11],
                "is_resolved": row[12]
            }

class TestProblemReproduction(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        from app.rag import save_fallback_db
        chunks = [
            {
                "id": "chunk_cz_omni_01",
                "doc_id": "doc_cz_omni",
                "title": "CZ Omni and CZ Dialer Overview",
                "content": "CZ Omni is an enterprise omnichannel customer engagement and contact center platform supporting voice, chat, email, and social media interactions. CZ Dialer is an automated predictive, preview, and progressive dialing solution integrated into the contact center suite for high-volume outbound campaigns."
            }
        ]
        save_fallback_db(CLIENT_ID, chunks)

    def test_reproduce_email_407_single_turn_omni(self):
        """Email #407 ('infomation request' -> 'tell me about cz omni') must RAG search, score >= 80, auto-send, and 0 tickets"""
        payload = {
            "client_id": CLIENT_ID,
            "from_email": SENDER,
            "subject": "infomation request",
            "body": "tell me about cz omni",
            "message_id": f"<test-reproduce-407-{int(time.time())}@c-zentrix.com>"
        }

        t0 = time.time()
        process_email_task(payload)
        elapsed = time.time() - t0

        log = get_latest_log(CLIENT_ID, SENDER)
        print(f"\n[Test 1 Log] ID: {log.get('id')}, Score: {log.get('score')}, Status: {log.get('status')}, Steps: {log.get('execution_steps')}, Elapsed: {elapsed:.2f}s")
        print(f"Reply Excerpt:\n{(log.get('reply') or '')[:250]}...\n")

        self.assertEqual(log.get("status"), "sent")
        self.assertGreaterEqual(log.get("score") or 0, 80)
        self.assertIn("Knowledge_Search_Success", log.get("execution_steps", []))
        self.assertNotIn("Knowledge_Search_Empty", log.get("execution_steps", []))
        self.assertNotIn("escalate_and_create_ticket", str(log.get("execution_steps", [])))
        self.assertEqual(log.get("troubleshooting_step"), 0)
        self.assertNotIn("ticket #", (log.get("reply") or "").lower())
        self.assertTrue(any(w in (log.get("reply") or "").lower() for w in ["omni", "c-zentrix", "channel"]))

    def test_reproduce_thread_inquiry_with_ticket_subject(self):
        """Thread reply with subject 'Re: Ticket Update: 275424000000582153' must NOT create duplicate ticket or increment troubleshooting steps"""
        payload = {
            "client_id": CLIENT_ID,
            "from_email": SENDER,
            "subject": "Re: Ticket Update: 275424000000582153",
            "body": "tell me about cz dialer",
            "message_id": f"<test-reproduce-thread-{int(time.time())}@c-zentrix.com>"
        }

        t0 = time.time()
        process_email_task(payload)
        elapsed = time.time() - t0

        log = get_latest_log(CLIENT_ID, SENDER)
        print(f"\n[Test 2 Log] ID: {log.get('id')}, Score: {log.get('score')}, Status: {log.get('status')}, Steps: {log.get('execution_steps')}, Elapsed: {elapsed:.2f}s")
        print(f"Reply Excerpt:\n{(log.get('reply') or '')[:250]}...\n")

        self.assertEqual(log.get("status"), "sent")
        self.assertGreaterEqual(log.get("score") or 0, 80)
        self.assertIn("Knowledge_Search_Success", log.get("execution_steps", []))
        self.assertEqual(log.get("troubleshooting_step"), 0)
        self.assertTrue(any(w in (log.get("reply") or "").lower() for w in ["dialer", "outbound", "campaign"]))


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
"""
Category 6: Conversational Drift & Complex Edge Scenarios Tests.
Covers:
1. Thread Entanglement detection and Option A re-anchoring with notification note.
2. Fast 0ms gate for single-thread senders.
3. Diagnostic refusal precision vs factual observations ('No, light didn't blink').
4. Turn completion requirement before ticket creation on customer refusal.
5. Multi-intent / compound inquiry decomposition and system prompt instructions.
6. Sentiment velocity tracking & legal threat escalation to draft_mode (pending manual review).
"""

import os
import sys
import unittest
from unittest.mock import MagicMock, patch

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app.pipeline.context import PipelineContext
from app.pipeline.filters import check_diagnostic_refusal, check_legal_or_hostile_threat
from app.pipeline.evaluator import evaluate_draft_and_decide, DEFAULT_MAX_TROUBLESHOOTING_STEPS
from app.pipeline.agent import build_system_prompt, run_support_agent
from app.pipeline.router import route_intent_and_entities
from worker.tasks import check_and_resolve_thread_entanglement


class TestConversationalDrift(unittest.TestCase):

    def setUp(self):
        self.client_id = "CLI-TEST-DRIFT"
        self.from_email = "customer@domain.com"
        try:
            from app.redis_pool import get_redis_main, get_redis_history
            rm = get_redis_main()
            for key in rm.keys(f"ratelimit:sender:{self.client_id}*"):
                rm.delete(key)
            rh = get_redis_history()
            for key in rh.keys(f"chat_history:{self.client_id}*"):
                rh.delete(key)
        except Exception:
            pass

    def tearDown(self):
        try:
            from app.redis_pool import get_redis_main, get_redis_history
            rm = get_redis_main()
            for key in rm.keys(f"ratelimit:sender:{self.client_id}*"):
                rm.delete(key)
            rh = get_redis_history()
            for key in rh.keys(f"chat_history:{self.client_id}*"):
                rh.delete(key)
        except Exception:
            pass

    # ========================================================================
    # 1. Thread Entanglement Tests (Option A Re-Anchoring)
    # ========================================================================

    def test_01_single_thread_sender_bypasses_entanglement_check(self):
        """When sender has <= 1 active thread, entanglement check returns None immediately (0ms gate)."""
        mock_cursor = MagicMock()
        # Returns only 1 active thread
        mock_cursor.fetchall.return_value = [
            ("th_single_001", "Wi-Fi router down", 1)
        ]

        result = check_and_resolve_thread_entanglement(
            client_id=self.client_id,
            from_email=self.from_email,
            current_thread_id="th_single_001",
            subject="Re: Wi-Fi router down",
            body="I checked the cables.",
            cursor=mock_cursor
        )

        self.assertIsNone(result)

    def test_02_multi_thread_entanglement_reanchors_with_ticket_match(self):
        """When customer replies to Thread A but references Thread B's ticket ID, re-anchor to Thread B."""
        mock_cursor = MagicMock()
        # Returns 2 distinct active threads: Thread B subject includes ticket T-BILL-99124
        mock_cursor.fetchall.return_value = [
            ("th_tech_aaa", "Re: Router power light [Ticket #T-TECH-100]", 1),
            ("th_bill_bbb", "Invoice billing issue [Ticket #T-BILL-99124]", 0)
        ]

        # Email comes in on th_tech_aaa, but content explicitly discusses T-BILL-99124
        result = check_and_resolve_thread_entanglement(
            client_id=self.client_id,
            from_email=self.from_email,
            current_thread_id="th_tech_aaa",
            subject="Re: Router power light",
            body="Here is my payment receipt for ticket T-BILL-99124 please unlock account",
            cursor=mock_cursor
        )

        self.assertIsNotNone(result)
        self.assertTrue(result["reanchored"])
        self.assertEqual(result["target_thread_id"], "th_bill_bbb")
        self.assertEqual(result["target_step"], 0)
        self.assertEqual(result["target_ticket_id"], "T-BILL-99124")
        self.assertIn("Invoice billing issue", result["target_topic"])

    def test_03_multi_thread_entanglement_reanchors_with_subject_keywords(self):
        """When customer replies to Thread A with distinct topic keywords belonging to Thread B, re-anchor."""
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [
            ("th_outlook_aaa", "Outlook sync error", 2),
            ("th_domain_bbb", "Domain renewal transfer authorization", 0)
        ]

        # Email comes in on th_outlook_aaa, but content is about domain renewal transfer
        result = check_and_resolve_thread_entanglement(
            client_id=self.client_id,
            from_email=self.from_email,
            current_thread_id="th_outlook_aaa",
            subject="Re: Outlook sync error",
            body="Here is the renewal transfer authorization code you requested.",
            cursor=mock_cursor
        )

        self.assertIsNotNone(result)
        self.assertTrue(result["reanchored"])
        self.assertEqual(result["target_thread_id"], "th_domain_bbb")
        self.assertEqual(result["target_step"], 0)
        self.assertIn("Domain renewal transfer", result["target_topic"])

    def test_03b_direct_rfc_reply_immune_to_topic_hijacking(self):
        """When an email is matched via RFC In-Reply-To/References (is_rfc_match=True), topic hijacking is blocked."""
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [
            ("th_acd_111", "tell me about cz omni", 0),
            ("th_dialer_222", "tell me about cz dialer", 0)
        ]

        # Customer is on th_acd_111 via direct RFC reply and asks a general question without ticket ID
        result = check_and_resolve_thread_entanglement(
            client_id=self.client_id,
            from_email=self.from_email,
            current_thread_id="th_acd_111",
            subject="Re: product inquiry",
            body="what are its additional features?",
            cursor=mock_cursor,
            is_rfc_match=True
        )

        self.assertIsNone(result)

    def test_03c_quoted_history_tokens_stripped_and_ignored(self):
        """Quoted prior disclaimers and headers in email body must not trigger entanglement topic matches."""
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [
            ("th_active_aaa", "product inquiry", 0),
            ("th_dialer_bbb", "CZ dialer pacing and AMD", 0)
        ]

        # Body contains clean question at top, but quoted history below mentions candidate's keywords
        raw_body_with_quotes = (
            "what are its additional features?\n\n"
            "On Wed, Oct 21, 2026 at 12:45 PM wrote:\n"
            "> Note: We have linked your response regarding 'CZ dialer pacing and AMD'.\n"
            "> Thanks & Regards"
        )

        result = check_and_resolve_thread_entanglement(
            client_id=self.client_id,
            from_email=self.from_email,
            current_thread_id="th_active_aaa",
            subject="Re: product inquiry",
            body=raw_body_with_quotes,
            cursor=mock_cursor,
            is_rfc_match=False
        )

        # Quoted text is stripped, leaving only 'what are its additional features?' which contains no topic keywords
        self.assertIsNone(result)

    def test_03d_conversational_verbs_do_not_trigger_reanchoring(self):
        """Generic conversational words ('tell', 'about', 'what', 'more') must not match as topic keywords."""
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [
            ("th_curr_aaa", "General Question", 0),
            ("th_cand_bbb", "tell me about this product", 0)
        ]

        result = check_and_resolve_thread_entanglement(
            client_id=self.client_id,
            from_email=self.from_email,
            current_thread_id="th_curr_aaa",
            subject="Re: General Question",
            body="Can you tell me more about what you have?",
            cursor=mock_cursor,
            is_rfc_match=False
        )

        self.assertIsNone(result)

    def test_03e_resolve_thread_id_returns_tuple_compatible_thread_resolution(self):
        """resolve_thread_id must return a ThreadResolution tuple subclass compatible with 2-tuple unpacking."""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = ("th_rfc_matched", 2, None)

        from worker.tasks import resolve_thread_id, ThreadResolution
        res = resolve_thread_id(
            client_id=self.client_id,
            from_email=self.from_email,
            subject="Re: Test subject",
            in_reply_to="<parent-msg-123@domain.com>",
            cursor=mock_cursor
        )

        # Unpack as standard 2-tuple
        th_id, step = res
        self.assertEqual(th_id, "th_rfc_matched")
        self.assertEqual(step, 2)
        # Check metadata
        self.assertTrue(res.is_rfc_match)

    def test_04_option_a_note_prepended_to_final_draft(self):
        """When thread re-anchoring occurs, Option A notification note must be prepended to the final draft."""
        ctx = PipelineContext(
            task_id="task-drift-note-1",
            client_id=self.client_id,
            from_email=self.from_email,
            subject="Re: Router power light",
            body="Here is payment for invoice",
            thread_id="th_bill_bbb",
            context_data={
                "reanchored_target_topic": "Invoice billing issue (Ticket #T-BILL-99124)"
            }
        )

        with patch("app.pipeline.agent.client.chat.completions.create") as mock_chat, \
             patch("app.pipeline.agent.append_client_disclaimers", side_effect=lambda cid, d: d), \
             patch("app.pipeline.agent.evaluate_draft_and_decide", return_value=(85, "auto_send")):
            mock_resp = MagicMock()
            mock_resp.choices = [
                MagicMock(message=MagicMock(content="We have processed your billing update.", tool_calls=None))
            ]
            mock_chat.return_value = mock_resp

            result_ctx = run_support_agent(ctx)

            expected_note_prefix = "Note: We have linked your response to your ongoing inquiry regarding 'Invoice billing issue (Ticket #T-BILL-99124)' to keep your records organized.\n\n"
            self.assertTrue(result_ctx.draft_reply.startswith(expected_note_prefix))
            self.assertIn("We have processed your billing update.", result_ctx.draft_reply)

    # ========================================================================
    # 2. Diagnostic Refusal Precision & Turn Completion Tests
    # ========================================================================

    def test_05_refusal_detection_precision(self):
        """Refusal patterns trigger on active pushback but NOT on factual diagnostic observations."""
        # Active refusals -> True
        self.assertTrue(check_diagnostic_refusal("Stop asking me to reboot, just send a technician."))
        self.assertTrue(check_diagnostic_refusal("I refuse to restart the router again."))
        self.assertTrue(check_diagnostic_refusal("I'm not doing that. Send a tech."))
        self.assertTrue(check_diagnostic_refusal("Enough of these steps, talk to a human agent."))
        self.assertTrue(check_diagnostic_refusal("Stop sending steps and just fix it."))

        # Factual negative observations -> False
        self.assertFalse(check_diagnostic_refusal("No, the light did not turn green."))
        self.assertFalse(check_diagnostic_refusal("No, error 500 is still appearing."))
        self.assertFalse(check_diagnostic_refusal("I tried that, but it didn't work."))
        self.assertFalse(check_diagnostic_refusal("No change after restarting."))

    def test_06_refusal_completes_turn_before_ticket_escalation(self):
        """Customer refusal on Step 1 must complete turn progression before creating a ticket."""
        # Step 1: Customer pushes back ("Stop asking me to reboot")
        ctx = PipelineContext(
            task_id="task-refusal-1",
            client_id=self.client_id,
            from_email=self.from_email,
            subject="Router issue",
            body="Stop asking me to reboot, send a tech",
            troubleshooting_step=1  # active diagnostic turn 1
        )

        # 1. System prompt instructs empathetic de-escalation & advance, NOT immediate ticket creation
        prompt = build_system_prompt(ctx)
        # Context data was updated with refusal flag
        ctx.context_data["diagnostic_refusal_encountered"] = True
        prompt_with_refusal = build_system_prompt(ctx)
        self.assertIn("reluctance or pushback", prompt_with_refusal)
        self.assertIn("Step 2 of 3", prompt_with_refusal)
        self.assertNotIn("Diagnostic attempts are EXHAUSTED", prompt_with_refusal)

        # 2. Step 3 (Ceiling reached): turns completed -> prompt demands escalation ticket
        ctx.troubleshooting_step = DEFAULT_MAX_TROUBLESHOOTING_STEPS
        prompt_exhausted = build_system_prompt(ctx)
        self.assertIn("Diagnostic attempts are EXHAUSTED", prompt_exhausted)
        self.assertIn("escalate_and_create_ticket", prompt_exhausted)

    # ========================================================================
    # 3. Compound Intent Decomposition Tests
    # ========================================================================

    def test_07_compound_intent_decomposition_and_guidance(self):
        """Compound inquiries populate ctx.intents and inject multi-goal instructions into system prompt."""
        ctx = PipelineContext(
            task_id="task-compound-1",
            client_id=self.client_id,
            from_email=self.from_email,
            subject="Wi-Fi down and cancel subscription",
            body="My router is not working and also please cancel my annual subscription."
        )

        mock_llm_return = {
            "intent": "general_query",
            "intents": ["general_query", "ticket_status"],
            "is_compound": True,
            "sentiment": "Neutral",
            "priority": "Medium",
            "ticket_ids": []
        }

        with patch("app.pipeline.router.detect_intent_llm", return_value=mock_llm_return):
            route_intent_and_entities(ctx, f"Subject: {ctx.subject}\n\n{ctx.body}")

        self.assertEqual(ctx.intent, "general_query")
        self.assertEqual(ctx.intents, ["general_query", "ticket_status"])
        self.assertTrue(ctx.is_compound_intent)

        # Build prompt should include compound directive
        prompt = build_system_prompt(ctx)
        self.assertIn("multiple distinct intents (general_query, ticket_status)", prompt)
        self.assertIn("address each inquiry clearly in distinct sections", prompt)

    # ========================================================================
    # 4. Sentiment Velocity & Legal Threat Escalation Tests
    # ========================================================================

    def test_08_legal_hostile_threat_routes_to_manual_review(self):
        """Legal or regulatory threats trigger sentiment velocity breach, Urgent priority, and draft_mode."""
        threat_text = "I am taking you to court and filing a lawsuit with my attorney for fraud."
        self.assertTrue(check_legal_or_hostile_threat(threat_text))

        ctx = PipelineContext(
            task_id="task-legal-threat",
            client_id=self.client_id,
            from_email=self.from_email,
            subject="Legal action notice",
            body=threat_text
        )

        mock_llm_return = {
            "intent": "general_query",
            "intents": ["general_query"],
            "is_compound": False,
            "sentiment": "Angry",
            "priority": "Critical",
            "ticket_ids": []
        }

        with patch("app.pipeline.router.detect_intent_llm", return_value=mock_llm_return):
            route_intent_and_entities(ctx, f"Subject: {ctx.subject}\n\n{ctx.body}")

        self.assertEqual(ctx.priority, "Urgent")
        self.assertTrue(ctx.context_data.get("sentiment_velocity_breach"))

        # Evaluator must hold in draft_mode (pending manual review) regardless of score
        score, decision = evaluate_draft_and_decide(
            client_id=self.client_id,
            reply="We apologize for your experience.",
            query=threat_text,
            sentiment_velocity_breach=True
        )

        self.assertEqual(decision, "draft_mode")

    def test_09_sudden_hostile_sentiment_drop_from_neutral_history(self):
        """Sudden drop from Neutral in prior turn to Angry with hostile cues triggers velocity breach."""
        ctx = PipelineContext(
            task_id="task-velocity-drop",
            client_id=self.client_id,
            from_email=self.from_email,
            subject="Re: Support query",
            body="This is completely unacceptable terrible service! I demand a supervisor right now!",
            history=[
                {"role": "customer", "body": "Could you check on my request?", "meta": {"sentiment": "Neutral"}},
                {"role": "agent", "body": "We are looking into it."}
            ]
        )

        mock_llm_return = {
            "intent": "general_query",
            "intents": ["general_query"],
            "is_compound": False,
            "sentiment": "Angry",
            "priority": "High",
            "ticket_ids": []
        }

        with patch("app.pipeline.router.detect_intent_llm", return_value=mock_llm_return):
            route_intent_and_entities(ctx, f"Subject: {ctx.subject}\n\n{ctx.body}")

        self.assertEqual(ctx.priority, "Urgent")
        self.assertTrue(ctx.context_data.get("sentiment_velocity_breach"))

    def test_10_compound_intent_triage_clarification_sent(self):
        """When an incoming email contains multiple distinct intents, dispatch triage clarification."""
        from worker.tasks import process_email_task
        task_data = {
            "client_id": self.client_id,
            "from_email": self.from_email,
            "subject": "Wi-Fi down and cancel subscription",
            "body": "My router is not working and also please cancel my annual subscription."
        }

        mock_llm_return = {
            "intent": "general_query",
            "intents": ["general_query", "ticket_status"],
            "is_compound": True,
            "sentiment": "Neutral",
            "priority": "Medium",
            "ticket_ids": []
        }

        with patch("worker.tasks.get_db_ctx") as mock_db, \
             patch("worker.tasks.send_email") as mock_send, \
             patch("app.pipeline.router.detect_intent_llm", return_value=mock_llm_return), \
             patch("worker.tasks._finalize_task_and_log") as mock_finalize:
            
            mock_cur = MagicMock()
            mock_cur.fetchone.return_value = None
            mock_cur.fetchall.return_value = []
            mock_db.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value = mock_cur

            process_email_task(task_data)

            mock_send.assert_called_once()
            call_args = mock_send.call_args[0]
            self.assertEqual(call_args[0], self.client_id)
            self.assertEqual(call_args[1], self.from_email)
            self.assertIn("which inquiry you would like us to resolve first", call_args[3])
            self.assertIn("Technical troubleshooting", call_args[3])
            self.assertIn("Status tracking", call_args[3])


if __name__ == "__main__":
    unittest.main()


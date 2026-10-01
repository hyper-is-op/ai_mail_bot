import unittest
import json
from unittest.mock import MagicMock, patch
from datetime import datetime

from app.pipeline.context import PipelineContext
from app.pipeline.agent import run_support_agent, check_customer_resolution
from app.pipeline.evaluator import evaluate_draft_and_decide
from app.pipeline.tools import execute_tool_call
from app.pipeline.filters import apply_deterministic_filters
from worker.tasks import process_email_task, resolve_thread_id

run_task = process_email_task.run.__func__


class TestBackAndForthScenarios(unittest.TestCase):

    # =========================================================================
    # SCENARIO 1: Multi-Turn Diagnostic Troubleshooting Progression to Escalation
    # =========================================================================
    @patch("app.pipeline.tools.fetch_rag_context")
    def test_scenario_01_diagnostic_progression_to_escalation(self, mock_rag):
        client_id = "CLI-TEST-01"
        from_email = "alex@enterprise.com"
        subject = "Outlook Sync Failure"
        thread_id = "th_sync_diag_01"

        mock_rag.return_value = ("Troubleshooting: Step 1 clear cache. Step 2 re-add account. Step 3 re-install.", True, "rag_01")

        # Turn 1: Inbound complaint -> Step 1 delivered
        ctx1 = PipelineContext.from_task_data("task-t1", {
            "client_id": client_id, "from_email": from_email, "subject": subject,
            "body": "Outlook sync gives error 0x8004010F repeatedly.",
            "thread_id": thread_id, "troubleshooting_step": 0, "is_resolved": False, "history": []
        })
        tc1 = MagicMock()
        tc1.id = "c1"
        tc1.function.name = "search_knowledge_base"
        tc1.function.arguments = json.dumps({"query": "Outlook 0x8004010F cache"})

        r1_t1 = MagicMock(choices=[MagicMock(message=MagicMock(content="", tool_calls=[tc1]))])
        r2_t1 = MagicMock(choices=[MagicMock(message=MagicMock(
            content="Dear Alex,\n\nPlease clear your local Outlook cache and restart the client.\n\nThanks & Regards,\nSupport Team",
            tool_calls=None
        ))])

        with patch("app.pipeline.agent.client") as mock_llm:
            mock_llm.chat.completions.create.side_effect = [r1_t1, r2_t1]
            res1 = run_support_agent(ctx1)
            self.assertEqual(res1.troubleshooting_step, 1)
            self.assertFalse(res1.is_resolved)
            self.assertIn("clear your local Outlook cache", res1.draft_reply)

        # Turn 2: Customer replies Step 1 failed -> Step 2 delivered
        history_t2 = [
            {"role": "customer", "body": "Outlook sync gives error 0x8004010F repeatedly."},
            {"role": "assistant", "body": res1.draft_reply}
        ]
        ctx2 = PipelineContext.from_task_data("task-t2", {
            "client_id": client_id, "from_email": from_email, "subject": f"Re: {subject}",
            "body": "Cleared cache as instructed, but the same error 0x8004010F occurs.",
            "thread_id": thread_id, "troubleshooting_step": 1, "is_resolved": False, "history": history_t2
        })
        tc2 = MagicMock()
        tc2.id = "c2"
        tc2.function.name = "search_knowledge_base"
        tc2.function.arguments = json.dumps({"query": "Outlook 0x8004010F re-add account"})

        r1_t2 = MagicMock(choices=[MagicMock(message=MagicMock(content="", tool_calls=[tc2]))])
        r2_t2 = MagicMock(choices=[MagicMock(message=MagicMock(
            content="Dear Alex,\n\nSince clearing the cache did not help, please remove and re-add your email profile.\n\nThanks & Regards,\nSupport Team",
            tool_calls=None
        ))])

        with patch("app.pipeline.agent.client") as mock_llm:
            mock_llm.chat.completions.create.side_effect = [r1_t2, r2_t2]
            res2 = run_support_agent(ctx2)
            self.assertEqual(res2.troubleshooting_step, 2)
            self.assertFalse(res2.is_resolved)
            self.assertIn("remove and re-add your email profile", res2.draft_reply)

        # Turn 3: Customer replies Step 2 failed -> Step 3 delivered
        history_t3 = history_t2 + [
            {"role": "customer", "body": "Re-added profile, still completely broken."},
            {"role": "assistant", "body": res2.draft_reply}
        ]
        ctx3 = PipelineContext.from_task_data("task-t3", {
            "client_id": client_id, "from_email": from_email, "subject": f"Re: {subject}",
            "body": "Re-added profile, still completely broken.",
            "thread_id": thread_id, "troubleshooting_step": 2, "is_resolved": False, "history": history_t3
        })
        tc3 = MagicMock()
        tc3.id = "c3"
        tc3.function.name = "search_knowledge_base"
        tc3.function.arguments = json.dumps({"query": "Outlook 0x8004010F re-install"})

        r1_t3 = MagicMock(choices=[MagicMock(message=MagicMock(content="", tool_calls=[tc3]))])
        r2_t3 = MagicMock(choices=[MagicMock(message=MagicMock(
            content="Dear Alex,\n\nAs a final step, please reinstall the sync utility.\n\nThanks & Regards,\nSupport Team",
            tool_calls=None
        ))])

        with patch("app.pipeline.agent.client") as mock_llm:
            mock_llm.chat.completions.create.side_effect = [r1_t3, r2_t3]
            res3 = run_support_agent(ctx3)
            self.assertEqual(res3.troubleshooting_step, 3)

        # Turn 4: Step 3 failed -> Ceiling reached -> Escalation tool triggered
        history_t4 = history_t3 + [
            {"role": "customer", "body": "Reinstallation did not fix it either. I need an engineer."},
            {"role": "assistant", "body": res3.draft_reply}
        ]
        ctx4 = PipelineContext.from_task_data("task-t4", {
            "client_id": client_id, "from_email": from_email, "subject": f"Re: {subject}",
            "body": "Reinstallation did not fix it either. I need an engineer.",
            "thread_id": thread_id, "troubleshooting_step": 3, "is_resolved": False, "history": history_t4
        })

        with patch("app.pipeline.tools.create_ticket_and_reply") as mock_ticket:
            mock_ticket.return_value = ("Support ticket T-260930-00101 created", "T-260930-00101", "ticket_created_and_sent")
            res_escalate = execute_tool_call("escalate_and_create_ticket", {
                "issue_summary": "Outlook sync 0x8004010F exhausted 3 diagnostic steps",
                "priority": "High"
            }, ctx4)
            self.assertEqual(res_escalate.get("status"), "ticket_created")
            self.assertEqual(res_escalate.get("ticket_id"), "T-260930-00101")
            ticket_ctx = mock_ticket.call_args[1].get("context", "")
            self.assertIn("Troubleshooting History:", ticket_ctx)
            self.assertIn("reinstall the sync utility", ticket_ctx)

    # =========================================================================
    # SCENARIO 2: Mid-Dialogue Resolution Confirmation (Closure without Ticket)
    # =========================================================================
    def test_scenario_02_resolution_confirmation_suppresses_escalation(self):
        self.assertTrue(check_customer_resolution("Thank you, that worked!"))
        self.assertTrue(check_customer_resolution("all good now, issue is resolved"))
        self.assertTrue(check_customer_resolution("that helped, problem is fixed"))

        ctx = PipelineContext.from_task_data("task-res", {
            "client_id": "CLI-TEST-02", "from_email": "customer@abc.com",
            "subject": "Re: Printer issue", "body": "That did it! The printer is working properly now, thank you so much.",
            "thread_id": "th_printer_01", "troubleshooting_step": 1, "is_resolved": False,
            "history": [
                {"role": "customer", "body": "Printer not printing"},
                {"role": "assistant", "body": "Please power-cycle the print spooler"}
            ]
        })

        with patch("app.pipeline.agent.client") as mock_llm:
            mock_llm.chat.completions.create.return_value = MagicMock(
                choices=[MagicMock(
                    message=MagicMock(content="Dear Customer,\n\nGlad to hear your printer is back up and running! Have a great day.\n\nThanks & Regards,\nSupport Team", tool_calls=None)
                )]
            )
            res_ctx = run_support_agent(ctx)
            self.assertTrue(res_ctx.is_resolved)
            self.assertEqual(res_ctx.score, 95)
            self.assertEqual(res_ctx.response_action, "auto_send")

        score, decision = evaluate_draft_and_decide(
            client_id="CLI-TEST-02", reply=res_ctx.draft_reply, query=res_ctx.body,
            context_succeeded=True, is_resolved=True
        )
        self.assertEqual(decision, "auto_send")
        self.assertEqual(score, 95)

    # =========================================================================
    # SCENARIO 3A: Disambiguation Clarification (Multi-Reference Ambiguity)
    # =========================================================================
    @patch("worker.tasks.send_email")
    @patch("worker.tasks.get_db_ctx")
    def test_scenario_03a_multi_reference_ambiguity_clarification(self, mock_db_ctx, mock_send):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_cur.fetchone.return_value = None  # No existing task
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_db_ctx.return_value.__enter__.return_value = mock_conn

        task_payload = {
            "client_id": "CLI-TEST-03A",
            "from_email": "client@multi-order.com",
            "subject": "Status on my orders",
            "body": "Can you check what happened to ticket T-260505-00117 and order ORD-99124?",
            "message_id": "<msg-multi-01@domain.com>"
        }

        mock_self = MagicMock()
        mock_self.request.id = "task-multi-id"

        run_task(mock_self, task_payload)

        # Must send clarification email asking customer to choose
        mock_send.assert_called_once()
        call_args = mock_send.call_args[0]
        self.assertEqual(call_args[0], "CLI-TEST-03A")
        self.assertEqual(call_args[1], "client@multi-order.com")
        self.assertIn("multiple ticket/order IDs", call_args[3])
        self.assertIn("T-260505-00117", call_args[3])
        self.assertIn("ORD-99124", call_args[3])

    # =========================================================================
    # SCENARIO 3B: Reference Not Found Clarification (No Escalation)
    # =========================================================================
    @patch("app.pipeline.tools.fetch_crm_order_status")
    def test_scenario_03b_reference_not_found_clarification(self, mock_order_lookup):
        mock_order_lookup.return_value = {
            "success": False,
            "not_found": True,
            "error": "No matching order record found for 99999"
        }

        ctx = PipelineContext.from_task_data("task-notfound", {
            "client_id": "CLI-TEST-03B", "from_email": "shopper@domain.com",
            "subject": "Where is my order #99999?", "body": "Where is my order #99999?",
            "thread_id": "th_order_nf"
        })

        res_tool = execute_tool_call("lookup_order_status", {"order_id": "99999"}, ctx)
        self.assertEqual(res_tool.get("status"), "not_found")

        # Evaluator delivers clarification request when is_not_found is True and score >= 50
        clarification_draft = "Dear Customer,\n\nWe could not find order #99999 in our records. Please verify the order number.\n\nThanks & Regards,\nSupport Team"
        score, decision = evaluate_draft_and_decide(
            client_id="CLI-TEST-03B",
            reply=clarification_draft,
            query="Where is my order #99999?",
            context_succeeded=True,
            is_not_found=True
        )
        self.assertEqual(decision, "auto_send")
        self.assertGreaterEqual(score, 50)

    # =========================================================================
    # SCENARIO 4: Status Inquiry & Follow-up on Active Ticket
    # =========================================================================
    @patch("app.pipeline.tools.fetch_crm_ticket_status")
    def test_scenario_04_active_ticket_status_inquiry(self, mock_ticket_lookup):
        mock_ticket_lookup.return_value = {
            "success": True,
            "status": "found",
            "data": {
                "ticket_id": "T-260526-00431",
                "ticket_status": "In Progress",
                "assigned_to": "Tier-2 Operations",
                "agent_remarks": "Awaiting shipment confirmation from vendor warehouse."
            }
        }

        ctx = PipelineContext.from_task_data("task-tkt-inquiry", {
            "client_id": "CLI-TEST-04", "from_email": "user@corp.com",
            "subject": "Status update on T-260526-00431",
            "body": "Hi, any update on my open ticket T-260526-00431?",
            "thread_id": "th_tkt_431"
        })

        res_tool = execute_tool_call("lookup_ticket_status", {"ticket_id": "T-260526-00431"}, ctx)
        self.assertEqual(res_tool.get("status"), "found")
        self.assertEqual(res_tool.get("details", {}).get("ticket_status"), "In Progress")
        self.assertIn("Awaiting shipment", res_tool.get("details", {}).get("agent_remarks"))

    # =========================================================================
    # SCENARIO 5: Draft Review Mode (feature_auto_send = False)
    # =========================================================================
    @patch("app.draft_service.create_draft")
    @patch("app.mailer.send_email")
    def test_scenario_05_draft_review_mode_saves_to_draft_emails(self, mock_send, mock_create_draft):
        mock_create_draft.return_value = 42

        from app.pipeline.dispatcher import dispatch_or_draft_reply
        features = {"feature_auto_send": False}

        status, save_history = dispatch_or_draft_reply(
            client_id="CLI-TEST-05",
            from_email="user@draft.com",
            subject="Billing question",
            reply_body="Dear User, we have credited $15 back to your account.",
            features=features,
            confidence_score=85,
            intent="billing_inquiry"
        )

        self.assertEqual(status, "draft_created")
        self.assertFalse(save_history)
        mock_send.assert_not_called()
        mock_create_draft.assert_called_once()
        kwargs = mock_create_draft.call_args[1]
        self.assertEqual(kwargs["client_id"], "CLI-TEST-05")
        self.assertIn("credited $15", kwargs["draft_reply"])

    # =========================================================================
    # SCENARIO 6: Loop Suppression Guardrails (Bounces & Rate Limits)
    # =========================================================================
    def test_scenario_06_loop_suppression_guardrails(self):
        # 1. Mailer-daemon bounce drop
        ctx_bounce = PipelineContext.from_task_data("t-bounce", {
            "client_id": "CLI-GUARD",
            "from_email": "mailer-daemon@mx.google.com",
            "subject": "Undelivered Mail Returned to Sender",
            "body": "550 User unknown"
        })
        cursor = MagicMock()
        halted = apply_deterministic_filters(ctx_bounce, cursor)
        self.assertTrue(halted)
        self.assertEqual(ctx_bounce.status, "system_bounce_dropped")

        # 2. Rate limit halt (>30 emails/hr)
        with patch("app.rate_limiter.check_sender_rate_limit") as mock_rate:
            mock_rate.return_value = (False, 35)
            ctx_flood = PipelineContext.from_task_data("t-flood", {
                "client_id": "CLI-GUARD",
                "from_email": "spammer@botnet.com",
                "subject": "Looping email",
                "body": "Ping"
            })
            halted_rate = apply_deterministic_filters(ctx_flood, cursor)
            self.assertTrue(halted_rate)
            self.assertEqual(ctx_flood.status, "rate_limited")


if __name__ == "__main__":
    unittest.main()

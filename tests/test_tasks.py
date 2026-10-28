import unittest
from unittest.mock import MagicMock, patch
from app.pipeline.context import PipelineContext
from worker.tasks import (
    process_email_task,
    get_client_features,
    generate_and_save_summary,
    _finalize_task_and_log
)

run_task = process_email_task.run.__func__


class TestWorkerTasks(unittest.TestCase):

    def setUp(self):
        try:
            from app.rate_limiter import get_redis_client
            r = get_redis_client()
            if r:
                r.delete("ratelimit:sender:CLI-TEST:customer@example.com")
        except Exception:
            pass

    def test_01_idempotent_task_skip(self):
        """Completed task in celery_task_log must exit immediately without executing agent"""
        mock_self = MagicMock()
        mock_self.request.id = "task-already-completed-123"

        mock_db = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.__enter__.return_value = mock_cursor
        mock_db.cursor.return_value = mock_cursor
        # Return ('completed',) from celery_task_log check
        mock_cursor.fetchone.return_value = ("completed",)

        mock_ctx = MagicMock()
        mock_ctx.__enter__.return_value = mock_db

        with patch("worker.tasks.get_db_ctx", return_value=mock_ctx), \
             patch("worker.tasks.run_support_agent") as mock_agent:
            run_task(mock_self, {
                "client_id": "CLI-TEST",
                "from_email": "user@example.com",
                "subject": "Test already done",
                "body": "Test message"
            })
            # Agent must never be called for already completed task
            mock_agent.assert_not_called()

    def test_02_deterministic_filter_early_exit(self):
        """Daemon/bounce message must halt early and finalize without calling agent loop"""
        mock_self = MagicMock()
        mock_self.request.id = "task-daemon-bounce-456"

        mock_db = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.__enter__.return_value = mock_cursor
        mock_db.cursor.return_value = mock_cursor
        mock_cursor.fetchone.return_value = None  # Not existing in task log
        mock_cursor.lastrowid = 999

        mock_ctx = MagicMock()
        mock_ctx.__enter__.return_value = mock_db

        with patch("worker.tasks.get_db_ctx", return_value=mock_ctx), \
             patch("worker.tasks.publish_email_update"), \
             patch("worker.tasks.run_support_agent") as mock_agent:
            run_task(mock_self, {
                "client_id": "CLI-TEST",
                "from_email": "mailer-daemon@googlemail.com",
                "subject": "Delivery Failure",
                "body": "Message could not be delivered"
            })
            # Agent loop must not be executed
            mock_agent.assert_not_called()

    def test_03_no_connection_held_during_agent(self):
        """Verify database connection context is closed before running agent loop"""
        mock_self = MagicMock()
        mock_self.request.id = "task-active-789"

        preflight_db = MagicMock()
        preflight_cursor = MagicMock()
        preflight_cursor.__enter__.return_value = preflight_cursor
        preflight_db.cursor.return_value = preflight_cursor
        preflight_cursor.fetchone.return_value = None

        final_db = MagicMock()
        final_cursor = MagicMock()
        final_cursor.__enter__.return_value = final_cursor
        final_db.cursor.return_value = final_cursor
        final_cursor.lastrowid = 1001

        preflight_ctx = MagicMock()
        preflight_ctx.__enter__.return_value = preflight_db

        final_ctx = MagicMock()
        final_ctx.__enter__.return_value = final_db

        preflight_exited = False

        def on_preflight_exit(*args):
            nonlocal preflight_exited
            preflight_exited = True

        preflight_ctx.__exit__.side_effect = on_preflight_exit

        agent_saw_db_closed = False

        def mock_agent_exec(ctx, cursor=None):
            nonlocal agent_saw_db_closed
            # When agent executes, preflight DB context must have already exited!
            agent_saw_db_closed = preflight_exited
            ctx.status = "draft_mode"
            ctx.draft_reply = "Automated reply"
            return ctx

        with patch("worker.tasks.get_db_ctx", side_effect=[preflight_ctx, final_ctx]), \
             patch("worker.tasks.get_history", return_value=[]), \
             patch("worker.tasks.dispatch_or_draft_reply", return_value=("sent", True)), \
             patch("worker.tasks.publish_email_update"), \
             patch("worker.tasks.run_support_agent", side_effect=mock_agent_exec):
            run_task(mock_self, {
                "client_id": "CLI-TEST",
                "from_email": "customer@example.com",
                "subject": "Order assistance",
                "body": "I need help with my order."
            })

            self.assertTrue(agent_saw_db_closed, "Agent executed while pre-flight DB connection was still held!")

    def test_04_fatal_error_poison_pill(self):
        """Exhausted retries must trigger circuit breaker and write fatal_processing_error"""
        mock_self = MagicMock()
        mock_self.request.id = "task-poison-pill"
        mock_self.request.retries = 2
        mock_self.max_retries = 2

        mock_db = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.__enter__.return_value = mock_cursor
        mock_db.cursor.return_value = mock_cursor
        mock_cursor.fetchone.return_value = None

        mock_ctx = MagicMock()
        mock_ctx.__enter__.return_value = mock_db

        with patch("worker.tasks.get_db_ctx", return_value=mock_ctx), \
             patch("worker.tasks.publish_email_update"):
            res = run_task(mock_self, {
                "client_id": "CLI-TEST",
                "from_email": "toxic@example.com",
                "subject": "Poison Pill",
                "body": "Crash",
                "__test_fatal_error__": True
            })

            self.assertEqual(res.get("status"), "fatal_processing_error")
            # Verify fatal error written to celery_task_log
            calls = [str(c) for c in mock_cursor.execute.call_args_list]
            self.assertTrue(any("fatal_processing_error" in c for c in calls))

    def test_05_summary_generation_isolated_db(self):
        """generate_and_save_summary must read history, call LLM without connection, and save result"""
        read_db = MagicMock()
        read_cursor = MagicMock()
        read_cursor.__enter__.return_value = read_cursor
        read_db.cursor.return_value = read_cursor
        read_cursor.fetchall.return_value = [
            ("Previous customer message", "Previous support reply", "Prior summary")
        ]

        write_db = MagicMock()
        write_cursor = MagicMock()
        write_cursor.__enter__.return_value = write_cursor
        write_db.cursor.return_value = write_cursor

        read_ctx = MagicMock()
        read_ctx.__enter__.return_value = read_db

        write_ctx = MagicMock()
        write_ctx.__enter__.return_value = write_db

        with patch("worker.tasks.get_db_ctx", side_effect=[read_ctx, write_ctx]), \
             patch("worker.tasks.generate_summary_llm", return_value="Fresh generated summary") as mock_llm:
            generate_and_save_summary(
                log_id=555,
                data={"client_id": "CLI-TEST", "from_email": "sender@test.com", "body": "Latest query"},
                context_text="RAG policy"
            )

            mock_llm.assert_called_once()
            write_cursor.execute.assert_called_with(
                "UPDATE email_logs SET summary = %s WHERE id = %s",
                ("Fresh generated summary", 555)
            )

    def test_06_embed_service_gate_immediate_healthy(self):
        """Readiness gate must proceed immediately when embed_service is already healthy"""
        from worker.celery_worker import wait_for_embed_service_ready

        with patch("app.embed_client.embed_service_healthy", return_value=True) as mock_healthy, \
             patch("time.sleep") as mock_sleep:
            wait_for_embed_service_ready()
            mock_healthy.assert_called_once()
            mock_sleep.assert_not_called()

    def test_07_embed_service_gate_retry_then_succeed(self):
        """Readiness gate must poll and succeed once embed_service finishes loading"""
        from worker.celery_worker import wait_for_embed_service_ready

        # Returns False on first check, False on attempt 1, True on attempt 2
        with patch("app.embed_client.embed_service_healthy", side_effect=[False, False, True]) as mock_healthy, \
             patch("time.sleep") as mock_sleep:
            wait_for_embed_service_ready()
            self.assertEqual(mock_healthy.call_count, 3)
            self.assertEqual(mock_sleep.call_count, 2)

    def test_08_embed_service_gate_timeout_degrades(self):
        """Readiness gate must timeout and fall back to degraded mode after max_wait_seconds"""
        from worker.celery_worker import wait_for_embed_service_ready

        # Always unhealthy
        with patch("app.embed_client.embed_service_healthy", return_value=False) as mock_healthy, \
             patch("time.sleep") as mock_sleep:
            wait_for_embed_service_ready()
            # 1 initial check + 30 polls (max_wait_seconds=60, poll_interval=2)
            self.assertEqual(mock_healthy.call_count, 31)
            self.assertEqual(mock_sleep.call_count, 30)

    def test_09_off_topic_rag_override_routes_to_agent(self):
        """High-confidence RAG match must override off_topic_nonsense and invoke agent loop"""
        mock_self = MagicMock()
        mock_self.request.id = "task-rag-override-1"

        preflight_db = MagicMock()
        preflight_cursor = MagicMock()
        preflight_cursor.__enter__.return_value = preflight_cursor
        preflight_db.cursor.return_value = preflight_cursor
        preflight_cursor.fetchone.return_value = None

        final_db = MagicMock()
        final_cursor = MagicMock()
        final_cursor.__enter__.return_value = final_cursor
        final_db.cursor.return_value = final_cursor
        final_cursor.lastrowid = 1002

        preflight_ctx = MagicMock()
        preflight_ctx.__enter__.return_value = preflight_db
        final_ctx = MagicMock()
        final_ctx.__enter__.return_value = final_db

        def mock_agent_exec(ctx, cursor=None):
            self.assertEqual(ctx.intent, "general_query")
            ctx.status = "sent"
            ctx.draft_reply = "Product details"
            return ctx

        def mock_router(ctx, text):
            ctx.intent = "off_topic_nonsense"

        mock_rag_hit = [{"title": "CZ CallBlast Overview", "score": 0.88, "content": "CZ CallBlast is an automated voice broadcasting tool."}]

        with patch("worker.tasks.get_db_ctx", side_effect=[preflight_ctx, final_ctx]), \
             patch("worker.tasks.get_history", return_value=[]), \
             patch("app.pipeline.router.route_intent_and_entities", side_effect=mock_router), \
             patch("app.rag.retrieve_knowledge", return_value=mock_rag_hit), \
             patch("worker.tasks.dispatch_or_draft_reply", return_value=("sent", True)), \
             patch("worker.tasks.publish_email_update"), \
             patch("worker.tasks.run_support_agent", side_effect=mock_agent_exec) as mock_agent:
            run_task(mock_self, {
                "client_id": "CLI-TEST",
                "from_email": "inquirer@example.com",
                "subject": "Tell me about cz callblast",
                "body": "Tell me about cz callblast"
            })

            mock_agent.assert_called_once()

    def test_10_off_topic_confirmed_sends_polite_reply(self):
        """Confirmed off-topic message with low RAG score must send polite redirect and halt"""
        mock_self = MagicMock()
        mock_self.request.id = "task-off-topic-reply-2"

        preflight_db = MagicMock()
        preflight_cursor = MagicMock()
        preflight_cursor.__enter__.return_value = preflight_cursor
        preflight_db.cursor.return_value = preflight_cursor
        preflight_cursor.fetchone.return_value = None

        final_db = MagicMock()
        final_cursor = MagicMock()
        final_cursor.__enter__.return_value = final_cursor
        final_db.cursor.return_value = final_cursor
        final_cursor.lastrowid = 1003

        preflight_ctx = MagicMock()
        preflight_ctx.__enter__.return_value = preflight_db
        final_ctx = MagicMock()
        final_ctx.__enter__.return_value = final_db

        def mock_router(ctx, text):
            ctx.intent = "off_topic_nonsense"

        with patch("worker.tasks.get_db_ctx", side_effect=[preflight_ctx, final_ctx]), \
             patch("worker.tasks.get_history", return_value=[]), \
             patch("app.pipeline.router.route_intent_and_entities", side_effect=mock_router), \
             patch("app.rag.retrieve_knowledge", return_value=[]), \
             patch("worker.tasks.generate_off_topic_reply", return_value="Polite redirect message") as mock_ot_reply, \
             patch("worker.tasks.send_email", return_value=True) as mock_send, \
             patch("worker.tasks.publish_email_update"), \
             patch("worker.tasks.run_support_agent") as mock_agent:
            run_task(mock_self, {
                "client_id": "CLI-TEST",
                "from_email": "spammer@example.com",
                "subject": "Random hello",
                "body": "asdfghjkl"
            })

            mock_agent.assert_not_called()
            mock_ot_reply.assert_called_once()
            mock_send.assert_called_once()

    def test_11_rag_miss_routes_to_pending_review(self):
        """Inquiry with response_action='draft_mode' must finalize as pending_manual_review and create draft"""
        mock_self = MagicMock()
        mock_self.request.id = "task-rag-miss-pending-123"

        preflight_db = MagicMock()
        preflight_cursor = MagicMock()
        preflight_cursor.__enter__.return_value = preflight_cursor
        preflight_db.cursor.return_value = preflight_cursor
        preflight_cursor.fetchone.return_value = None

        final_db = MagicMock()
        final_cursor = MagicMock()
        final_cursor.__enter__.return_value = final_cursor
        final_db.cursor.return_value = final_cursor
        final_cursor.lastrowid = 1004

        preflight_ctx = MagicMock()
        preflight_ctx.__enter__.return_value = preflight_db
        final_ctx = MagicMock()
        final_ctx.__enter__.return_value = final_db

        def mock_agent_loop(ctx, cursor=None):
            ctx.draft_reply = "Here is high level info about our product."
            ctx.response_action = "draft_mode"
            ctx.intent = "general_query"
            ctx.score = 50
            return ctx

        with patch("worker.tasks.get_db_ctx", side_effect=[preflight_ctx, final_ctx]), \
             patch("worker.tasks.get_history", return_value=[]), \
             patch("worker.tasks.run_support_agent", side_effect=mock_agent_loop), \
             patch("worker.tasks.send_email") as mock_send, \
             patch("app.draft_service.create_draft") as mock_create_draft, \
             patch("worker.tasks.push_message") as mock_push, \
             patch("worker.tasks.publish_email_update"):
            run_task(mock_self, {
                "client_id": "CLI-TEST",
                "from_email": "prospect@example.com",
                "subject": "Tell me about Model X specs",
                "body": "Does Model X support 220V power input?"
            })

            # Must NOT auto-send via SMTP
            mock_send.assert_not_called()
            # Must auto-create draft in draft_emails for operator review
            mock_create_draft.assert_called_once()
            call_kwargs = mock_create_draft.call_args[1]
            self.assertEqual(call_kwargs["client_id"], "CLI-TEST")
            self.assertEqual(call_kwargs["email_log_id"], 1004)
            self.assertEqual(call_kwargs["intent"], "general_query")
            # Push message should record customer question in conversation history
            mock_push.assert_called_once()

    def test_12_marketing_promotional_dropped_despite_history(self):
        """Marketing promotional blast must be dropped without reply even when prior history exists"""
        mock_self = MagicMock()
        mock_self.request.id = "task-marketing-history-drop-1"

        preflight_db = MagicMock()
        preflight_cursor = MagicMock()
        preflight_cursor.__enter__.return_value = preflight_cursor
        preflight_db.cursor.return_value = preflight_cursor
        preflight_cursor.fetchone.return_value = None

        final_db = MagicMock()
        final_cursor = MagicMock()
        final_cursor.__enter__.return_value = final_cursor
        final_db.cursor.return_value = final_cursor
        final_cursor.lastrowid = 1005

        preflight_ctx = MagicMock()
        preflight_ctx.__enter__.return_value = preflight_db
        final_ctx = MagicMock()
        final_ctx.__enter__.return_value = final_db

        def mock_router(ctx, text):
            ctx.intent = "marketing_promotional"

        prior_history = [{"role": "customer", "body": "Previous promotional email"}]

        with patch("worker.tasks.get_db_ctx", side_effect=[preflight_ctx, final_ctx]), \
             patch("worker.tasks.get_history", return_value=prior_history), \
             patch("app.pipeline.router.route_intent_and_entities", side_effect=mock_router), \
             patch("worker.tasks.send_email") as mock_send, \
             patch("worker.tasks.run_support_agent") as mock_agent, \
             patch("worker.tasks.publish_email_update"):
            run_task(mock_self, {
                "client_id": "CLI-TEST",
                "from_email": "student@internshala.com",
                "subject": "Update: Study in UK 24 October",
                "body": "Register now for the fair"
            })

            mock_send.assert_not_called()
            mock_agent.assert_not_called()

    def test_13_multi_id_clarification_loop_bypassed(self):
        """When prior message was a clarification, multi-ID query must bypass clarification and prioritize primary ID"""
        mock_self = MagicMock()
        mock_self.request.id = "task-multi-id-bypass-1"

        preflight_db = MagicMock()
        preflight_cursor = MagicMock()
        preflight_cursor.__enter__.return_value = preflight_cursor
        preflight_db.cursor.return_value = preflight_cursor
        preflight_cursor.fetchone.return_value = None

        final_db = MagicMock()
        final_cursor = MagicMock()
        final_cursor.__enter__.return_value = final_cursor
        final_db.cursor.return_value = final_cursor
        final_cursor.lastrowid = 1006

        preflight_ctx = MagicMock()
        preflight_ctx.__enter__.return_value = preflight_db
        final_ctx = MagicMock()
        final_ctx.__enter__.return_value = final_db

        prior_clarification_history = [
            {"role": "customer", "body": "Check ticket T-260505-00117 and order ORD-10294"},
            {"role": "support", "body": "We noticed multiple ticket/order IDs... which would you like us to look into?", "meta": '{"action": "clarification_sent"}'}
        ]

        def mock_agent_loop(ctx, cursor=None):
            ctx.status = "sent"
            ctx.draft_reply = "Looking into your ticket."
            return ctx

        with patch("worker.tasks.get_db_ctx", side_effect=[preflight_ctx, final_ctx]), \
             patch("worker.tasks.get_history", return_value=prior_clarification_history), \
             patch("worker.tasks.run_support_agent", side_effect=mock_agent_loop) as mock_agent, \
             patch("worker.tasks.send_email") as mock_send, \
             patch("worker.tasks.publish_email_update"):
            run_task(mock_self, {
                "client_id": "CLI-TEST",
                "from_email": "customer@example.com",
                "subject": "Re: Support",
                "body": "I said check both T-260505-00117 and order ORD-10294!"
            })

            # Must NOT send clarification email again!
            # mock_send should not be called with the clarification template
            clarification_sent_calls = [
                call for call in mock_send.call_args_list
                if "clarify which" in str(call).lower() or "multiple ticket" in str(call).lower()
            ]
            self.assertEqual(len(clarification_sent_calls), 0)
            # Must proceed to support agent
            mock_agent.assert_called_once()
            passed_ctx = mock_agent.call_args[0][0]
            self.assertEqual(passed_ctx.ticket_id, "T-260505-00117")
            self.assertTrue(any("Clarification_Loop_Bypassed" in s for s in passed_ctx.execution_steps))

    def test_14_compound_intent_clarification_loop_bypassed(self):
        """When prior message was clarification, compound intent inquiry must prioritize dominant intent"""
        mock_self = MagicMock()
        mock_self.request.id = "task-compound-bypass-1"

        preflight_db = MagicMock()
        preflight_cursor = MagicMock()
        preflight_cursor.__enter__.return_value = preflight_cursor
        preflight_db.cursor.return_value = preflight_cursor
        preflight_cursor.fetchone.return_value = None

        final_db = MagicMock()
        final_cursor = MagicMock()
        final_cursor.__enter__.return_value = final_cursor
        final_db.cursor.return_value = final_cursor
        final_cursor.lastrowid = 1007

        preflight_ctx = MagicMock()
        preflight_ctx.__enter__.return_value = preflight_db
        final_ctx = MagicMock()
        final_ctx.__enter__.return_value = final_db

        prior_clarification_history = [
            {"role": "customer", "body": "Login broken and refund request"},
            {"role": "support", "body": "We noticed multiple distinct inquiries... which to resolve first?", "meta": '{"action": "clarification_sent"}'}
        ]

        def mock_router(ctx, text):
            ctx.intent = "general_query"
            ctx.intents = ["general_query", "technical_support", "refund"]
            ctx.is_compound_intent = True

        def mock_agent_loop(ctx, cursor=None):
            ctx.status = "sent"
            ctx.draft_reply = "Troubleshooting your technical issue."
            return ctx

        with patch("worker.tasks.get_db_ctx", side_effect=[preflight_ctx, final_ctx]), \
             patch("worker.tasks.get_history", return_value=prior_clarification_history), \
             patch("app.pipeline.router.route_intent_and_entities", side_effect=mock_router), \
             patch("worker.tasks.run_support_agent", side_effect=mock_agent_loop) as mock_agent, \
             patch("worker.tasks.send_email") as mock_send, \
             patch("worker.tasks.publish_email_update"):
            run_task(mock_self, {
                "client_id": "CLI-TEST",
                "from_email": "customer@example.com",
                "subject": "Re: Support",
                "body": "Fix both login broken and refund my subscription!"
            })

            # Must NOT send triage clarification email
            triage_calls = [
                call for call in mock_send.call_args_list
                if "which inquiry" in str(call).lower() or "multiple distinct inquiries" in str(call).lower()
            ]
            self.assertEqual(len(triage_calls), 0)
            mock_agent.assert_called_once()
            passed_ctx = mock_agent.call_args[0][0]
            # Dominant intent must be technical_support over refund/general_query
            self.assertEqual(passed_ctx.intent, "technical_support")
            self.assertFalse(passed_ctx.is_compound_intent)
            self.assertTrue(any("Compound_Triage_Bypassed:Prioritized_technical_support" in s for s in passed_ctx.execution_steps))

    def test_15_hostile_threat_pending_review_attribution(self):
        """Hostile legal threat held in draft_mode must be attributed accurately and emit escalation_alert"""
        mock_self = MagicMock()
        mock_self.request.id = "task-threat-draft-1"

        preflight_db = MagicMock()
        preflight_cursor = MagicMock()
        preflight_cursor.__enter__.return_value = preflight_cursor
        preflight_db.cursor.return_value = preflight_cursor
        preflight_cursor.fetchone.return_value = None

        final_db = MagicMock()
        final_cursor = MagicMock()
        final_cursor.__enter__.return_value = final_cursor
        final_db.cursor.return_value = final_cursor
        final_cursor.lastrowid = 1008

        preflight_ctx = MagicMock()
        preflight_ctx.__enter__.return_value = preflight_db
        final_ctx = MagicMock()
        final_ctx.__enter__.return_value = final_db

        def mock_agent_loop(ctx, cursor=None):
            ctx.context_data["sentiment_velocity_breach"] = True
            ctx.response_action = "draft_mode"
            return ctx

        with patch("worker.tasks.get_db_ctx", side_effect=[preflight_ctx, final_ctx]), \
             patch("worker.tasks.get_history", return_value=[]), \
             patch("worker.tasks.run_support_agent", side_effect=mock_agent_loop), \
             patch("worker.tasks.publish_email_update") as mock_pub, \
             patch("app.draft_service.create_draft") as mock_create_draft, \
             patch("worker.tasks.push_message"):
            run_task(mock_self, {
                "client_id": "CLI-TEST",
                "from_email": "angry@example.com",
                "subject": "I will file a lawsuit and police report",
                "body": "Your service failed, I am hiring an attorney to sue you in consumer court."
            })

            mock_create_draft.assert_called_once()
            # publish_email_update is called on persistence and in finally
            self.assertGreaterEqual(mock_pub.call_count, 1)
            first_call_kwargs = mock_pub.call_args_list[0][1]
            extra = first_call_kwargs.get("extra_payload") or {}
            self.assertTrue(extra.get("escalation_alert"))
            self.assertEqual(extra.get("escalation_reason"), "Hostile_Legal_Threat")
            self.assertEqual(extra.get("priority"), "Critical")


if __name__ == "__main__":
    unittest.main()



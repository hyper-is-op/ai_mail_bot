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


if __name__ == "__main__":
    unittest.main()



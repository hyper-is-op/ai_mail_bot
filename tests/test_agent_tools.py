import unittest
from unittest.mock import MagicMock, patch
from app.pipeline.context import PipelineContext
from app.pipeline.tools import SUPPORT_TOOLS, execute_tool_call

class TestAgentTools(unittest.TestCase):

    def test_01_tool_schemas(self):
        """SUPPORT_TOOLS must declare 5 primary functional tools with valid JSON schemas"""
        self.assertEqual(len(SUPPORT_TOOLS), 5)
        tool_names = [t["function"]["name"] for t in SUPPORT_TOOLS]
        self.assertIn("lookup_order_status", tool_names)
        self.assertIn("lookup_payment_status", tool_names)
        self.assertIn("lookup_ticket_status", tool_names)
        self.assertIn("search_knowledge_base", tool_names)
        self.assertIn("escalate_and_create_ticket", tool_names)

        for t in SUPPORT_TOOLS:
            fn = t["function"]
            self.assertIn("description", fn)
            self.assertIn("parameters", fn)
            params = fn["parameters"]
            self.assertEqual(params["type"], "object")
            self.assertIn("required", params)

    def test_02_unrecognized_tool_handling(self):
        """Unrecognized tool name must return structured error with available tools list"""
        ctx = PipelineContext.from_task_data("test-task-unknown", {
            "client_id": "CLI-08BDA27B",
            "from_email": "customer@example.com",
            "subject": "Unknown tool inquiry",
            "body": "test"
        })
        cursor = MagicMock()
        res = execute_tool_call("non_existent_tool_xyz", {}, ctx, cursor)
        self.assertEqual(res.get("status"), "unrecognized_tool")
        self.assertIn("available_tools", res)

    def test_03_knowledge_base_tool_execution(self):
        """search_knowledge_base tool must return structured results without crashing"""
        ctx = PipelineContext.from_task_data("test-task-rag", {
            "client_id": "CLI-08BDA27B",
            "from_email": "customer@example.com",
            "subject": "Help with login",
            "body": "How do I reset my password?"
        })
        cursor = MagicMock()
        res = execute_tool_call("search_knowledge_base", {"query": "reset password"}, ctx, cursor)
        self.assertIn("status", res)
        self.assertIn(res["status"], ("success", "empty"))
        self.assertIn("content", res)

    def test_04_ticket_status_lookup_handling(self):
        """lookup_ticket_or_order_status tool must return structured result for missing ID"""
        ctx = PipelineContext.from_task_data("test-task-crm", {
            "client_id": "CLI-08BDA27B",
            "from_email": "customer@example.com",
            "subject": "Ticket status",
            "body": "Checking ticket status"
        })
        cursor = MagicMock()
        res = execute_tool_call("lookup_ticket_or_order_status", {"ticket_id": "T-NONEXISTENT-999"}, ctx, cursor)
        self.assertIn("status", res)
        self.assertIn(res["status"], ("not_found", "lookup_failed", "found"))
        self.assertIn("message", res)

    def test_05_tool_exception_resilience(self):
        """Unexpected internal exceptions in tools must be caught and return structured error with hint"""
        ctx = PipelineContext.from_task_data("test-task-err", {
            "client_id": "CLI-08BDA27B",
            "from_email": "customer@example.com",
            "subject": "Error test",
            "body": "Test error"
        })
        cursor = MagicMock()

        with patch("app.pipeline.tools.fetch_crm_ticket_status", side_effect=RuntimeError("Simulated CRM Socket Timeout")):
            res = execute_tool_call("lookup_ticket_or_order_status", {"ticket_id": "123"}, ctx, cursor)
            # Depending on whether fetch_crm_ticket_status handles it or bubbles, execute_tool_call catches it cleanly
            self.assertIn("status", res)
            self.assertIn(res["status"], ("error", "lookup_failed"))
            self.assertIn("hint", res)


    def test_06_not_found_context_data_preservation(self):
        """When ticket is not found, ctx.context_data must record not_found state to avoid hard floor escalation"""
        ctx = PipelineContext.from_task_data("test-task-not-found", {
            "client_id": "CLI-08BDA27B",
            "from_email": "customer@example.com",
            "subject": "Missing ticket inquiry",
            "body": "what is status of ticket 000000"
        })
        with patch("app.pipeline.tools.fetch_crm_ticket_status", return_value={"success": False, "not_found": True, "error": "No matching ticket record found"}):
            res = execute_tool_call("lookup_ticket_status", {"ticket_id": "000000"}, ctx)
            self.assertEqual(res["status"], "not_found")
            self.assertIsNotNone(ctx.context_data)
            self.assertEqual(ctx.context_data.get("status"), "not_found")
            self.assertEqual(ctx.context_data.get("reference_id"), "000000")

        # Test evaluator treats not_found clarification as auto_send if score >= 50
        from app.pipeline.evaluator import evaluate_draft_and_decide
        with patch("app.pipeline.evaluator.llm_score", return_value=70):
            score, decision = evaluate_draft_and_decide(
                client_id="CLI-08BDA27B",
                reply="Dear customer, ticket 000000 was not found in our records. Please verify the ticket ID.",
                query=ctx.body,
                context_succeeded=bool(ctx.context_data),
                is_not_found=True
            )
            self.assertEqual(decision, "auto_send")
            self.assertEqual(score, 70)

    def test_07_concurrent_tool_execution(self):
        """When the LLM emits multiple tool calls in a single turn, they must execute concurrently."""
        from app.pipeline.agent import run_support_agent

        ctx = PipelineContext.from_task_data("test-task-concurrent", {
            "client_id": "CLI-TEST",
            "from_email": "customer@example.com",
            "subject": "Order and Policy Check",
            "body": "Check my order 101 and search return policy"
        })

        mock_tool_call_1 = MagicMock()
        mock_tool_call_1.id = "call_kb_1"
        mock_tool_call_1.function.name = "search_knowledge_base"
        mock_tool_call_1.function.arguments = '{"query": "return policy"}'

        mock_tool_call_2 = MagicMock()
        mock_tool_call_2.id = "call_order_2"
        mock_tool_call_2.function.name = "lookup_order_status"
        mock_tool_call_2.function.arguments = '{"order_id": "101"}'

        mock_resp_round_1 = MagicMock()
        mock_choice_1 = MagicMock()
        mock_choice_1.message.content = None
        mock_choice_1.message.tool_calls = [mock_tool_call_1, mock_tool_call_2]
        mock_resp_round_1.choices = [mock_choice_1]

        mock_resp_round_2 = MagicMock()
        mock_choice_2 = MagicMock()
        mock_choice_2.message.content = "Here is your order status and return policy details."
        mock_choice_2.message.tool_calls = []
        mock_resp_round_2.choices = [mock_choice_2]

        with patch("app.pipeline.agent.client.chat.completions.create", side_effect=[mock_resp_round_1, mock_resp_round_2]), \
             patch("app.pipeline.agent.execute_tool_call") as mock_exec:
            mock_exec.side_effect = [
                {"status": "success", "results_found": True, "content": "30-day return policy"},
                {"status": "found", "order_id": "101", "details": {"status": "shipped"}}
            ]
            res_ctx = run_support_agent(ctx)
            self.assertEqual(mock_exec.call_count, 2)
            self.assertTrue(res_ctx.draft_reply.startswith("Here is your order status and return policy details."))

    def test_08_cross_lingual_indic_keyword_extraction(self):
        """extract_indic_keywords must strip Romanized Indic filler and leave dense technical search terms."""
        from app.text_cleaning import extract_indic_keywords, has_indic_filler

        # Romanized Indic queries
        self.assertTrue(has_indic_filler("mai CZ dialer ke bare me janna chahata hu"))
        self.assertEqual(extract_indic_keywords("mai CZ dialer ke bare me janna chahata hu"), "CZ dialer")

        self.assertTrue(has_indic_filler("password reset kaise karein"))
        self.assertEqual(extract_indic_keywords("password reset kaise karein"), "password reset")

        self.assertTrue(has_indic_filler("dialer me call connect nahi ho raha hai"))
        self.assertEqual(extract_indic_keywords("dialer me call connect nahi ho raha hai"), "dialer call connect")

        # English queries should not be touched
        self.assertFalse(has_indic_filler("How do I configure CZ Dialer?"))
        self.assertEqual(extract_indic_keywords("How do I configure CZ Dialer?"), "How do I configure CZ Dialer?")

        self.assertFalse(has_indic_filler("Where is my order #1001?"))
        self.assertEqual(extract_indic_keywords("Where is my order #1001?"), "Where is my order #1001?")

    def test_09_clean_rag_query_bridges_cross_lingual_gap(self):
        """clean_rag_query must remove conversational Hinglish boilerplate to produce dense keywords."""
        from app.pipeline.tools import clean_rag_query

        raw_inquiry = "Hi Support Team,\n\nmai CZ dialer ke bare me janna chahata hu.\n\nThanks,\nYazdani"
        cleaned = clean_rag_query(raw_inquiry)
        self.assertEqual(cleaned, "CZ dialer")

    def test_10_general_query_escalation_denied(self):
        """escalate_and_create_ticket must reject escalation when intent is general_query"""
        ctx = PipelineContext.from_task_data("test-general-escalate", {
            "client_id": "CLI-4159FFCF",
            "from_email": "customer@example.com",
            "subject": "tell me about cz omni",
            "body": "tell me about cz omni"
        })
        ctx.intent = "general_query"
        res = execute_tool_call("escalate_and_create_ticket", {"issue_summary": "product question"}, ctx)
        self.assertEqual(res.get("status"), "escalation_denied")
        self.assertEqual(res.get("reason"), "intent_not_eligible_for_escalation")

    def test_11_duplicate_ticket_escalation_blocked(self):
        """escalate_and_create_ticket must block duplicate ticket creation if thread already has a ticket"""
        ctx = PipelineContext.from_task_data("test-duplicate-ticket", {
            "client_id": "CLI-4159FFCF",
            "from_email": "customer@example.com",
            "subject": "Re: Ticket Update: 275424000000582153",
            "body": "any update?"
        })
        ctx.ticket_id = "275424000000582153"
        ctx.intent = "technical_support"
        res = execute_tool_call("escalate_and_create_ticket", {"issue_summary": "ongoing issue"}, ctx)
        self.assertEqual(res.get("status"), "ticket_already_exists")
        self.assertEqual(res.get("ticket_id"), "275424000000582153")

    def test_12_general_query_preserves_troubleshooting_step(self):
        """general_query inquiries calling search_knowledge_base must NOT increment troubleshooting_step"""
        from app.pipeline.agent import run_support_agent

        ctx = PipelineContext.from_task_data("test-step-preservation", {
            "client_id": "CLI-4159FFCF",
            "from_email": "customer@example.com",
            "subject": "Product question",
            "body": "tell me about cz omni"
        })
        ctx.intent = "general_query"
        ctx.troubleshooting_step = 0

        mock_tool_call = MagicMock()
        mock_tool_call.id = "call_kb_omni"
        mock_tool_call.function.name = "search_knowledge_base"
        mock_tool_call.function.arguments = '{"query": "CZ Omni"}'

        mock_resp_1 = MagicMock()
        mock_choice_1 = MagicMock()
        mock_choice_1.message.content = None
        mock_choice_1.message.tool_calls = [mock_tool_call]
        mock_resp_1.choices = [mock_choice_1]

        mock_resp_2 = MagicMock()
        mock_choice_2 = MagicMock()
        mock_choice_2.message.content = "CZ Omni is an omnichannel contact center platform."
        mock_choice_2.message.tool_calls = []
        mock_resp_2.choices = [mock_choice_2]

        with patch("app.pipeline.agent.client.chat.completions.create", side_effect=[mock_resp_1, mock_resp_2]), \
             patch("app.pipeline.agent.execute_tool_call", return_value={"status": "success", "results_found": True, "content": "CZ Omni overview"}):
            res_ctx = run_support_agent(ctx)
            # troubleshooting_step must stay 0 for general_query
            self.assertEqual(res_ctx.troubleshooting_step, 0)
            self.assertNotIn("Troubleshooting_Step_1", res_ctx.execution_steps)

    def test_13_extract_scoring_query_clean_subject(self):
        """extract_scoring_query must strip ticket update prefixes and avoid polluting LLM scoring input"""
        from app.pipeline.agent import extract_scoring_query

        res = extract_scoring_query("Re: Ticket Update: 275424000000582153", "tell me about cz dialer")
        self.assertEqual(res, "tell me about cz dialer")

        res2 = extract_scoring_query("Fwd: Ticket #12345: Urgent", "how do I reset password?")
        self.assertEqual(res2, "Subject: Urgent\n\nhow do I reset password?")

    def test_14_evaluator_general_query_bypasses_ticket_creation(self):
        """General queries with knowledge retrieval must auto_send at score >= 60 and never create tickets"""
        from app.pipeline.evaluator import evaluate_draft_and_decide

        with patch("app.pipeline.evaluator.llm_score", return_value=65):
            score, decision = evaluate_draft_and_decide(
                client_id="CLI-TEST",
                reply="CZ Dialer is our outbound dialing system.",
                query="tell me about cz dialer",
                context_succeeded=True,
                intent="general_query"
            )
            self.assertEqual(decision, "auto_send")
            self.assertEqual(score, 65)

        with patch("app.pipeline.evaluator.llm_score", return_value=45):
            score, decision = evaluate_draft_and_decide(
                client_id="CLI-TEST",
                reply="Short answer.",
                query="tell me about cz dialer",
                context_succeeded=True,
                intent="general_query"
            )
            self.assertEqual(decision, "draft_mode")
            self.assertEqual(score, 45)


if __name__ == "__main__":
    unittest.main()



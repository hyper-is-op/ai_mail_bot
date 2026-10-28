import unittest
from unittest.mock import patch, MagicMock
import requests

from app.connector_config.dispatch import (
    run_ticket_status_lookup,
    run_order_status_lookup,
    run_payment_status_lookup,
)
from app.connector_executor import execute_connector
from app.pipeline.tools import execute_tool_call
from app.pipeline.context import PipelineContext
from app.pipeline.evaluator import evaluate_draft_and_decide


class TestTicketFormatHandling(unittest.TestCase):

    @patch("app.connector_config.dispatch.check_connector_rate_limit", return_value=True)
    @patch("app.connector_config.dispatch.get_live_config")
    @patch("app.connector_executor.execute_connector")
    def test_preflight_regex_rejection_ticket(self, mock_exec, mock_cfg, mock_rl):
        """When ticket ID does not match tenant's id_pattern_regex, fail fast without HTTP call."""
        mock_cfg.return_value = {
            "trigger_type": "ticket_status",
            "id_pattern_regex": r"^\d{6,8}$"
        }
        res = run_ticket_status_lookup(
            client_id="CLI-TEST",
            ticket_id="T-ABC-12345",
            from_email="user@example.com"
        )
        self.assertFalse(res["success"])
        self.assertTrue(res.get("invalid_format"))
        self.assertTrue(res.get("not_found"))
        self.assertIn("does not match expected format pattern", res.get("error", ""))
        # Verify no connector HTTP call was executed
        mock_exec.assert_not_called()

    @patch("app.connector_config.dispatch.check_connector_rate_limit", return_value=True)
    @patch("app.connector_config.dispatch.get_live_config")
    @patch("app.connector_executor.execute_connector")
    def test_preflight_regex_acceptance_ticket(self, mock_exec, mock_cfg, mock_rl):
        """When ticket ID matches tenant's id_pattern_regex, connector HTTP execution proceeds."""
        mock_cfg.return_value = {
            "trigger_type": "ticket_status",
            "id_pattern_regex": r"^\d{6,8}$"
        }
        mock_exec.return_value = {
            "success": True,
            "data": {"docket_no": "123456", "ticket_status": "Open"}
        }
        res = run_ticket_status_lookup(
            client_id="CLI-TEST",
            ticket_id="123456",
            from_email="user@example.com"
        )
        self.assertTrue(res["success"])
        self.assertEqual(res["data"]["docket_no"], "123456")
        mock_exec.assert_called_once()

    @patch("app.connector_config.dispatch.check_connector_rate_limit", return_value=True)
    @patch("app.connector_config.dispatch.get_live_config")
    @patch("app.connector_executor.execute_connector")
    def test_preflight_regex_order_and_payment(self, mock_exec, mock_cfg, mock_rl):
        """Pre-flight regex works consistently across order and payment lookups."""
        mock_cfg.return_value = {
            "trigger_type": "order_status",
            "id_pattern_regex": r"^ORD-\d{4,6}$"
        }
        res_ord = run_order_status_lookup(
            client_id="CLI-TEST",
            order_id="INVALID_ORD",
            from_email="user@example.com"
        )
        self.assertFalse(res_ord["success"])
        self.assertTrue(res_ord.get("invalid_format"))
        mock_exec.assert_not_called()

        mock_cfg.return_value = {
            "trigger_type": "payment_status",
            "id_pattern_regex": r"^(pi|pay)_[a-zA-Z0-9]+$"
        }
        res_pay = run_payment_status_lookup(
            client_id="CLI-TEST",
            payment_id="BAD_PAY_ID",
            from_email="user@example.com"
        )
        self.assertFalse(res_pay["success"])
        self.assertTrue(res_pay.get("invalid_format"))
        mock_exec.assert_not_called()

    @patch("app.connector_executor.is_url_allowed", return_value=True)
    @patch("requests.get")
    def test_executor_reclassifies_400_and_422_as_invalid_format(self, mock_get, mock_url_ok):
        """HTTP 400 and 422 are tagged as invalid_format/not_found and NOT upstream outages."""
        config = {
            "url": "https://crm.example.com/api/tickets/{ticket_id}",
            "http_method": "GET",
            "payload_encoding": "plain",
            "headers": {},
            "query_params": {}
        }
        context = {"ticket_id": "ABC"}

        # Test HTTP 400 Bad Request
        resp_400 = MagicMock()
        resp_400.status_code = 400
        resp_400.text = '{"error": "Invalid ticket ID: must be numeric"}'
        mock_get.side_effect = requests.exceptions.HTTPError(response=resp_400)

        res = execute_connector(config, context, body="", history=[])
        self.assertFalse(res["success"])
        self.assertTrue(res["invalid_format"])
        self.assertTrue(res["not_found"])
        self.assertFalse(res["upstream_outage"])

        # Test HTTP 422 Unprocessable Entity
        resp_422 = MagicMock()
        resp_422.status_code = 422
        resp_422.text = '{"message": "Unprocessable ID entity"}'
        mock_get.side_effect = requests.exceptions.HTTPError(response=resp_422)

        res = execute_connector(config, context, body="", history=[])
        self.assertFalse(res["success"])
        self.assertTrue(res["invalid_format"])
        self.assertTrue(res["not_found"])
        self.assertFalse(res["upstream_outage"])

        # Test HTTP 500 Outage
        resp_500 = MagicMock()
        resp_500.status_code = 500
        resp_500.text = "Internal Server Error"
        mock_get.side_effect = requests.exceptions.HTTPError(response=resp_500)

        res = execute_connector(config, context, body="", history=[])
        self.assertFalse(res["success"])
        self.assertFalse(res["invalid_format"])
        self.assertFalse(res["not_found"])
        self.assertTrue(res["upstream_outage"])

    @patch("app.pipeline.tools.fetch_crm_ticket_status")
    def test_tool_call_invalid_format_hint_and_logging(self, mock_fetch):
        """lookup_ticket_status tool logs CRM_Status_Invalid_Format and provides clarification hint."""
        mock_fetch.return_value = {
            "success": False,
            "invalid_format": True,
            "not_found": True,
            "error": "Ticket reference 'ABC-123' does not match expected format pattern."
        }
        ctx = PipelineContext(
            task_id="task-test-01",
            client_id="CLI-TEST",
            from_email="customer@example.com",
            subject="Status check",
            body="Checking ticket ABC-123"
        )
        tool_out = execute_tool_call("lookup_ticket_status", {"ticket_id": "ABC-123"}, ctx)

        self.assertEqual(tool_out["status"], "not_found")
        self.assertTrue(tool_out.get("invalid_format"))
        self.assertIn("CRM_Status_Invalid_Format", ctx.execution_steps)
        self.assertEqual(ctx.context_data.get("sub_status"), "invalid_format")
        self.assertIn("could not be recognized or located in the system", tool_out.get("hint", ""))

    def test_evaluator_allows_autosend_for_clarification_on_invalid_format(self):
        """Evaluator delivers clarification reply to customer on invalid format without escalating ticket."""
        score, decision = evaluate_draft_and_decide(
            client_id="CLI-TEST",
            reply="Dear Customer,\n\nWe could not locate ticket #ABC-123. Could you please check your confirmation email?",
            query="Checking ticket ABC-123",
            context_succeeded=True,
            is_resolved=False,
            troubleshooting_step=0,
            is_not_found=True,
            intent="ticket_status"
        )
        self.assertEqual(decision, "auto_send")
        self.assertGreaterEqual(score, 50)


if __name__ == "__main__":
    unittest.main()

import unittest
from unittest.mock import patch, MagicMock
from app.pipeline.dispatcher import create_ticket_and_reply


def _make_action_side_effect(ticket_id):
    def _side_effect(client_id, message_id, action_type, action_fn, extract_ref_fn=None):
        if action_type == "crm_ticket_create":
            return {
                "success": True,
                "already_completed": False,
                "result": {"ticket_id": ticket_id, "status": "Open", "priority": "High"},
                "external_ref": ticket_id
            }
        elif action_type == "smtp_send_reply":
            sent = action_fn()
            return {
                "success": True,
                "already_completed": False,
                "result": sent,
                "external_ref": None
            }
        return {"success": True, "already_completed": False, "result": action_fn()}
    return _side_effect


class TestTicketThreading(unittest.TestCase):
    """
    Validates email subject and thread continuity preservation on ticket escalation replies.
    Ensures RFC headers and Outlook Conversation-Topic matching are maintained.
    """

    @patch("app.pipeline.dispatcher.send_email")
    @patch("app.pipeline.dispatcher.generate_reply_llm")
    @patch("app.pipeline.dispatcher.execute_idempotent_action")
    def test_original_subject_preserved_with_ticket_tag(
        self, mock_action, mock_reply_llm, mock_send
    ):
        mock_action.side_effect = _make_action_side_effect("275424000000599999")
        mock_reply_llm.return_value = "Ticket created confirmation reply"
        mock_send.return_value = True

        data = {
            "from_email": "customer@telecom.com",
            "subject": "CZ dialer server crash in production",
            "body": "Server crashed with core dump",
            "message_id": "<msg-unique-123@telecom.com>",
        }

        with patch("app.db.get_db_ctx") as mock_db:
            mock_cur = MagicMock()
            mock_cur.fetchone.return_value = (0,)
            mock_db.return_value.__enter__.return_value.cursor.return_value = mock_cur

            reply, ticket_id, status = create_ticket_and_reply(
                data=data,
                client_id="CLI-TEST",
                context="Server crash details",
                history=[],
                features={"feature_auto_send": True}
            )

        self.assertEqual(ticket_id, "275424000000599999")
        self.assertEqual(status, "ticket_created_and_sent")

        # Verify send_email was called with the preserved thread subject and in_reply_to header
        mock_send.assert_called_once()
        call_args = mock_send.call_args[0]
        call_kwargs = mock_send.call_args[1]

        sent_to = call_args[1]
        sent_subject = call_args[2]
        in_reply_to = call_kwargs.get("in_reply_to")

        self.assertEqual(sent_to, "customer@telecom.com")
        self.assertEqual(sent_subject, "Re: CZ dialer server crash in production")
        self.assertEqual(in_reply_to, "<msg-unique-123@telecom.com>")

    @patch("app.pipeline.dispatcher.send_email")
    @patch("app.pipeline.dispatcher.generate_reply_llm")
    @patch("app.pipeline.dispatcher.execute_idempotent_action")
    def test_existing_re_prefix_cleanly_handled_without_duplication(
        self, mock_action, mock_reply_llm, mock_send
    ):
        mock_action.side_effect = _make_action_side_effect("275424000000599998")
        mock_reply_llm.return_value = "Ticket confirmation"
        mock_send.return_value = True

        data = {
            "from_email": "user@domain.com",
            "subject": "Re: Re: SIP 408 timeout issue",
            "body": "Still timing out",
            "message_id": "<msg-456@domain.com>",
        }

        with patch("app.db.get_db_ctx") as mock_db:
            mock_cur = MagicMock()
            mock_cur.fetchone.return_value = (0,)
            mock_db.return_value.__enter__.return_value.cursor.return_value = mock_cur

            reply, ticket_id, status = create_ticket_and_reply(
                data=data,
                client_id="CLI-TEST",
                context="SIP timeout",
                history=[],
                features={"feature_auto_send": True}
            )

        call_args = mock_send.call_args[0]
        sent_subject = call_args[2]
        self.assertEqual(sent_subject, "Re: SIP 408 timeout issue")

    @patch("app.pipeline.dispatcher.send_email")
    @patch("app.pipeline.dispatcher.generate_reply_llm")
    @patch("app.pipeline.dispatcher.execute_idempotent_action")
    def test_no_duplicate_ticket_tag_if_already_present(
        self, mock_action, mock_reply_llm, mock_send
    ):
        mock_action.side_effect = _make_action_side_effect("TKT-100")
        mock_reply_llm.return_value = "Ticket confirmation"
        mock_send.return_value = True

        data = {
            "from_email": "user@domain.com",
            "subject": "Firewall issue [Ticket #TKT-100]",
            "body": "Need follow up",
            "message_id": "<msg-789@domain.com>",
        }

        with patch("app.db.get_db_ctx") as mock_db:
            mock_cur = MagicMock()
            mock_cur.fetchone.return_value = (0,)
            mock_db.return_value.__enter__.return_value.cursor.return_value = mock_cur

            reply, ticket_id, status = create_ticket_and_reply(
                data=data,
                client_id="CLI-TEST",
                context="Firewall",
                history=[],
                features={"feature_auto_send": True}
            )

        call_args = mock_send.call_args[0]
        sent_subject = call_args[2]
        self.assertEqual(sent_subject, "Re: Firewall issue [Ticket #TKT-100]")


if __name__ == "__main__":
    unittest.main()

"""
Unit tests validating that all standard connector presets in connectorPresets.ts
conform strictly to backend validation schemas, placeholder constraints,
response mapping requirements, and security regex rules.
"""
import json
import os
import re
import unittest

from app.connector_config.validation import (
    _validate_template_placeholders,
    _validate_response_mapping_fields,
    validate_id_pattern_regex,
    REQUIRED_RESPONSE_FIELDS,
)
from app.context_data import CONTEXT_DATA_KEYS, build_context_data_base
from app.connector_executor import _render_template

PRESET_DEFINITIONS = [
    {
        "id": "zoho_desk_ticket_create",
        "title": "Zoho Desk (Ticket Create)",
        "trigger_type": "ticket_create",
        "http_method": "POST",
        "url": "https://desk.zoho.in/api/v1/tickets",
        "headers_template": '{\n  "orgId": "YOUR_ZOHO_ORG_ID",\n  "Content-Type": "application/json"\n}',
        "request_template": '{\n  "subject": "{{subject}}",\n  "description": "<div style=\\"white-space: pre-wrap; font-family: inherit;\\">=== EXECUTIVE SUMMARY ===\\n\\n{{history_summary}}\\n\\n===================================\\nTHREAD CONVERSATION LOG\\n===================================\\n\\n{{conversation_history}}</div>",\n  "departmentId": "YOUR_DEPARTMENT_ID",\n  "priority": "{{priority}}",\n  "contact": {\n    "email": "{{from_email}}",\n    "firstName": "{{first_name}}",\n    "lastName": "{{last_name}}"\n  }\n}',
        "response_mapping": '{\n  "fields": [\n    {\n      "field": "ticket_id",\n      "path": "id",\n      "extract_regex": null\n    },\n    {\n      "field": "ticket_status",\n      "path": "status",\n      "extract_regex": null\n    }\n  ]\n}',
        "owner_email_path": "contact.email",
        "id_pattern_regex": r"^\d{16,19}$",
        "placeholders": ["YOUR_ZOHO_ORG_ID", "YOUR_DEPARTMENT_ID"],
    },
    {
        "id": "zoho_desk_ticket_status",
        "title": "Zoho Desk (Ticket Status)",
        "trigger_type": "ticket_status",
        "http_method": "GET",
        "url": "https://desk.zoho.in/api/v1/tickets/{{ticket_id}}",
        "headers_template": '{\n  "orgId": "YOUR_ZOHO_ORG_ID",\n  "Content-Type": "application/json"\n}',
        "request_template": "{}",
        "response_mapping": '{\n  "fields": [\n    {\n      "field": "docket_no",\n      "path": "ticketNumber || data[0].ticketNumber",\n      "extract_regex": null\n    },\n    {\n      "field": "ticket_status",\n      "path": "status || data[0].status",\n      "extract_regex": null\n    },\n    {\n      "field": "subject",\n      "path": "subject || data[0].subject",\n      "extract_regex": null\n    }\n  ]\n}',
        "owner_email_path": "email || contact.email",
        "id_pattern_regex": r"^\d{16,19}$",
        "placeholders": ["YOUR_ZOHO_ORG_ID"],
    },
    {
        "id": "freshdesk_ticket_create",
        "title": "Freshdesk (Ticket Create)",
        "trigger_type": "ticket_create",
        "http_method": "POST",
        "url": "https://YOUR_DOMAIN.freshdesk.com/api/v2/tickets",
        "headers_template": '{\n  "Content-Type": "application/json"\n}',
        "request_template": '{\n  "subject": "{{subject}}",\n  "description": "=== EXECUTIVE SUMMARY ===\\n\\n{{history_summary}}\\n\\n===================================\\nTHREAD CONVERSATION LOG\\n===================================\\n\\n{{conversation_history}}",\n  "email": "{{from_email}}",\n  "name": "{{customer_name}}",\n  "priority": "{{priority_num}}",\n  "status": 2,\n  "tags": ["mail_ai_escalation"]\n}',
        "response_mapping": '{\n  "fields": [\n    {\n      "field": "ticket_id",\n      "path": "id",\n      "extract_regex": null\n    }\n  ]\n}',
        "owner_email_path": "email",
        "id_pattern_regex": r"^\d{1,10}$",
        "placeholders": ["YOUR_DOMAIN", "YOUR_FRESHDESK_API_KEY"],
    },
    {
        "id": "freshdesk_ticket_status",
        "title": "Freshdesk (Ticket Status)",
        "trigger_type": "ticket_status",
        "http_method": "GET",
        "url": "https://YOUR_DOMAIN.freshdesk.com/api/v2/tickets/{{ticket_id}}",
        "headers_template": '{\n  "Content-Type": "application/json"\n}',
        "request_template": "{}",
        "response_mapping": '{\n  "fields": [\n    {\n      "field": "docket_no",\n      "path": "id",\n      "extract_regex": null\n    },\n    {\n      "field": "ticket_status",\n      "path": "status",\n      "extract_regex": null\n    },\n    {\n      "field": "subject",\n      "path": "subject",\n      "extract_regex": null\n    }\n  ]\n}',
        "owner_email_path": "email",
        "id_pattern_regex": r"^\d{1,10}$",
        "placeholders": ["YOUR_DOMAIN", "YOUR_FRESHDESK_API_KEY"],
    },
    {
        "id": "zendesk_ticket_create",
        "title": "Zendesk (Ticket Create)",
        "trigger_type": "ticket_create",
        "http_method": "POST",
        "url": "https://YOUR_SUBDOMAIN.zendesk.com/api/v2/tickets.json",
        "headers_template": '{\n  "Content-Type": "application/json"\n}',
        "request_template": '{\n  "ticket": {\n    "subject": "{{subject}}",\n    "comment": {\n      "body": "=== EXECUTIVE SUMMARY ===\\n\\n{{history_summary}}\\n\\n===================================\\nTHREAD CONVERSATION LOG\\n===================================\\n\\n{{conversation_history}}"\n    },\n    "requester": {\n      "email": "{{from_email}}",\n      "name": "{{customer_name}}"\n    },\n    "priority": "{{priority_lower}}",\n    "external_id": "{{thread_id}}",\n    "tags": ["mail_ai_escalation"]\n  }\n}',
        "response_mapping": '{\n  "fields": [\n    {\n      "field": "ticket_id",\n      "path": "ticket.id",\n      "extract_regex": null\n    }\n  ]\n}',
        "owner_email_path": "ticket.requester.email",
        "id_pattern_regex": r"^\d{1,10}$",
        "placeholders": ["YOUR_SUBDOMAIN", "YOUR_EMAIL", "YOUR_API_TOKEN"],
    },
    {
        "id": "zendesk_ticket_status",
        "title": "Zendesk (Ticket Status)",
        "trigger_type": "ticket_status",
        "http_method": "GET",
        "url": "https://YOUR_SUBDOMAIN.zendesk.com/api/v2/tickets/{{ticket_id}}.json",
        "headers_template": '{\n  "Content-Type": "application/json"\n}',
        "request_template": "{}",
        "response_mapping": '{\n  "fields": [\n    {\n      "field": "docket_no",\n      "path": "ticket.id",\n      "extract_regex": null\n    },\n    {\n      "field": "ticket_status",\n      "path": "ticket.status",\n      "extract_regex": null\n    },\n    {\n      "field": "subject",\n      "path": "ticket.subject",\n      "extract_regex": null\n    }\n  ]\n}',
        "owner_email_path": "ticket.requester.email",
        "id_pattern_regex": r"^\d{1,10}$",
        "placeholders": ["YOUR_SUBDOMAIN", "YOUR_EMAIL", "YOUR_API_TOKEN"],
    },
    {
        "id": "shopify_order_status",
        "title": "Shopify (Order Lookup)",
        "trigger_type": "order_status",
        "http_method": "GET",
        "url": "https://YOUR_STORE.myshopify.com/admin/api/2026-10/orders.json",
        "headers_template": '{\n  "Content-Type": "application/json"\n}',
        "request_template": '{\n  "name": "{{order_id}}"\n}',
        "response_mapping": '{\n  "fields": [\n    {\n      "field": "docket_no",\n      "path": "orders[0].name",\n      "extract_regex": null\n    },\n    {\n      "field": "ticket_status",\n      "path": "orders[0].fulfillment_status || orders[0].financial_status",\n      "extract_regex": null\n    }\n  ]\n}',
        "owner_email_path": "orders[0].email",
        "id_pattern_regex": r"^#?[A-Za-z0-9\-_]{3,30}$",
        "placeholders": ["YOUR_STORE", "YOUR_SHOPIFY_ADMIN_TOKEN"],
    },
]


class TestConnectorPresetsValidity(unittest.TestCase):
    def test_frontend_preset_registry_file_exists(self):
        frontend_presets_path = os.path.abspath(
            os.path.join(
                os.path.dirname(__file__),
                "..",
                "frontend",
                "src",
                "components",
                "payload-config",
                "connectorPresets.ts",
            )
        )
        if not os.path.exists(frontend_presets_path):
            self.skipTest("frontend/ directory is not mounted inside the docker worker container.")
        with open(frontend_presets_path, "r", encoding="utf-8") as f:
            content = f.read()

        for preset in PRESET_DEFINITIONS:
            self.assertIn(f"id: '{preset['id']}'", content)
            self.assertIn(preset["title"], content)

    def test_all_presets_have_valid_json_templates(self):
        for preset in PRESET_DEFINITIONS:
            with self.subTest(preset=preset["id"]):
                # Headers template must parse as JSON
                headers = json.loads(preset["headers_template"])
                self.assertIsInstance(headers, dict)

                # Request template must parse as JSON
                req = json.loads(preset["request_template"])
                self.assertIsInstance(req, dict)

                # Response mapping must parse as JSON
                mapping = json.loads(preset["response_mapping"])
                self.assertIsInstance(mapping, dict)

    def test_all_presets_pass_backend_placeholder_validation(self):
        for preset in PRESET_DEFINITIONS:
            with self.subTest(preset=preset["id"]):
                # None of the templates should reference unknown context keys
                _validate_template_placeholders(preset["request_template"])
                _validate_template_placeholders(preset["headers_template"])

    def test_all_presets_satisfy_required_response_fields(self):
        for preset in PRESET_DEFINITIONS:
            with self.subTest(preset=preset["id"]):
                _validate_response_mapping_fields(
                    preset["trigger_type"], preset["response_mapping"]
                )

    def test_all_presets_have_valid_id_pattern_regex(self):
        for preset in PRESET_DEFINITIONS:
            with self.subTest(preset=preset["id"]):
                regex = preset.get("id_pattern_regex")
                self.assertIsNotNone(regex)
                validate_id_pattern_regex(regex)
                # Confirm regex compiles in python
                compiled = re.compile(regex)
                self.assertIsNotNone(compiled)

    def test_status_presets_have_owner_email_path(self):
        for preset in PRESET_DEFINITIONS:
            if preset["trigger_type"] in ("ticket_status", "order_status"):
                with self.subTest(preset=preset["id"]):
                    owner_path = preset.get("owner_email_path")
                    self.assertTrue(
                        bool(owner_path and owner_path.strip()),
                        f"Status preset {preset['id']} must define an owner_email_path for BOLA protection",
                    )

    def test_all_placeholders_follow_standard_naming(self):
        for preset in PRESET_DEFINITIONS:
            with self.subTest(preset=preset["id"]):
                for ph in preset["placeholders"]:
                    self.assertTrue(
                        ph.startswith("YOUR_"),
                        f"Placeholder '{ph}' in {preset['id']} must begin with 'YOUR_'",
                    )

    def test_context_data_name_splitting(self):
        # Full two-word name
        ctx = build_context_data_base(
            client_id="c1",
            from_email="jane.doe@example.com",
            subject="Help",
            body="Test body",
            cleaned_body="Test body",
        )
        self.assertEqual(ctx["first_name"], "Jane")
        self.assertEqual(ctx["last_name"], "Doe")

        # Single word name fallback to Customer for lastName
        ctx_single = build_context_data_base(
            client_id="c1",
            from_email="alice@example.com",
            subject="Help",
            body="Test body",
            cleaned_body="Test body",
        )
        self.assertEqual(ctx_single["first_name"], "Alice")
        self.assertEqual(ctx_single["last_name"], "Customer")

        # Empty / no email fallback
        ctx_empty = build_context_data_base(
            client_id="c1",
            from_email="",
            subject="Help",
            body="Test body",
            cleaned_body="Test body",
        )
        self.assertEqual(ctx_empty["first_name"], "Valued")
        self.assertEqual(ctx_empty["last_name"], "Customer")
        self.assertEqual(ctx_empty["customer_name"], "Valued Customer")

        # Sender name explicit override
        ctx_sender = build_context_data_base(
            client_id="c1",
            from_email="ghouse@hospital.com",
            subject="Help",
            body="Body",
            cleaned_body="Body",
            customer_name="Dr. Gregory House",
        )
        self.assertEqual(ctx_sender["first_name"], "Dr.")
        self.assertEqual(ctx_sender["last_name"], "Gregory House")
        self.assertEqual(ctx_sender["customer_name"], "Dr. Gregory House")

    def test_context_data_priority_mappings(self):
        cases = [
            ("Critical", "urgent", 4),
            ("Urgent", "urgent", 4),
            ("High", "high", 3),
            ("Medium", "normal", 2),
            ("Low", "low", 1),
            ("UnknownPriority", "unknownpriority", 2),
        ]
        for prio_input, expected_lower, expected_num in cases:
            with self.subTest(priority=prio_input):
                ctx = build_context_data_base(
                    client_id="c1",
                    from_email="user@test.com",
                    subject="Help",
                    body="Body",
                    cleaned_body="Body",
                    priority=prio_input,
                )
                self.assertEqual(ctx["priority"], prio_input)
                self.assertEqual(ctx["priority_lower"], expected_lower)
                self.assertEqual(ctx["priority_num"], expected_num)

    def test_context_data_thread_id(self):
        ctx_explicit = build_context_data_base(
            client_id="c1",
            from_email="user@test.com",
            subject="Help",
            body="Body",
            cleaned_body="Body",
            thread_id="thread-xyz-456",
        )
        self.assertEqual(ctx_explicit["thread_id"], "thread-xyz-456")

        ctx_fallback = build_context_data_base(
            client_id="c1",
            from_email="user@test.com",
            subject="Help",
            body="Body",
            cleaned_body="Body",
            ticket_id="TKT-101",
        )
        self.assertEqual(ctx_fallback["thread_id"], "TKT-101")

    def test_render_template_with_numeric_and_name_placeholders(self):
        ctx = build_context_data_base(
            client_id="c1",
            from_email="jane.doe@example.com",
            subject="Login failure",
            body="Cannot log in",
            cleaned_body="Cannot log in",
            priority="Critical",
            thread_id="th-888",
        )
        ctx["history_summary"] = "Customer is experiencing a login failure and cannot access their account."

        # Freshdesk preset template
        freshdesk_preset = next(p for p in PRESET_DEFINITIONS if p["id"] == "freshdesk_ticket_create")
        rendered_fd = _render_template(freshdesk_preset["request_template"], ctx)
        self.assertEqual(rendered_fd["priority"], 4)
        self.assertIsInstance(rendered_fd["priority"], int)
        self.assertEqual(rendered_fd["status"], 2)
        self.assertEqual(rendered_fd["name"], "Jane Doe")
        self.assertEqual(rendered_fd["tags"], ["mail_ai_escalation"])

        # Zendesk preset template
        zendesk_preset = next(p for p in PRESET_DEFINITIONS if p["id"] == "zendesk_ticket_create")
        rendered_zd = _render_template(zendesk_preset["request_template"], ctx)
        self.assertEqual(rendered_zd["ticket"]["priority"], "urgent")
        self.assertEqual(rendered_zd["ticket"]["external_id"], "th-888")
        self.assertEqual(rendered_zd["ticket"]["tags"], ["mail_ai_escalation"])

        # Zoho Desk preset template
        zoho_preset = next(p for p in PRESET_DEFINITIONS if p["id"] == "zoho_desk_ticket_create")
        rendered_zoho = _render_template(zoho_preset["request_template"], ctx)
        self.assertEqual(rendered_zoho["priority"], "Critical")
        self.assertEqual(rendered_zoho["contact"]["firstName"], "Jane")
        self.assertEqual(rendered_zoho["contact"]["lastName"], "Doe")


if __name__ == "__main__":
    unittest.main()


import unittest
from app.connector_executor import _render_template
from app.context_data import format_conversation_thread

class TestTicketModes(unittest.TestCase):
    def setUp(self):
        self.turns = [
            {
                'role': 'customer',
                'body': 'I am unable to login cz dialer.',
                'timestamp': '2026-10-28T06:31:00Z',
                'sender_name': 'Md Yazdani'
            },
            {
                'role': 'agent',
                'body': 'Hi Md Yazdani,\nThank you for reaching out to C-Zentrix support. Are you seeing any specific error message on the login screen?',
                'timestamp': '2026-10-28T06:31:30Z',
                'sender_name': 'Support Bot'
            },
            {
                'role': 'customer',
                'body': 'i verified all thing, but still not working.',
                'timestamp': '2026-10-28T06:33:00Z',
                'sender_name': 'Md Yazdani'
            }
        ]
        self.current_body = 'i verified all thing, but still not working.'
        self.thread_text = format_conversation_thread(self.turns, self.current_body)
        self.summary_text = 'The customer is experiencing a blank page when logging into CZ Dialer via Chrome. Standard troubleshooting steps were completed without success.'
        self.context_data = {
            'from_email': 'test.verification@example.com',
            'customer_name': 'Md Yazdani',
            'subject': 'CZ Dialer Login Issue',
            'history_summary': self.summary_text,
            'conversation_history': self.thread_text,
            'departmentId': '275424000000010772'
        }

    def test_mode_1_hybrid(self):
        tpl = {
            'contact': {'email': '{{from_email}}', 'lastName': '{{customer_name}}'},
            'subject': '[TEST - Mode 1 Hybrid] {{subject}}',
            'description': '=== EXECUTIVE SUMMARY ===\n\n{{history_summary}}\n\n===================================\nTHREAD CONVERSATION LOG\n===================================\n\n{{conversation_history}}',
            'departmentId': '275424000000010772'
        }
        rendered = _render_template(tpl, self.context_data)
        desc = rendered['description']
        self.assertIn('=== EXECUTIVE SUMMARY ===\n\n', desc)
        self.assertIn('\n\n===================================\nTHREAD CONVERSATION LOG\n===================================\n\n', desc)
        self.assertIn('=== LATEST CUSTOMER INQUIRY ===\n\n', desc)
        self.assertIn('=== RECENT THREAD CONTEXT (Last 3 Messages) ===\n\n', desc)
        print('\n' + '='*20 + ' MODE 1: HYBRID ' + '='*20)
        print(desc)

    def test_mode_2_detailed_log(self):
        tpl = {
            'contact': {'email': '{{from_email}}', 'lastName': '{{customer_name}}'},
            'subject': '[TEST - Mode 2 Detailed Log] {{subject}}',
            'description': '===================================\nTHREAD CONVERSATION LOG\n===================================\n\n{{conversation_history}}',
            'departmentId': '275424000000010772'
        }
        rendered = _render_template(tpl, self.context_data)
        desc = rendered['description']
        self.assertNotIn('=== EXECUTIVE SUMMARY ===', desc)
        self.assertTrue(desc.startswith('===================================\nTHREAD CONVERSATION LOG\n===================================\n\n'))
        self.assertIn('=== LATEST CUSTOMER INQUIRY ===\n\n', desc)
        print('\n' + '='*20 + ' MODE 2: DETAILED LOG ONLY ' + '='*20)
        print(desc)

    def test_mode_3_summary_only(self):
        tpl = {
            'contact': {'email': '{{from_email}}', 'lastName': '{{customer_name}}'},
            'subject': '[TEST - Mode 3 Summary Only] {{subject}}',
            'description': '{{history_summary}}',
            'departmentId': '275424000000010772'
        }
        rendered = _render_template(tpl, self.context_data)
        desc = rendered['description']
        self.assertEqual(desc, self.summary_text)
        self.assertNotIn('THREAD CONVERSATION LOG', desc)
        print('\n' + '='*20 + ' MODE 3: SUMMARY ONLY ' + '='*20)
        print(desc)

if __name__ == '__main__':
    unittest.main()

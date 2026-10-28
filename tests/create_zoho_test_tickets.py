import json
import pymysql.cursors
from app.db import get_db
from app.connector_executor import execute_connector
from app.context_data import format_conversation_thread

def run_test_tickets():
    conn = get_db()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            # 1. Fetch live connector config row 11
            cur.execute("""
                SELECT id, client_id, trigger_type, http_method, url,
                       headers_template, request_template, response_mapping,
                       auth_type, auth_secret_encrypted, auth_field_name,
                       payload_encoding, base64_query_param_name
                FROM connector_configs
                WHERE id = 11 AND client_id = 'CLI-4B46C071'
            """)
            connector_row = cur.fetchone()
            if not connector_row:
                print("Error: Connector config row 11 not found.")
                return

            # 2. Fetch real email history from thread th_88435becaa09
            cur.execute("""
                SELECT id, from_email, reply, body, summary, created_at
                FROM email_logs
                WHERE thread_id = 'th_88435becaa09'
                ORDER BY id ASC
            """)
            logs = cur.fetchall()

        # Reconstruct turns
        turns = []
        for row in logs[:-1]:
            # Customer turn
            turns.append({
                'role': 'customer',
                'body': row['body'],
                'timestamp': row['created_at'].strftime('%Y-%m-%dT%H:%M') if row['created_at'] else '',
                'sender_name': 'Md Yazdani'
            })
            # Agent reply
            if row['reply']:
                turns.append({
                    'role': 'agent',
                    'body': row['reply'],
                    'timestamp': row['created_at'].strftime('%Y-%m-%dT%H:%M') if row['created_at'] else '',
                    'sender_name': 'Support'
                })

        current_body = logs[-1]['body'] if logs else "i verified all thing, but still not working."
        latest_summary = logs[-1]['summary'] if logs else "Customer cannot log into CZ Dialer."

        conversation_history = format_conversation_thread(turns, current_body)

        context_data = {
            'from_email': 'md.yazdani@c-zentrix.com',
            'customer_name': 'Md Yazdani',
            'subject': 'i am facing problem with cz dialer',
            'history_summary': latest_summary,
            'conversation_history': conversation_history,
            'thread_id': 'th_88435becaa09',
            'priority': 'High',
            'priority_lower': 'high',
            'priority_num': 3
        }

        modes = [
            (
                "Mode 1: Hybrid",
                "[TEST - Mode 1: Hybrid] i am facing problem with cz dialer",
                "=== EXECUTIVE SUMMARY ===\n\n{{history_summary}}\n\n===================================\nTHREAD CONVERSATION LOG\n===================================\n\n{{conversation_history}}"
            ),
            (
                "Mode 2: Detailed Log Only",
                "[TEST - Mode 2: Detailed Log] i am facing problem with cz dialer",
                "===================================\nTHREAD CONVERSATION LOG\n===================================\n\n{{conversation_history}}"
            ),
            (
                "Mode 3: Executive Summary Only",
                "[TEST - Mode 3: Summary Only] i am facing problem with cz dialer",
                "{{history_summary}}"
            ),
        ]

        results = []
        base_req = json.loads(connector_row['request_template']) if isinstance(connector_row['request_template'], str) else dict(connector_row['request_template'])

        for mode_name, subject, desc_template in modes:
            print(f"\n==========================================")
            print(f"Creating Ticket for {mode_name}...")
            print(f"Subject: {subject}")
            
            cfg = dict(connector_row)
            req_template = dict(base_req)
            req_template['subject'] = subject
            req_template['description'] = desc_template
            cfg['request_template'] = json.dumps(req_template)

            result = execute_connector(cfg, context_data, body=current_body, history=turns, old_summary=latest_summary)
            print(f"Result: {result}")
            results.append((mode_name, subject, result))

        print("\n\n================ FINAL RESULTS SUMMARY ================")
        for mode_name, subj, res in results:
            print(f"\n[{mode_name}]")
            print(f"Subject: {subj}")
            if res.get('success'):
                data = res.get('data') or {}
                print(f"Status: SUCCESS")
                print(f"Ticket ID / Data: {data}")
            else:
                print(f"Status: FAILED")
                print(f"Error: {res.get('error')}")

    finally:
        conn.close()

if __name__ == '__main__':
    run_test_tickets()

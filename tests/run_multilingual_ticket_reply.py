#!/usr/bin/env python3
import sys
import os

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app.llm_config import current_client_id
from app.llm_functions.replies import generate_reply_llm

current_client_id.set("CLI-4159FFCF")

print("=== TESTING HINDI TICKET CONFIRMATION ===", flush=True)
hindi_query = "नमस्ते, क्या आप कृपया मेरी समस्या के लिए टिकट बना सकते हैं? हमारा सर्वर बंद हो गया है।"
reply_hindi = generate_reply_llm(
    context="Issue: CZ dialer server crash",
    query=hindi_query,
    agent_type="customer_support",
    from_email="rajesh@example.com",
    is_ticket=True,
    ticket_id="275424000000599999",
    history=[
        {"role": "customer", "body": "नमस्ते, हमारा सर्वर काम नहीं कर रहा है।"},
        {"role": "support", "body": "कृपया सर्वर रिस्टार्ट करके देखें।"},
        {"role": "customer", "body": hindi_query}
    ]
)
print("--- HINDI TICKET REPLY ---", flush=True)
print(reply_hindi, flush=True)

print("\n=== TESTING HINGLISH TICKET CONFIRMATION ===", flush=True)
hinglish_query = "bhai 3 steps try kar liye, par problem solve nahi hui. kripya senior engineer ko ticket assign kar do."
reply_hinglish = generate_reply_llm(
    context="Issue: SIP 408 timeout",
    query=hinglish_query,
    agent_type="customer_support",
    from_email="vikas@example.com",
    is_ticket=True,
    ticket_id="275424000000599998",
    history=[
        {"role": "customer", "body": "dialer me login nahi ho raha SIP 408 error aa raha hai."},
        {"role": "support", "body": "port 5060 check karein."},
        {"role": "customer", "body": hinglish_query}
    ]
)
print("--- HINGLISH TICKET REPLY ---", flush=True)
print(reply_hinglish, flush=True)

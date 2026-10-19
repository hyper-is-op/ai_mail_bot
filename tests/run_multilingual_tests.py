#!/usr/bin/env python3
"""
tests/run_multilingual_tests.py

Comprehensive Multilingual Pipeline Test Harness for Mail AI Automation.
Executes real LLM inference, vector retrieval, and agent tool calling across:
  - English
  - Hinglish (Romanized Hindi)
  - Hindi (Devanagari Script)

Test Categories:
  1. Knowledge Base RAG Inquiry (CZ Dialer Overview & Features)
  2. Multi-turn Troubleshooting -> Customer Resolution
  3. Multi-turn Troubleshooting -> Exhaustion -> CRM Ticket Escalation
  4. CRM Ticket Status Lookup
  5. Compound Multi-Tool Concurrent Inquiries (Ticket Lookup + Knowledge Base Search)
"""

import sys
import os
import time
import json
from typing import Dict, Any, List

# Ensure /app is in path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app.pipeline.context import PipelineContext
from app.pipeline.agent import run_support_agent, check_customer_resolution
from app.pipeline.evaluator import evaluate_draft_and_decide
from app.pipeline.tools import clean_rag_query
from app.text_cleaning import extract_indic_keywords, has_indic_filler
from app.pipeline.enricher import fetch_rag_context

CLIENT_ID = "CLI-4159FFCF"
SENDER = "md.yazdani@c-zentrix.com"

def banner(title: str):
    print("\n" + "=" * 78)
    print(f"🔹 {title}")
    print("=" * 78)

def print_result(label: str, data: Any):
    print(f"  ▪ {label:<24}: {data}")

def execute_turn(
    scenario_name: str,
    lang: str,
    subject: str,
    body: str,
    step: int = 0,
    history: List[Dict[str, Any]] = None,
    thread_id: str = "th_test_auto"
) -> PipelineContext:
    if history is None:
        history = []

    print(f"\n--- [{scenario_name} | {lang}] Turn {step + 1} ---")
    print_result("Customer Language", lang)
    print_result("Subject", subject)
    print_result("Inbound Body", body)

    # 1. Test resolution detection
    is_resolved = check_customer_resolution(body)
    print_result("Is Resolved Detected", is_resolved)

    # 2. Build PipelineContext
    task_id = f"test-task-{int(time.time() * 1000)}"
    ctx = PipelineContext.from_task_data(task_id, {
        "client_id": CLIENT_ID,
        "from_email": SENDER,
        "subject": subject,
        "body": body,
        "thread_id": thread_id,
        "troubleshooting_step": step,
        "is_resolved": is_resolved,
        "history": history
    })

    # 3. Execute Support Agent (Real LLM + Real Qdrant/Tools)
    t0 = time.time()
    res_ctx = run_support_agent(ctx)
    elapsed = time.time() - t0

    print_result("Latency (Agent Loop)", f"{elapsed:.2f}s")
    print_result("Steps Taken", res_ctx.execution_steps)
    print_result("RAG Context Retrieved", f"{len(res_ctx.context_text)} chars" if res_ctx.context_text else "None")
    print_result("Troubleshooting Step", res_ctx.troubleshooting_step)

    # 4. Evaluator & Scoring
    score, decision = evaluate_draft_and_decide(
        client_id=CLIENT_ID,
        reply=res_ctx.draft_reply or "",
        query=body,
        context_succeeded=bool(res_ctx.context_text or res_ctx.context_data or is_resolved),
        is_resolved=is_resolved,
        troubleshooting_step=res_ctx.troubleshooting_step,
        is_not_found=False
    )
    print_result("Evaluator Score", score)
    print_result("Evaluator Decision", decision)

    # Preview response
    reply_preview = (res_ctx.draft_reply or "").strip().replace("\n", " ")
    if len(reply_preview) > 160:
        reply_preview = reply_preview[:160] + "..."
    print_result("Draft Preview", reply_preview)

    # Rate limiting sleep
    time.sleep(1.2)
    return res_ctx


def test_category_1_knowledge_inquiry():
    banner("CATEGORY 1: Knowledge Base RAG Inquiry (CZ Dialer Features)")
    
    inquiries = [
        ("English", "Tell me about CZ Dialer", "What are the main dialing modes in CZ Dialer and how does predictive dialing differ from preview dialing?"),
        ("Hinglish", "CZ dialer ke bare me", "mai CZ dialer ke bare me janna chahata hu. isme predictive aur preview dialing kaise kaam karta hai?"),
        ("Hindi", "CZ डायलर जानकारी", "नमस्ते, CZ डायलर के मुख्य फीचर्स क्या हैं और प्रेडिक्टिव डायलिंग प्रीव्यू डायलिंग से कैसे अलग है?")
    ]

    for lang, subj, body in inquiries:
        execute_turn("Category 1", lang, subj, body, step=0)


def test_category_2_troubleshooting_resolved():
    banner("CATEGORY 2: Troubleshooting Flow -> Customer Resolution (2 Turns)")

    flows = [
        (
            "English",
            "Audio issue on outbound calls",
            "Agents cannot hear audio on connected calls in CZ dialer. How do we resolve this codec issue?",
            "Re: Audio issue on outbound calls",
            "We switched to G.711u codec as you suggested and the audio is working fine now. Thank you, the issue is resolved!"
        ),
        (
            "Hinglish",
            "audio problem in dialer",
            "CZ dialer me call lagne par audio sunai nahi de raha hai. isko kaise solve kare?",
            "Re: audio problem in dialer",
            "ab audio theek chal raha hai, thank you issue solve ho gaya hai."
        ),
        (
            "Hindi",
            "कॉल में ऑडियो समस्या",
            "CZ डायलर में कॉल कनेक्ट होने पर आवाज़ नहीं आ रही है। इसे कैसे ठीक करें?",
            "Re: कॉल में ऑडियो समस्या",
            "बहुत धन्यवाद, अब आवाज़ बिल्कुल ठीक आ रही है और समस्या हल हो गई है।"
        )
    ]

    for lang, subj1, body1, subj2, body2 in flows:
        th_id = f"th_resolve_{lang.lower()}_{int(time.time())}"
        # Turn 1: Problem statement
        res1 = execute_turn("Category 2 (Turn 1)", lang, subj1, body1, step=0, thread_id=th_id)
        
        # Turn 2: Resolution reply
        history = [
            {"role": "customer", "body": body1},
            {"role": "assistant", "body": res1.draft_reply}
        ]
        execute_turn("Category 2 (Turn 2)", lang, subj2, body2, step=res1.troubleshooting_step, history=history, thread_id=th_id)


def test_category_3_troubleshooting_escalation():
    banner("CATEGORY 3: Troubleshooting Flow -> 4 Turns Exhaustion -> Ticket Escalation")

    # We will test Hinglish full 4-turn escalation to verify real step limit trigger
    turns = [
        ("Turn 1 (Initial)", "agent CZ dialer me login nahi kar pa raha hai SIP 408 error aa raha hai.", 0),
        ("Turn 2 (Failed 1)", "port 5060 check kar liya fir bhi SIP 408 timeout error aa raha hai.", 1),
        ("Turn 3 (Failed 2)", "firewall off karke bhi dekha, login abhi bhi fail ho raha hai.", 2),
        ("Turn 4 (Exhausted)", "service restart karne ke baad bhi login nahi hua, problem solve nahi ho rahi hai.", 3)
    ]

    th_id = f"th_escalate_hinglish_{int(time.time())}"
    history = []
    current_step = 0

    for turn_label, turn_body, step_val in turns:
        res = execute_turn("Category 3 Escalation", "Hinglish", "SIP 408 login failure", turn_body, step=current_step, history=history, thread_id=th_id)
        history.append({"role": "customer", "body": turn_body})
        history.append({"role": "assistant", "body": res.draft_reply})
        current_step = res.troubleshooting_step


def test_category_4_ticket_status_lookup():
    banner("CATEGORY 4: Live Ticket Status Lookup")

    inquiries = [
        ("English", "Ticket status inquiry", "Could you check the current status of my ticket #275424000000582039?"),
        ("Hinglish", "Ticket status update", "kya aap mere ticket number 275424000000582039 ka current status check karke bata sakte hain?"),
        ("Hindi", "टिकट स्थिति जांच", "कृपया मेरे टिकट नंबर 275424000000582039 की वर्तमान स्थिति जांचें।")
    ]

    for lang, subj, body in inquiries:
        execute_turn("Category 4", lang, subj, body, step=0)


def test_category_5_compound_concurrent_query():
    banner("CATEGORY 5: Compound Multi-Tool Concurrent Query")

    inquiries = [
        (
            "English",
            "Status and omni blending",
            "Please check the status of ticket #275424000000582039 and also explain how CZ Omni manages interaction blending."
        ),
        (
            "Hinglish",
            "Status aur blending inquiry",
            "ticket 275424000000582039 ka status check karein aur ye bhi batayein ki CZ Omni channel blending kaise karta hai."
        ),
        (
            "Hindi",
            "टिकट स्थिति और चैनल ब्लेंडिंग",
            "कृपया टिकट 275424000000582039 की स्थिति जांचें और यह भी बताएं कि CZ Omni चैनल ब्लेंडिंग कैसे संभालता है।"
        )
    ]

    for lang, subj, body in inquiries:
        execute_turn("Category 5", lang, subj, body, step=0)


def main():
    print("🚀 STARTING COMPREHENSIVE MULTILINGUAL PIPELINE TEST HARNESS")
    print(f"Client: {CLIENT_ID} | Sender: {SENDER}")
    
    t_start = time.time()
    try:
        test_category_1_knowledge_inquiry()
        test_category_2_troubleshooting_resolved()
        test_category_3_troubleshooting_escalation()
        test_category_4_ticket_status_lookup()
        test_category_5_compound_concurrent_query()
    except Exception as e:
        print(f"\n❌ Test execution failed with exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    total_time = time.time() - t_start
    banner(f"🎉 ALL MULTILINGUAL PIPELINE TESTS COMPLETED IN {total_time:.2f}s")


if __name__ == "__main__":
    main()

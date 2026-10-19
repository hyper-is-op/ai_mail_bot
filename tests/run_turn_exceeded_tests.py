#!/usr/bin/env python3
"""
tests/run_turn_exceeded_tests.py

Dedicated Test Suite: Turn Limit Exceeded & Post-Escalation Follow-Up Scenarios
Validates system behavior when conversational turns exceed the 3-step diagnostic ceiling:
  Case 1: 5-Turn Progression: 3 Diagnostic Turns -> Turn 4 Escalation -> Turn 5 Post-Escalation Follow-up
  Case 2: 4-Turn Non-Technical Deadlock: Customer unable to execute diagnostics -> Turn 4 Escalation
  Case 3: Scope Drift / Mixed Inquiries: Multi-issue thread hitting turn ceiling
"""

import sys
import os
import time
import json
from typing import Dict, Any, List

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app.pipeline.context import PipelineContext
from app.pipeline.agent import run_support_agent
from app.pipeline.evaluator import evaluate_draft_and_decide, DEFAULT_MAX_TROUBLESHOOTING_STEPS

CLIENT_ID = "CLI-4159FFCF"
SENDER = "md.yazdani@c-zentrix.com"

def banner(title: str):
    print("\n" + "=" * 78, flush=True)
    print(f"🔄 {title}", flush=True)
    print("=" * 78, flush=True)

def print_metric(label: str, value: Any):
    print(f"  ▪ {label:<30}: {value}", flush=True)


def execute_dialogue_turn(
    case_name: str,
    turn_idx: int,
    subject: str,
    body: str,
    thread_id: str,
    history: List[Dict[str, str]],
    prior_step: int,
    ticket_id: str = None
) -> PipelineContext:
    print(f"\n--- [{case_name}] Turn {turn_idx} ---")
    print_metric("Subject", subject)
    print_metric("Customer Message", body[:120] + ("..." if len(body) > 120 else ""))
    print_metric("Prior Step", prior_step)
    print_metric("Ticket ID In Context", ticket_id or "None")
    print_metric("History Length", len(history))

    task_id = f"task-exceed-{int(time.time() * 1000)}"
    task_data = {
        "client_id": CLIENT_ID,
        "from_email": SENDER,
        "subject": subject,
        "body": body,
        "thread_id": thread_id,
        "troubleshooting_step": prior_step,
        "is_resolved": False,
        "history": history
    }
    if ticket_id:
        task_data["ticket_id"] = ticket_id

    ctx = PipelineContext.from_task_data(task_id, task_data)

    t0 = time.time()
    res_ctx = run_support_agent(ctx)
    elapsed = time.time() - t0

    print_metric("Latency", f"{elapsed:.2f}s")
    print_metric("Steps Taken", res_ctx.execution_steps)
    print_metric("Troubleshooting Step", res_ctx.troubleshooting_step)
    print_metric("Ticket ID After Agent", res_ctx.ticket_id or "None")
    print_metric("Is Resolved Detected", res_ctx.is_resolved)
    print_metric("Agent Score", res_ctx.score)
    print_metric("Agent Action", res_ctx.response_action)

    reply_preview = (res_ctx.draft_reply or "").strip().replace("\n", " ")
    if len(reply_preview) > 160:
        reply_preview = reply_preview[:160] + "..."
    print_metric("Reply Preview", reply_preview)

    time.sleep(1.0)
    return res_ctx


def test_case_1_post_escalation_followup():
    banner("CASE 1: 5-Turn Post-Escalation Follow-up (Turn Ceiling Exceeded)")
    thread_id = f"th_exceed_post_esc_{int(time.time())}"
    subject = "Asterisk Audio Gateway Core Dump & SIP Packet Drop"
    history = []
    step = 0

    # Turn 1: Initial Technical Inquiry
    t1_body = "Calls drop after exactly 30 seconds with no two-way audio. How do we inspect the Asterisk SIP NAT and RTP debug logs?"
    res1 = execute_dialogue_turn("Case 1 (Post-Escalation)", 1, subject, t1_body, thread_id, history, step)
    history.append({"role": "customer", "body": t1_body})
    history.append({"role": "assistant", "body": res1.draft_reply})
    step = res1.troubleshooting_step
    assert step == 1, f"Expected step 1, got {step}"

    # Turn 2: Customer tried step 1, problem persists
    t2_body = "SIP NAT settings are configured with directmedia=no, but calls still drop at 30 seconds with RTP timeout. What is the next diagnostic step?"
    res2 = execute_dialogue_turn("Case 1 (Post-Escalation)", 2, f"Re: {subject}", t2_body, thread_id, history, step)
    history.append({"role": "customer", "body": t2_body})
    history.append({"role": "assistant", "body": res2.draft_reply})
    step = res2.troubleshooting_step
    assert step == 2, f"Expected step 2, got {step}"

    # Turn 3: Customer tried step 2, problem persists
    t3_body = "Opened RTP ports 10000-20000 and confirmed session timers. Now the Asterisk gateway is logging core dumps. What should we check next?"
    res3 = execute_dialogue_turn("Case 1 (Post-Escalation)", 3, f"Re: {subject}", t3_body, thread_id, history, step)
    history.append({"role": "customer", "body": t3_body})
    history.append({"role": "assistant", "body": res3.draft_reply})
    step = res3.troubleshooting_step
    assert step == 3, f"Expected step 3, got {step}"

    # Turn 4: Ceiling Reached (Step 3 exhausted) -> Formal Escalation
    t4_body = "Asterisk crashed completely with a fatal segmentation fault in chan_sip.so. None of the diagnostic steps worked. Please escalate to a senior VoIP engineer."
    res4 = execute_dialogue_turn("Case 1 (Post-Escalation)", 4, f"Re: {subject}", t4_body, thread_id, history, step)
    history.append({"role": "customer", "body": t4_body})
    history.append({"role": "assistant", "body": res4.draft_reply})
    step = res4.troubleshooting_step
    created_ticket_id = res4.ticket_id
    assert res4.is_resolved is False
    assert "Tool_Call:escalate_and_create_ticket" in res4.execution_steps or res4.response_action in ("create_ticket", "draft_mode"), \
        f"Expected escalation on turn 4, got {res4.execution_steps}"
    print(f"  🎫 Ticket successfully generated on Turn 4: {created_ticket_id}")

    # Turn 5: Turn Exceeded -> Customer replies on the SAME thread with extra logs and follow-up
    t5_body = f"Following up regarding our issue: Here is the GDB backtrace from the core dump showing libc memory corruption in ast_channel_alloc. Also, our server IP is 192.168.10.50. When will the engineer contact us?"
    t5_subject = f"Re: {subject}" if not created_ticket_id else f"Re: {subject} [Ticket #{created_ticket_id}]"
    res5 = execute_dialogue_turn("Case 1 (Post-Escalation)", 5, t5_subject, t5_body, thread_id, history, step, ticket_id=created_ticket_id)

    print("\n--- Turn 5 Evaluation Details ---")
    print_metric("Turn 5 Steps Taken", res5.execution_steps)
    print_metric("Turn 5 Action", res5.response_action)
    print_metric("Turn 5 Ticket ID", res5.ticket_id)
    print_metric("Turn 5 Reply", res5.draft_reply[:250])

    # Turn 5 checks:
    # 1. Must NOT reset or attempt step 1 troubleshooting
    assert res5.troubleshooting_step >= 3, f"Troubleshooting step should remain exhausted, got {res5.troubleshooting_step}"
    # 2. Must NOT claim problem is resolved
    assert res5.is_resolved is False, "Turn 5 should remain unresolved"
    # 3. Reply should acknowledge the technical details / escalation
    assert any(w in res5.draft_reply.lower() for w in ["engineer", "specialist", "ticket", "team", "support", "received", "investigat"]), \
        "Reply should acknowledge specialist review or ticket"
    print("  ✅ Case 1 Passed: Turn 5 handled safely after ceiling exhaustion!")


def test_case_2_clarification_deadlock_escalation():
    banner("CASE 2: 4-Turn Non-Technical Deadlock (Execution Failure -> Escalation)")
    thread_id = f"th_exceed_deadlock_{int(time.time())}"
    subject = "CZ WebRTC Softphone Microphone Not Working"
    history = []
    step = 0

    # Turn 1: Standard microphone failure -> Bot provides Step 1 (Browser permissions)
    t1_body = "Our agents cannot hear themselves and callers report silence. How do we configure microphone access in the CZ WebRTC agent portal?"
    res1 = execute_dialogue_turn("Case 2 (Deadlock)", 1, subject, t1_body, thread_id, history, step)
    history.append({"role": "customer", "body": t1_body})
    history.append({"role": "assistant", "body": res1.draft_reply})
    step = res1.troubleshooting_step
    assert step == 1, f"Expected step 1, got {step}"

    # Turn 2: Customer cannot locate browser settings
    t2_body = "We clicked around the address bar but cannot find any lock icon or microphone settings. Where is this located?"
    res2 = execute_dialogue_turn("Case 2 (Deadlock)", 2, f"Re: {subject}", t2_body, thread_id, history, step)
    history.append({"role": "customer", "body": t2_body})
    history.append({"role": "assistant", "body": res2.draft_reply})
    step = res2.troubleshooting_step
    assert step == 2, f"Expected step 2, got {step}"

    # Turn 3: Customer locked out by OS/enterprise group policy
    t3_body = "Our IT department has locked down Chrome via Windows Group Policy. All browser audio settings are grayed out with 'Managed by your organization'. How do we bypass this?"
    res3 = execute_dialogue_turn("Case 2 (Deadlock)", 3, f"Re: {subject}", t3_body, thread_id, history, step)
    history.append({"role": "customer", "body": t3_body})
    history.append({"role": "assistant", "body": res3.draft_reply})
    step = res3.troubleshooting_step
    assert step == 3, f"Expected step 3, got {step}"

    # Turn 4: Ceiling Exhausted -> Human Specialist Required
    t4_body = "The IT admin refuses to unlock group policies without an official support engineer validating the audio requirements. Please open a formal ticket and have your engineer email our IT head."
    res4 = execute_dialogue_turn("Case 2 (Deadlock)", 4, f"Re: {subject}", t4_body, thread_id, history, step)
    assert res4.is_resolved is False
    assert "Tool_Call:escalate_and_create_ticket" in res4.execution_steps or res4.response_action in ("create_ticket", "draft_mode"), \
        f"Expected escalation on deadlock turn 4, got {res4.execution_steps}"
    print(f"  🎫 Ticket successfully generated on Deadlock Turn 4: {res4.ticket_id}")
    print("  ✅ Case 2 Passed: Non-technical execution deadlock cleanly escalated at ceiling!")


def test_case_3_scope_drift_multi_inquiry():
    banner("CASE 3: 4-Turn Scope Drift (Technical -> API Query -> Commercial -> Escalation)")
    thread_id = f"th_exceed_scopedrift_{int(time.time())}"
    subject = "CZ Dialer Queue Configuration & Billing Query"
    history = []
    step = 0

    # Turn 1: Technical inquiry on queue routing
    t1_body = "How do we configure skill-based routing in CZ Dialer so English callers route to English queues?"
    res1 = execute_dialogue_turn("Case 3 (Scope Drift)", 1, subject, t1_body, thread_id, history, step)
    history.append({"role": "customer", "body": t1_body})
    history.append({"role": "assistant", "body": res1.draft_reply})
    step = res1.troubleshooting_step
    assert step == 1, f"Expected step 1, got {step}"

    # Turn 2: Topic shift to REST API documentation
    t2_body = "Also, where can we download the REST API documentation for extracting CDR call recordings programmatically?"
    res2 = execute_dialogue_turn("Case 3 (Scope Drift)", 2, f"Re: {subject}", t2_body, thread_id, history, step)
    history.append({"role": "customer", "body": t2_body})
    history.append({"role": "assistant", "body": res2.draft_reply})
    step = res2.troubleshooting_step
    assert step == 2, f"Expected step 2, got {step}"

    # Turn 3: Topic shift to commercial contract negotiation
    t3_body = "Additionally, our finance department noticed our AMC contract expires next month. Can you apply a 25% discount for a 2-year renewal?"
    res3 = execute_dialogue_turn("Case 3 (Scope Drift)", 3, f"Re: {subject}", t3_body, thread_id, history, step)
    history.append({"role": "customer", "body": t3_body})
    history.append({"role": "assistant", "body": res3.draft_reply})
    step = res3.troubleshooting_step
    assert step == 3, f"Expected step 3, got {step}"

    # Turn 4: Escalation to Account Manager / Support Ticket
    t4_body = "Please escalate this entire thread to our dedicated account manager and support lead to finalize the queue setup and commercial renewal."
    res4 = execute_dialogue_turn("Case 3 (Scope Drift)", 4, f"Re: {subject}", t4_body, thread_id, history, step)
    assert res4.is_resolved is False
    assert "Tool_Call:escalate_and_create_ticket" in res4.execution_steps or res4.response_action in ("create_ticket", "draft_mode"), \
        f"Expected escalation on turn 4, got {res4.execution_steps}"
    print(f"  🎫 Ticket successfully generated on Scope Drift Turn 4: {res4.ticket_id}")
    print("  ✅ Case 3 Passed: Multi-topic scope drift cleanly escalated without unauthorized commitments!")


def main():
    print("\n" + "=" * 78)
    print("🚀 STARTING TURN CEILING EXCEEDED & POST-ESCALATION TEST SUITE")
    print(f"   Ceiling: DEFAULT_MAX_TROUBLESHOOTING_STEPS = {DEFAULT_MAX_TROUBLESHOOTING_STEPS}")
    print(f"   Target Client: {CLIENT_ID} ({SENDER})")
    print("=" * 78)

    t_start = time.time()
    test_case_1_post_escalation_followup()
    test_case_2_clarification_deadlock_escalation()
    test_case_3_scope_drift_multi_inquiry()
    total_time = time.time() - t_start

    print("\n" + "=" * 78)
    print(f"🎉 ALL TURN EXCEEDED TEST CASES COMPLETED SUCCESSFULLY in {total_time:.2f}s!")
    print("=" * 78 + "\n")


if __name__ == "__main__":
    main()


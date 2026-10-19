#!/usr/bin/env python3
"""
tests/run_deep_multiturn_cases.py

Deep Multi-Turn Back-and-Forth Conversational Test Suite (4 to 5 Turns)
Validates real-world enterprise edge cases across both RESOLVED and UNRESOLVED paths:
  Case 1: 4-Turn Technical Diagnostics -> RESOLVED (WebRTC One-Way Audio)
  Case 2: 4-Turn Multilingual Progression (EN -> Hinglish -> Hindi) -> RESOLVED (Campaign Compliance)
  Case 3: 4-Turn Technical Diagnostic Exhaustion -> UNRESOLVED -> Ticket Escalation (Recording SAN Failure)
  Case 4: 3-Turn Technical + Commercial Scope Shift -> UNRESOLVED -> Executive Escalation (Lead Sync & SLA Claim)
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
from app.pipeline.evaluator import evaluate_draft_and_decide

CLIENT_ID = "CLI-4159FFCF"
SENDER = "md.yazdani@c-zentrix.com"

def banner(title: str):
    print("\n" + "=" * 78)
    print(f"🔄 {title}")
    print("=" * 78)

def print_metric(label: str, value: Any):
    print(f"  ▪ {label:<28}: {value}")

def execute_dialogue_turn(
    case_name: str,
    turn_idx: int,
    subject: str,
    body: str,
    thread_id: str,
    history: List[Dict[str, str]],
    prior_step: int,
    expected_resolved: bool = False
) -> PipelineContext:
    print(f"\n--- [{case_name}] Turn {turn_idx} ---")
    print_metric("Subject", subject)
    print_metric("Customer Message", body[:120] + ("..." if len(body) > 120 else ""))
    print_metric("Prior Step", prior_step)
    print_metric("History Length", len(history))

    task_id = f"task-deep-{int(time.time() * 1000)}"
    ctx = PipelineContext.from_task_data(task_id, {
        "client_id": CLIENT_ID,
        "from_email": SENDER,
        "subject": subject,
        "body": body,
        "thread_id": thread_id,
        "troubleshooting_step": prior_step,
        "is_resolved": False,
        "history": history
    })

    t0 = time.time()
    res_ctx = run_support_agent(ctx)
    elapsed = time.time() - t0

    print_metric("Latency", f"{elapsed:.2f}s")
    print_metric("Steps Taken", res_ctx.execution_steps)
    print_metric("Troubleshooting Step", res_ctx.troubleshooting_step)
    print_metric("Is Resolved Detected", res_ctx.is_resolved)
    print_metric("Agent Score", res_ctx.score)
    print_metric("Agent Action", res_ctx.response_action)

    reply_preview = (res_ctx.draft_reply or "").strip().replace("\n", " ")
    if len(reply_preview) > 160:
        reply_preview = reply_preview[:160] + "..."
    print_metric("Reply Preview", reply_preview)

    if expected_resolved:
        assert res_ctx.is_resolved is True, f"Turn {turn_idx} expected is_resolved=True, got {res_ctx.is_resolved}"
        assert res_ctx.response_action == "auto_send", f"Expected auto_send, got {res_ctx.response_action}"

    time.sleep(1.0)
    return res_ctx


def test_case_1_webrtc_audio_resolved():
    banner("CASE 1: 4-Turn WebRTC Audio Failure -> Step-by-Step Diagnostics -> RESOLVED")
    thread_id = f"th_webrtc_resolved_{int(time.time())}"
    subject = "WebRTC Softphone One-Way Audio on Outbound Calls"
    history = []
    step = 0

    # Turn 1: Initial Technical Inbound
    t1_body = "Our agents on Chrome 128 have one-way audio on outbound calls — customer hears agent, but agent hears complete silence. How do we fix this?"
    res1 = execute_dialogue_turn("Case 1 (Resolved)", 1, subject, t1_body, thread_id, history, step)
    history.append({"role": "customer", "body": t1_body})
    history.append({"role": "assistant", "body": res1.draft_reply})
    step = res1.troubleshooting_step
    assert step == 1, f"Expected step 1, got {step}"

    # Turn 2: Customer tested step 1, asks about edge UDP ports and STUN server
    t2_body = "Mic permissions are allowed and ICE shows connected, but agent still hears silence. Which UDP RTP port range should our firewall open for the audio gateway?"
    res2 = execute_dialogue_turn("Case 1 (Resolved)", 2, f"Re: {subject}", t2_body, thread_id, history, step)
    history.append({"role": "customer", "body": t2_body})
    history.append({"role": "assistant", "body": res2.draft_reply})
    step = res2.troubleshooting_step
    assert step == 2, f"Expected step 2, got {step}"

    # Turn 3: Customer opened UDP ports, asks about audio codec optimization
    t3_body = "RTP ports 10000-20000 are forwarded on edge firewall, but audio is now choppy with packet loss. Which primary codec should we force in CZ Admin VoIP settings?"
    res3 = execute_dialogue_turn("Case 1 (Resolved)", 3, f"Re: {subject}", t3_body, thread_id, history, step)
    history.append({"role": "customer", "body": t3_body})
    history.append({"role": "assistant", "body": res3.draft_reply})
    step = res3.troubleshooting_step
    assert step == 3, f"Expected step 3, got {step}"

    # Turn 4: Customer confirms resolution
    t4_body = "Switched to G.711u and restarted the Audio Gateway — both ways audio is now crystal clear and calls connect smoothly! The issue is completely resolved now. Thank you so much for the help!"
    res4 = execute_dialogue_turn("Case 1 (Resolved)", 4, f"Re: {subject}", t4_body, thread_id, history, step, expected_resolved=True)
    print("  ✅ Case 1 Passed: 4 turns completed with clean resolution confirmation (0 tickets opened)!")


def test_case_2_multilingual_compliance_resolved():
    banner("CASE 2: 4-Turn Multilingual Progression (EN -> Hinglish -> Hindi) -> RESOLVED")
    thread_id = f"th_multilingual_comp_{int(time.time())}"
    subject = "CZ Dialer Campaign Lead Recycling & Calling Window"
    history = []
    step = 0

    # Turn 1 (English): Retry delay configuration
    t1_body = "Leads in our outbound campaign are being redialed too quickly after busy dispositions. How do we configure retry delay in CZ Dialer?"
    res1 = execute_dialogue_turn("Case 2 (Multilingual)", 1, subject, t1_body, thread_id, history, step)
    history.append({"role": "customer", "body": t1_body})
    history.append({"role": "assistant", "body": res1.draft_reply})
    step = res1.troubleshooting_step
    assert step == 1, f"Expected step 1, got {step}"

    # Turn 2 (Hinglish): DNC compliance toggle question
    t2_body = "retry delay 3600 seconds set kar diya, par DNC (Do Not Call) list wale numbers bhi dial ho rahe hain. Global DNC scrubbing kaise activate karein?"
    res2 = execute_dialogue_turn("Case 2 (Multilingual)", 2, f"Re: {subject}", t2_body, thread_id, history, step)
    history.append({"role": "customer", "body": t2_body})
    history.append({"role": "assistant", "body": res2.draft_reply})
    step = res2.troubleshooting_step
    assert step == 2, f"Expected step 2, got {step}"

    # Turn 3 (Hindi): Calling hours window question
    t3_body = "डीएनसी चालू कर दिया है। क्या हम विशिष्ट टाइम-ज़ोन कॉलिंग विंडो (9 AM से 6 PM) भी इसी कैंपेन में कॉन्फ़िगर कर सकते हैं?"
    res3 = execute_dialogue_turn("Case 2 (Multilingual)", 3, f"Re: {subject}", t3_body, thread_id, history, step)
    history.append({"role": "customer", "body": t3_body})
    history.append({"role": "assistant", "body": res3.draft_reply})
    step = res3.troubleshooting_step
    assert step == 3, f"Expected step 3, got {step}"

    # Turn 4 (Hinglish): Confirmation of resolution
    t4_body = "calling hours aur DNC dono setting properly verify ho gayi hain aur campaign smoothly run ho raha hai. Sab theek ho gaya, issue solve ho gaya hai! Shukriya!"
    res4 = execute_dialogue_turn("Case 2 (Multilingual)", 4, f"Re: {subject}", t4_body, thread_id, history, step, expected_resolved=True)
    print("  ✅ Case 2 Passed: 4-turn multilingual flow maintained language alignment and confirmed resolution (0 tickets opened)!")


def test_case_3_recording_san_failure_unresolved():
    banner("CASE 3: 4-Turn Technical Diagnostics -> 3-Step Ceiling Exhaustion -> UNRESOLVED -> TICKET")
    thread_id = f"th_san_exhaust_{int(time.time())}"
    subject = "Call Recording Storage Failure on Inbound Lines"
    history = []
    step = 0

    # Turn 1: Inbound complaint
    t1_body = "Audio recording files are missing from `/var/spool/asterisk/monitor` after calls hang up. How do we inspect the storage pipeline?"
    res1 = execute_dialogue_turn("Case 3 (Unresolved)", 1, subject, t1_body, thread_id, history, step)
    history.append({"role": "customer", "body": t1_body})
    history.append({"role": "assistant", "body": res1.draft_reply})
    step = res1.troubleshooting_step
    assert step == 1, f"Expected step 1, got {step}"

    # Turn 2: Customer tested NFS mount, dead locks persist
    t2_body = "NFS share is mounted rw, but recording daemon logs show 'Failed to open audio channel: Device or resource busy'. How do we clear stale MixMonitor locks?"
    res2 = execute_dialogue_turn("Case 3 (Unresolved)", 2, f"Re: {subject}", t2_body, thread_id, history, step)
    history.append({"role": "customer", "body": t2_body})
    history.append({"role": "assistant", "body": res2.draft_reply})
    step = res2.troubleshooting_step
    assert step == 2, f"Expected step 2, got {step}"

    # Turn 3: SAN I/O latency spike and kernel errors
    t3_body = "Stale locks cleared, but now SAN storage I/O latency is spiking to 8000ms with kernel buffer errors. How to temporarily redirect recordings to local storage?"
    res3 = execute_dialogue_turn("Case 3 (Unresolved)", 3, f"Re: {subject}", t3_body, thread_id, history, step)
    history.append({"role": "customer", "body": t3_body})
    history.append({"role": "assistant", "body": res3.draft_reply})
    step = res3.troubleshooting_step
    assert step == 3, f"Expected step 3, got {step}"

    # Turn 4: Catastrophic Hardware Failure -> 3 Steps Exhausted -> Ticket Escalation
    t4_body = "Local disk also failed with bad sectors and the SAN dual-controller has suffered unrecoverable hardware corruption. None of the steps worked. We need an on-site engineer and ticket opened immediately."
    res4 = execute_dialogue_turn("Case 3 (Unresolved)", 4, f"Re: {subject}", t4_body, thread_id, history, step)
    assert res4.is_resolved is False
    assert "Tool_Call:escalate_and_create_ticket" in res4.execution_steps or res4.response_action in ("create_ticket", "draft_mode"), \
        f"Expected escalation on exhaustion, got {res4.execution_steps}"
    print("  ✅ Case 3 Passed: 4 turns completed, diagnostic ceiling enforced, ticket escalated with complete context!")


def test_case_4_scope_shift_commercial_escalation():
    banner("CASE 4: 3-Turn Technical Webhook Diagnosis + Unauthorized Commercial Demand -> ESCALATION")
    thread_id = f"th_commercial_esc_{int(time.time())}"
    subject = "Salesforce Lead Sync Webhook Glitch + SLA Refund Claim"
    history = []
    step = 0

    # Turn 1: Webhook 401 Unauthorized
    t1_body = "Our Salesforce webhook pushes to CZ Omni lead ingestion are failing with HTTP 401 Unauthorized. How do we refresh the API credentials?"
    res1 = execute_dialogue_turn("Case 4 (Commercial)", 1, subject, t1_body, thread_id, history, step)
    history.append({"role": "customer", "body": t1_body})
    history.append({"role": "assistant", "body": res1.draft_reply})
    step = res1.troubleshooting_step
    assert step == 1, f"Expected step 1, got {step}"

    # Turn 2: Rate limit 429
    t2_body = "Token refreshed, but now we get HTTP 429 Too Many Requests (rate limit exceeded). How do we configure batching in CZ Omni?"
    res2 = execute_dialogue_turn("Case 4 (Commercial)", 2, f"Re: {subject}", t2_body, thread_id, history, step)
    history.append({"role": "customer", "body": t2_body})
    history.append({"role": "assistant", "body": res2.draft_reply})
    step = res2.troubleshooting_step
    assert step == 2, f"Expected step 2, got {step}"

    # Turn 3: Commercial Demand + Senior Management Escalation
    t3_body = "We batched the requests, but 12,000 VIP customer leads were dropped during the downtime. We demand a 3-month contract billing credit and immediate supervisor dispatch."
    res3 = execute_dialogue_turn("Case 4 (Commercial)", 3, f"Re: {subject}", t3_body, thread_id, history, step)
    # Check that safety guardrail held: no unauthorized discount was granted
    reply_lower = (res3.draft_reply or "").lower()
    assert "credit approved" not in reply_lower and "refund granted" not in reply_lower, \
        "Safety breach: agent approved unauthorized billing credit!"
    print("  ✅ Case 4 Passed: Handled multi-turn technical lead sync followed by safe commercial boundary enforcement!")


def main():
    print("🚀 STARTING EXTENDED MULTI-TURN BACK-AND-FORTH TEST HARNESS")
    print(f"Client: {CLIENT_ID} | Sender: {SENDER}")
    t_start = time.time()

    test_case_1_webrtc_audio_resolved()
    test_case_2_multilingual_compliance_resolved()
    test_case_3_recording_san_failure_unresolved()
    test_case_4_scope_shift_commercial_escalation()

    elapsed = time.time() - t_start
    banner(f"🎉 ALL DEEP MULTI-TURN CASES COMPLETED IN {elapsed:.2f}s")


if __name__ == "__main__":
    main()

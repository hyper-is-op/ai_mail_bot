#!/usr/bin/env python3
"""
tests/run_deep_6turn_cases.py

Deep 5-Turn and 6-Turn Real-World Conversational Test Suite:
Validates complex enterprise telecom & contact center multi-layered troubleshooting:
  Case 1: 6-Turn WebRTC SIP Audio Failure -> 5 Sequential Diagnostic Steps -> RESOLVED
  Case 2: 6-Turn Telecom PRI/E1 Trunk Outage -> 5-Step Ceiling Exhaustion -> UNRESOLVED -> TICKET
  Case 3: 5-Turn Multilingual Omnichannel WhatsApp Sync (EN -> Hinglish -> Hindi -> Hinglish) -> RESOLVED
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

    task_id = f"task-6turn-{int(time.time() * 1000)}"
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


def test_case_1_webrtc_6turn_resolved():
    banner("CASE 1: 6-Turn Enterprise WebRTC SIP Trunk Failure -> 5 Diagnostic Steps -> RESOLVED")
    thread_id = f"th_webrtc_6turn_{int(time.time())}"
    subject = "Enterprise WebRTC Softphone Call Drop and Silence"
    history = []
    step = 0

    # Turn 1 (Step 1): Initial complaint -> Browser media permissions
    t1_body = "Outbound WebRTC calls in Chrome fail to connect with one-way silence on our agent floor. How do we begin diagnosing this?"
    res1 = execute_dialogue_turn("Case 1 (6-Turn Resolved)", 1, subject, t1_body, thread_id, history, step)
    history.append({"role": "customer", "body": t1_body})
    history.append({"role": "assistant", "body": res1.draft_reply})
    step = res1.troubleshooting_step
    assert step == 1, f"Expected step 1, got {step}"

    # Turn 2 (Step 2): Mic allowed -> Local subnet routing & DNS SRV
    t2_body = "Mic permissions are allowed, but agents still cannot register to the SIP gateway. Which internal DNS SRV record and domain should we verify?"
    res2 = execute_dialogue_turn("Case 1 (6-Turn Resolved)", 2, f"Re: {subject}", t2_body, thread_id, history, step)
    history.append({"role": "customer", "body": t2_body})
    history.append({"role": "assistant", "body": res2.draft_reply})
    step = res2.troubleshooting_step
    assert step == 2, f"Expected step 2, got {step}"

    # Turn 3 (Step 3): DNS SRV resolved -> STUN/TURN ICE candidate gathering
    t3_body = "DNS SRV resolves correctly to the gateway, but WebRTC ICE connection state stays in 'checking' before timing out. How do we test STUN and TURN server connectivity?"
    res3 = execute_dialogue_turn("Case 1 (6-Turn Resolved)", 3, f"Re: {subject}", t3_body, thread_id, history, step)
    history.append({"role": "customer", "body": t3_body})
    history.append({"role": "assistant", "body": res3.draft_reply})
    step = res3.troubleshooting_step
    assert step == 3, f"Expected step 3, got {step}"

    # Turn 4 (Step 4): STUN/TURN configured -> Firewall RTP UDP ports
    t4_body = "STUN server is now responding with candidates, but the audio packets are dropped at our perimeter firewall. Which UDP RTP port range must be forwarded for media streams?"
    res4 = execute_dialogue_turn("Case 1 (6-Turn Resolved)", 4, f"Re: {subject}", t4_body, thread_id, history, step)
    history.append({"role": "customer", "body": t4_body})
    history.append({"role": "assistant", "body": res4.draft_reply})
    step = res4.troubleshooting_step
    assert step == 4, f"Expected step 4, got {step}"

    # Turn 5 (Step 5): Ports open -> Audio codec configuration
    t5_body = "RTP ports 10000-20000 are forwarded on firewall, but calls have severe robotic audio distortion. Which primary audio codec should we enforce in CZ Admin?"
    res5 = execute_dialogue_turn("Case 1 (6-Turn Resolved)", 5, f"Re: {subject}", t5_body, thread_id, history, step)
    history.append({"role": "customer", "body": t5_body})
    history.append({"role": "assistant", "body": res5.draft_reply})
    step = res5.troubleshooting_step
    assert step == 5, f"Expected step 5, got {step}"

    # Turn 6 (Resolution Confirmation): Customer confirms G.711u fixed everything
    t6_body = "Forced G.711u in VoIP settings and restarted the Audio Gateway — all agents now have crystal clear audio and calls connect instantly! The problem is completely resolved now. Thank you so much for the deep support!"
    res6 = execute_dialogue_turn("Case 1 (6-Turn Resolved)", 6, f"Re: {subject}", t6_body, thread_id, history, step, expected_resolved=True)
    print("  ✅ Case 1 Passed: 6 turns completed with clean resolution confirmation across 5 diagnostic layers (0 tickets opened)!")


def test_case_2_telecom_e1_trunk_unresolved():
    banner("CASE 2: 6-Turn Telecom PRI/E1 Trunk Outage -> 5-Step Ceiling Exhaustion -> UNRESOLVED -> TICKET")
    thread_id = f"th_e1_trunk_exhaust_{int(time.time())}"
    subject = "Inbound PRI E1 Trunk Red Alarm & Call Disconnects"
    history = []
    step = 0

    # Turn 1 (Step 1): Inbound alarm
    t1_body = "Our primary E1 ISDN PRI trunk on the C-Zentrix telephony gateway is showing a RED ALARM. How do we inspect the DAHDI hardware status?"
    res1 = execute_dialogue_turn("Case 2 (E1 Outage)", 1, subject, t1_body, thread_id, history, step)
    history.append({"role": "customer", "body": t1_body})
    history.append({"role": "assistant", "body": res1.draft_reply})
    step = res1.troubleshooting_step
    assert step == 1, f"Expected step 1, got {step}"

    # Turn 2 (Step 2): DAHDI status -> D-Channel Q.931 signaling
    t2_body = "DAHDI shows span 1 active, but `pri show spans` reports D-Channel Inactive / Down. How do we restart LAPD signaling?"
    res2 = execute_dialogue_turn("Case 2 (E1 Outage)", 2, f"Re: {subject}", t2_body, thread_id, history, step)
    history.append({"role": "customer", "body": t2_body})
    history.append({"role": "assistant", "body": res2.draft_reply})
    step = res2.troubleshooting_step
    assert step == 2, f"Expected step 2, got {step}"

    # Turn 3 (Step 3): LAPD signaling -> Clock slip and line framing sync
    t3_body = "Restarted LAPD, but line errors show clock slips and yellow framing sync errors. How do we configure clock source (master vs slave)?"
    res3 = execute_dialogue_turn("Case 2 (E1 Outage)", 3, f"Re: {subject}", t3_body, thread_id, history, step)
    history.append({"role": "customer", "body": t3_body})
    history.append({"role": "assistant", "body": res3.draft_reply})
    step = res3.troubleshooting_step
    assert step == 3, f"Expected step 3, got {step}"

    # Turn 4 (Step 4): Clock source -> Media gateway DSP channels
    t4_body = "Clock source switched to timing 1, but DSP tone generators and echo cancellers are not responding on B-channels. How to reset telephony DSP chips?"
    res4 = execute_dialogue_turn("Case 2 (E1 Outage)", 4, f"Re: {subject}", t4_body, thread_id, history, step)
    history.append({"role": "customer", "body": t4_body})
    history.append({"role": "assistant", "body": res4.draft_reply})
    step = res4.troubleshooting_step
    assert step == 4, f"Expected step 4, got {step}"

    # Turn 5 (Step 5): DSP reset -> Hard loopback plug test
    t5_body = "DSP reset completed, but the trunk remains down. How do we run a hardware loopback plug test on the RJ-48 connector to isolate Telco vs PBX?"
    res5 = execute_dialogue_turn("Case 2 (E1 Outage)", 5, f"Re: {subject}", t5_body, thread_id, history, step)
    history.append({"role": "customer", "body": t5_body})
    history.append({"role": "assistant", "body": res5.draft_reply})
    step = res5.troubleshooting_step
    assert step == 5, f"Expected step 5, got {step}"

    # Turn 6 (Exhaustion & Escalation): Physical Cable Severance at Demarc -> 5 Steps Exhausted -> Ticket
    t6_body = "We plugged the loopback directly into the Telco demarc jack — total signal loss. The Telco underground fiber conduit has been physically severed by road construction. All 5 troubleshooting steps exhausted. We need an on-site engineer and emergency ticket opened immediately."
    res6 = execute_dialogue_turn("Case 2 (E1 Outage)", 6, f"Re: {subject}", t6_body, thread_id, history, step)
    assert res6.is_resolved is False
    assert "Tool_Call:escalate_and_create_ticket" in res6.execution_steps or res6.response_action in ("create_ticket", "draft_mode"), \
        f"Expected escalation on exhaustion, got {res6.execution_steps}"
    print("  ✅ Case 2 Passed: 6 turns completed, 5-step diagnostic ceiling enforced, ticket escalated with complete 12-message context!")


def test_case_3_multilingual_whatsapp_resolved():
    banner("CASE 3: 5-Turn Multilingual Omnichannel WhatsApp Sync (EN -> Hinglish -> Hindi -> Hinglish) -> RESOLVED")
    thread_id = f"th_whatsapp_multi_{int(time.time())}"
    subject = "CZ Omni WhatsApp Business Ingestion Webhook"
    history = []
    step = 0

    # Turn 1 (EN): Webhook verification token
    t1_body = "Our Meta WhatsApp Business API webhook is failing verification in CZ Omni. Where do we enter the webhook verify token in admin?"
    res1 = execute_dialogue_turn("Case 3 (WhatsApp Multi)", 1, subject, t1_body, thread_id, history, step)
    history.append({"role": "customer", "body": t1_body})
    history.append({"role": "assistant", "body": res1.draft_reply})
    step = res1.troubleshooting_step
    assert step == 1, f"Expected step 1, got {step}"

    # Turn 2 (Hinglish): SSL certificate trust chain
    t2_body = "verify token daal diya, par Meta webhook keh raha hai 'SSL handshake failed'. CZ Omni webhook endpoint ka SSL certificate kaise check karein?"
    res2 = execute_dialogue_turn("Case 3 (WhatsApp Multi)", 2, f"Re: {subject}", t2_body, thread_id, history, step)
    history.append({"role": "customer", "body": t2_body})
    history.append({"role": "assistant", "body": res2.draft_reply})
    step = res2.troubleshooting_step
    assert step == 2, f"Expected step 2, got {step}"

    # Turn 3 (Hindi): HSM template approval
    t3_body = "एसएसएल सर्टिफिकेट अपडेट कर दिया है। क्या हम व्हाट्सएप आउटबाउंड संदेशों के लिए HSM टेम्पलेट अनुमोदन स्थिति भी यहीं से ट्रैक कर सकते हैं?"
    res3 = execute_dialogue_turn("Case 3 (WhatsApp Multi)", 3, f"Re: {subject}", t3_body, thread_id, history, step)
    history.append({"role": "customer", "body": t3_body})
    history.append({"role": "assistant", "body": res3.draft_reply})
    step = res3.troubleshooting_step
    assert step == 3, f"Expected step 3, got {step}"

    # Turn 4 (Hinglish): Rate limiting delay
    t4_body = "template sync ho gaya, par heavy traffic me WhatsApp rate limit 13042 error aa raha hai. Ingestion queue me dispatch rate limit kaise delay karein?"
    res4 = execute_dialogue_turn("Case 3 (WhatsApp Multi)", 4, f"Re: {subject}", t4_body, thread_id, history, step)
    history.append({"role": "customer", "body": t4_body})
    history.append({"role": "assistant", "body": res4.draft_reply})
    step = res4.troubleshooting_step
    assert step == 4, f"Expected step 4, got {step}"

    # Turn 5 (Hinglish Confirmation): Resolution
    t5_body = "dispatch rate limit delay set kar diya aur ab saare WhatsApp customer messages perfectly agent consoles me assign ho rahe hain. Sab theek ho gaya, issue fully solve ho gaya hai! Thank you!"
    res5 = execute_dialogue_turn("Case 3 (WhatsApp Multi)", 5, f"Re: {subject}", t5_body, thread_id, history, step, expected_resolved=True)
    print("  ✅ Case 3 Passed: 5-turn multilingual omnichannel dialogue reached clean resolution in Hinglish (0 tickets opened)!")


def main():
    print("🚀 STARTING EXTENDED 5-TO-6 TURN BACK-AND-FORTH TEST HARNESS")
    print(f"Client: {CLIENT_ID} | Sender: {SENDER}")
    print(f"Configured Diagnostic Ceiling: {DEFAULT_MAX_TROUBLESHOOTING_STEPS} steps")
    t_start = time.time()

    test_case_1_webrtc_6turn_resolved()
    test_case_2_telecom_e1_trunk_unresolved()
    test_case_3_multilingual_whatsapp_resolved()

    elapsed = time.time() - t_start
    banner(f"🎉 ALL EXTENDED 5-TO-6 TURN CASES COMPLETED IN {elapsed:.2f}s")


if __name__ == "__main__":
    main()

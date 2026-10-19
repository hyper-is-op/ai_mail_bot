# Decisions: Step 125 - Extend Diagnostic Ceiling to 5 Steps and 6-Turn Cases

## 1. Diagnostic Step Ceiling Expansion (3 -> 5 Steps)
- **Decision**: Raised `DEFAULT_MAX_TROUBLESHOOTING_STEPS = 5` in `app/pipeline/evaluator.py`.
- **Rationale**: Real-world telecommunication and contact center architectures (PBX, WebRTC media gateways, SBC, E1 PRI signaling, WhatsApp webhooks) involve multi-layered diagnostic dependencies (Client -> Network -> NAT/ICE -> Firewall -> Codec/DSP). A 3-step ceiling prematurely escalated complex cases that require 4 or 5 legitimate diagnostic iterations.
- **Safety Boundary**: The ceiling still strictly prevents runaway loops — any thread failing 5 steps is forced to escalate on Turn 6 with a full CRM ticket.

## 2. Conversation History Memory Expansion (12 -> 16 Messages)
- **Decision**: Expanded `ctx.history[-16:]` in `app/pipeline/agent.py`.
- **Rationale**: In a 6-to-7 turn dialogue (12 to 14 messages), the previous 12-message slice would drop the original inbound complaint. 16 messages preserves up to 8 full conversational round-trips while remaining well within token limits (~2,500-3,500 tokens).

## 3. CRM Ticket Transcript Expansion (8 -> 12 Messages)
- **Decision**: Expanded CRM ticket context transcription from 8 to 12 messages in `app/pipeline/tools.py` and `app/context_data.py`.
- **Rationale**: When a complex 5-step diagnostic chain fails and escalates, L2/L3 telephony engineers require the full chronological progression of diagnostic tests to avoid duplicating steps already verified by the customer.

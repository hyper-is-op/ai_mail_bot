# Decisions: Step 122 - Deep Multi-Turn Back-and-Forth Dialogue Scenarios

## 1. Conversation History Window Expansion (6 -> 12 Messages)
- **Problem**: `app/pipeline/agent.py` previously sliced `ctx.history[-6:]`. In a 4-turn or 5-turn dialogue (8 to 10 back-and-forth messages), the original customer inquiry and early diagnostic steps were truncated from the prompt, causing the LLM to lose the foundational problem statement.
- **Decision**: Expanded history slice to `ctx.history[-12:]` (up to 6 full round-trips).
- **Rationale**: 12 messages of typical customer emails consume ~1,500-2,500 tokens, which easily fits within the 8k-32k context windows of modern models while preserving thread continuity.

## 2. CRM Diagnostic Context Window Expansion (4 -> 8 Messages)
- **Problem**: When an issue failed 3 diagnostic attempts and escalated to CRM ticket creation (`escalate_and_create_ticket`), `app/pipeline/tools.py` transcribed only the last 4 messages, discarding the initial diagnostic steps.
- **Decision**: Expanded transcription slice to `ctx.history[-8:]` and updated `app/context_data.py:format_conversation_thread` default `max_messages` from 4 to 8.
- **Rationale**: L2/L3 support engineers inspecting escalated tickets need the complete diagnostic progression (what was tried, what logs were inspected, what errors persisted) rather than only the final failure message.

## 3. Disambiguating Active Step 3 vs. Exhaustion Escalation
- **Problem**: On Turn 3 of technical troubleshooting, `ctx.troubleshooting_step` is 2. The previous prompt string `"Current troubleshooting attempt: Step 3 of 3"` coupled with `"3 troubleshooting turns have already occurred"` caused the LLM to interpret Turn 3 as already exhausted, calling `escalate_and_create_ticket` prematurely before delivering the 3rd diagnostic step.
- **Decision**: Separated `step_info` into two distinct prompt modes:
  - Active (`troubleshooting_step in (1, 2, 3)`): Explicitly instructs the agent that diagnostic step $N$ is actively underway and to provide the instruction rather than escalating.
  - Exhausted (`troubleshooting_step >= 3` on incoming message): Explicitly informs the agent that 3 prior steps were attempted and failed, mandating CRM ticket escalation.
- **Rationale**: Prevents premature ticket creation on step 3 while strictly enforcing escalation on step 4 when diagnostics fail to resolve the problem.

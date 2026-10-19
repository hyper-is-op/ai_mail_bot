# Decisions: Step 126 - Revert Diagnostic Ceiling to 3 while Retaining Expanded Memory

## 1. Conservative Operational Default (3 Steps)
- **Decision**: Reverted `DEFAULT_MAX_TROUBLESHOOTING_STEPS = 3` in `app/pipeline/evaluator.py`.
- **Rationale**: While a 5-step ceiling is technically feasible and verified for deep telecom networking, in general enterprise support it exposes users to the risk of 5-turn bot loops when the knowledge base has gaps. A 3-step ceiling strikes the right balance between autonomous first-contact resolution and timely human escalation before customer fatigue occurs.

## 2. Retaining 16-Message Prompt Memory and 12-Message Ticket History
- **Decision**: Maintained `ctx.history[-16:]` in `app/pipeline/agent.py` and `[-12:]` in `app/pipeline/tools.py` and `app/context_data.py`.
- **Rationale**: Memory expansion provides purely positive utility. It ensures that even in longer multi-turn dialogues, customer problem statements and early diagnostic steps are preserved in both the prompt context and any downstream CRM tickets.

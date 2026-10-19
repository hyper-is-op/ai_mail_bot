# Step 126: Revert Diagnostic Ceiling to 3 while Retaining Expanded Memory Windows

## Timestamp: 2026-10-16T12:55:10+05:30

## Objective
Revert `DEFAULT_MAX_TROUBLESHOOTING_STEPS` from 5 back to the conservative production standard of 3 in `app/pipeline/evaluator.py`, while locking in the expanded LLM conversation history window (16 messages) in `app/pipeline/agent.py` and CRM ticket transcription window (12 messages) in `app/pipeline/tools.py` and `app/context_data.py`.

## Actions Executed
- Reverted `DEFAULT_MAX_TROUBLESHOOTING_STEPS = 3` in `app/pipeline/evaluator.py`.
- Preserved `ctx.history[-16:]` in `app/pipeline/agent.py`.
- Preserved `ctx.history[-12:]` in `app/pipeline/tools.py` and `max_messages = 12` in `app/context_data.py`.
- Executed unit test discovery (`python -m unittest discover tests`): 117/117 passed in 45.532s with automatic Groq 503 retry resilience.
- Executed `tests/run_deep_multiturn_cases.py` (task-1616): all 4 scenarios passed in 193.02s, validating that Turn 4 cleanly escalates on 3-step exhaustion while Turn 4 resolution cleanly closes without opening tickets.

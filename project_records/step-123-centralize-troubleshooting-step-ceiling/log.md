# Step 123: Centralize Troubleshooting Step Ceiling

## Timestamp: 2026-10-16T12:28:30+05:30

## Objective
Eliminate decentralized magic numbers across `app/pipeline/agent.py`, `app/pipeline/evaluator.py`, and `app/prompt_defaults.py` by establishing a single source of truth constant `DEFAULT_MAX_TROUBLESHOOTING_STEPS = 3` and binding agent prompting and evaluator decisions directly to it.

## Actions Executed
- Declared `DEFAULT_MAX_TROUBLESHOOTING_STEPS = 3` in `app/pipeline/evaluator.py`.
- Updated `evaluate_draft_and_decide` to accept `max_troubleshooting_steps: int = DEFAULT_MAX_TROUBLESHOOTING_STEPS`, evaluating active steps with `1 <= troubleshooting_step <= max_troubleshooting_steps` and exhaustion with `troubleshooting_step > max_troubleshooting_steps`.
- Updated `app/pipeline/agent.py` to import `DEFAULT_MAX_TROUBLESHOOTING_STEPS` and dynamically interpolate it into `step_info` generation.
- Aligned `app/prompt_defaults.py` escalation guidelines to match the centralized ceiling.
- Re-ran unit tests and verified zero regressions.

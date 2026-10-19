# Decisions: Step 123 - Centralize Troubleshooting Step Ceiling

## 1. Single Source of Truth for Diagnostic Limit
- **Decision**: Declared `DEFAULT_MAX_TROUBLESHOOTING_STEPS = 3` in `app/pipeline/evaluator.py` as the canonical default.
- **Rationale**: Eliminates magic integer literals (`3`, `4`) scattered across `app/pipeline/agent.py`, `app/pipeline/evaluator.py`, and `app/prompt_defaults.py`.
- **Impact**: Prevents prompt instruction drift and evaluator desynchronization where active diagnostic steps were previously mistaken for exhausted attempts.

## 2. Dynamic Evaluation Logic
- **Decision**: In `evaluate_draft_and_decide`, active troubleshooting is bounded by `1 <= troubleshooting_step <= max_troubleshooting_steps`, and ticket exhaustion occurs when `troubleshooting_step > max_troubleshooting_steps and not is_resolved`.
- **Rationale**: Keeps evaluation logic independent of any hardcoded step count, allowing future per-tenant overrides (`max_troubleshooting_steps`) without modifying code logic.

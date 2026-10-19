# Technical Decisions - Step 113

## Prompt Baseline Snapshot Strategy

- **Context**: The user requested a backup before optimizing/improving prompts and suggested using the documentation files (`docs/prompts_group1_configurable.md` and `docs/prompts_group2_locked.md`).
- **Options Considered**:
  1. Rely exclusively on markdown docs in `docs/`: Rejected because markdown files don't execute directly, risk drift during doc updates, and require error-prone manual copy-pasting to restore.
  2. Create a dedicated snapshot directory `backups/prompts_baseline_20261015/` containing exact code files, markdown specifications, and a 1-line shell restore script: Chosen.
- **Rationale**: Storing the executable Python files (`app/prompt_defaults.py`, `app/llm_prompts.py`) alongside the markdown specs ensures zero-risk, instantaneous 1-line rollbacks if prompt improvements cause unintended regressions.

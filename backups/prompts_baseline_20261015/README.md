# Prompt Baseline Backup (2026-10-15)

Snapshot of all prompt definitions, templates, variables, and documentation before prompt tuning.

## Files Captured
1. `prompt_defaults.py` - Core configurable prompt definitions (`agent_system_prompt`, `escalation_reply_prompt`, `ticket_update_reply_prompt`, `inquiry_reply_prompt`), multilingual directives, and factory fallbacks.
2. `llm_prompts.py` - Agent role personas and tone instructions.
3. `prompts_group1_configurable.md` - Documentation for the 4 configurable prompts.
4. `prompts_group2_locked.md` - Documentation for the 7 locked internal prompts.

## Instant Restoration Commands
If you ever need to restore everything to this baseline:

```bash
# Restore code prompts
cp backups/prompts_baseline_20261015/prompt_defaults.py app/prompt_defaults.py
cp backups/prompts_baseline_20261015/llm_prompts.py app/llm_prompts.py

# Restore documentation
cp backups/prompts_baseline_20261015/prompts_group1_configurable.md docs/prompts_group1_configurable.md
cp backups/prompts_baseline_20261015/prompts_group2_locked.md docs/prompts_group2_locked.md
```

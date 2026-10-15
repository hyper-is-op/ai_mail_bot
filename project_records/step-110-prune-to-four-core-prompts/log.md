# Step 110: Prune Configurable Prompts Registry to 4 Core Prompts

## Objective
Prune the prompt registry and settings UI down to the 4 essential prompts (`agent_system_prompt`, `escalation_reply_prompt`, `issue_resolved_reply_prompt`, `off_topic_reply_prompt`), while hardcoding internal JSON classifiers and emergency fallbacks in code to prevent user error.

## Execution Log
- **2026-10-13 16:55:30**: Initialized step record. Starting Step 1: Updating prompt defaults to the 4 core prompts.
- **2026-10-13 16:56:45**: Pruned `app/prompt_defaults.py` to strictly 4 core prompts (`agent_system_prompt`, `escalation_reply_prompt`, `issue_resolved_reply_prompt`, `off_topic_reply_prompt`) with embedded multilingual directives.
- **2026-10-13 16:57:15**: Hardcoded sensitive JSON intent classification schema in `app/llm_functions/intent.py` and 250-character summarizer in `app/llm_functions/summaries.py` to prevent user mutation or syntax corruption.
- **2026-10-13 16:57:40**: Locked pipeline emergency fallback acknowledgments and drafter closed/status ping dynamic generation in code (`app/pipeline/agent.py`, `app/pipeline/drafter.py`, `app/pipeline/enricher.py`, `app/llm_functions/replies.py`).
- **2026-10-13 16:58:20**: Updated `app/prompt_service.py` with safe string formatting and single/all factory reset handlers.
- **2026-10-13 16:59:00**: Updated frontend Prompts Studio (`frontend/src/components/settings/PromptsTab.tsx`, `frontend/src/lib/api/prompts.ts`, `frontend/src/pages/Settings.tsx`) with 4 core prompts, monospace editor, variable chips, and reset confirmation modals.
- **2026-10-13 17:00:10**: Executed MySQL database cleanup in `client_prompt_configs` table removing all obsolete prompt keys.
- **2026-10-13 17:00:50**: Verified frontend production build cleanly with `pnpm build` (0 TypeScript errors).
- **2026-10-13 17:01:10**: Executed end-to-end Python validation inside Docker container for listing prompts, retrieving default text, custom override updates, single prompt reset, and full factory reset. All assertions passed.


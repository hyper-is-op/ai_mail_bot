# Decisions: Step 110 — Prune Configurable Prompts Registry to 4 Core Prompts

## 1. Reduction from 11 Prompts to 4 Core Prompts
- **Decision**: Streamlined the prompt registry to strictly 4 essential user-configurable prompts:
  1. `agent_system_prompt`: Autonomous ReAct Agent Brain & Guidelines
  2. `escalation_reply_prompt`: Ticket Created / Escalation Handoff
  3. `issue_resolved_reply_prompt`: Issue Resolved Confirmation
  4. `off_topic_reply_prompt`: Off-Topic & Non-Support Boundary
- **Reasoning**: The other 7 prompts either duplicated the ReAct agent's core capability (such as status pings and closed ticket answers) or were sensitive engine infrastructure (such as JSON intent classification schemas and 250-character summarization) that should never be exposed to accidental user mutation.

## 2. Hardcoding Technical Classifier & Engine Prompts
- **Decision**: Hardcoded `intent_classification_prompt` in `app/llm_functions/intent.py` and `email_summary_prompt` in `app/llm_functions/summaries.py`.
- **Reasoning**: Intent classification requires an exact JSON schema for the downstream parser. Hardcoding it in Python code completely prevents user typos from breaking ingestion routing.

## 3. Database Cleanup
- **Decision**: Pruned all obsolete prompt keys from `client_prompt_configs` in MySQL.
- **Reasoning**: Ensures clean database state and eliminates orphan rows.

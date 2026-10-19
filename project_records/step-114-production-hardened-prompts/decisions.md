# Technical Decisions - Step 114

## Production-Hardened System Prompts Deployment

- **Context**: The user provided an upgraded specification for all 10 system prompts across Group 1 (Configurable) and Group 2 (Locked Engine Prompts) to resolve ambiguity, tool leaks, false-negative evaluation scores, and language mismatches.
- **Safety Fixes Applied**:
  1. **Python f-string variable escaping**: Escaped double braces (`{{customer_name}}`, `{{team_name}}`) in `app/prompt_defaults.py` so Python doesn't trigger compile-time `NameError` on module import.
  2. **JSON schema brace escaping in intent**: Escaped schema braces (`{{ "intent": ... }}`) in `app/llm_functions/intent.py` to prevent dictionary parsing exceptions in f-strings.
  3. **Tool-calling clarity for ReAct agent**: Explicitly specified that internal tool names are banned from *customer-facing email text*, preventing Groq/OpenAI native function calling from being suppressed.
  4. **Synced Prompt Catalog**: Aligned `app/prompt_defaults.py` and `app/pipeline/drafter.py` with the updated prompt specs.
- **Validation**: Executed Python import and string-formatting checks inside the live `mail_ai_api` container; verified zero syntax errors and clean formatting for all templates.

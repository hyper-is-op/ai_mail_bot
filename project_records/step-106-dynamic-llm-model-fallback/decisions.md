# Decision: Dynamic LLM Model Fallback Architecture

## Context
In `app/pipeline/agent.py`, the agent loop contained hardcoded overrides to `qwen/qwen3.6-27b` whenever model names were empty, contained `llama`, or failed tool calling on Groq. Additionally, `llm_routes.py` hardcoded `qwen/qwen3.6-27b` as an environment variable fallback default, preventing changes to `.env` (`GROQ_MODEL=qwen/qwen3.8-27b`) or admin panel overrides from taking effect.

## Alternatives Considered
1. **Keep Hardcoded String and update it to `qwen/qwen3.8-27b`**:
   - *Pros*: Quick fix.
   - *Cons*: Re-introduces the exact same issue whenever a new model is released or chosen in the Admin Panel / `.env`.
2. **Dynamic 3-Tier Precedence Hierarchy (Chosen)**:
   - *Pros*: 
     - Admin-configured client models (`client_llm_config` or `global_default_llm`) are respected without hijacking.
     - Environment variable `GROQ_MODEL` from `.env` acts as the authoritative system default.
     - Fallback retry for tool-calling failures uses `system_env_model` dynamically, avoiding infinite retry loops if the failing model is already the fallback.
     - `app/llm_pricing.py` explicitly tracks `qwen/qwen3.8-27b` at Groq's standard rate ($0.20 / $0.20 per 1M tokens).

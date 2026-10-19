# Log: step-106-dynamic-llm-model-fallback

- **2026-10-12 18:46:50 UTC+05:30**: Initialized step-106 to remove hardcoded LLM model fallbacks and adhere strictly to admin configurations and `.env` (`GROQ_MODEL`).
- **2026-10-12 18:47:05 UTC+05:30**: Modified `app/pipeline/agent.py`: removed forced override of Llama models and replaced hardcoded `qwen/qwen3.6-27b` fallback with dynamic `os.getenv("GROQ_MODEL")`.
- **2026-10-12 18:47:19 UTC+05:30**: Updated `app/llm_pricing.py` to add `qwen/qwen3.8-27b` token pricing rates ($0.20 / $0.20 per 1M tokens).
- **2026-10-12 18:47:31 UTC+05:30**: Updated `app/api/settings/llm_routes.py` to dynamically fallback to `os.getenv("GROQ_MODEL")` instead of hardcoding `qwen3.6-27b`.
- **2026-10-12 18:50:59 UTC+05:30**: Successfully validated python syntax across all modified files using `py_compile`.


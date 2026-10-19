# Architectural Decisions - Step 116

## 1. Concurrent Tool Invocation Architecture
- **Context**: The agent loop in `app/pipeline/agent.py` previously executed multi-tool calls sequentially, causing cumulative latency during compound inquiries.
- **Options Considered**:
  1. *Full Asyncio Rewriting*: Convert the entire worker pipeline, Celery tasks, and tools to `async`/`await`.
  2. *ThreadPoolExecutor with Per-Thread DB Connections*: Use `concurrent.futures.ThreadPoolExecutor` when `len(tool_calls) > 1`, provisioning independent MySQL connections (`get_db_ctx()`) per worker thread.
- **Decision**: Option 2. Celery prefork workers run synchronously. Rewriting to async would introduce high regression risk and require an async MySQL driver (e.g., aiomysql) across legacy codebase. `ThreadPoolExecutor(max_workers=min(len(tool_calls), 4))` executes tools concurrently in parallel threads while maintaining full backward compatibility. Independent database connection contexts prevent `pymysql.err.OperationalError: (2014, 'Commands out of sync')`.

## 2. Cross-Lingual Semantic Gap in RAG
- **Context**: Customers asking inquiries in Romanized Hindi/Hinglish (e.g., "mai CZ dialer ke bare me janna chahata hu") against English knowledge base docs experienced attenuated cosine similarity (~0.55–0.65), triggering false-negative `Knowledge_Search_Empty` when evaluated against the strict 0.68 threshold.
- **Options Considered**:
  1. *Dedicated LLM Translation Pre-Step*: Call Groq/OpenAI to translate every query to English before hitting Qdrant.
  2. *Global Threshold Reduction*: Lower `RAG_MIN_SCORE` globally from 0.68 to 0.50.
  3. *Three-Tier Zero-Latency Hybrid Strategy*:
     - (a) Prompt Directive: ReAct agent formulates English keywords directly.
     - (b) Pre-RAG Heuristic Keyword Extraction: Deterministic regex cleaner (`extract_indic_keywords`) strips Romanized Indic filler in <0.02ms without API calls.
     - (c) Cross-Lingual Score Relaxation: In `query_knowledge`, if strict threshold (0.68) yields 0 chunks, retry against a 0.52 floor before falling back to empty.
- **Decision**: Option 3. Option 1 adds 1.5–3 seconds of latency and token cost to every inquiry, worsening pipeline bottlenecks. Option 2 introduces severe hallucination risks by admitting low-relevance English noise chunks. Option 3 maintains zero additional API latency, removes conversational noise to boost similarity, and safely retrieves valid cross-lingual matches.

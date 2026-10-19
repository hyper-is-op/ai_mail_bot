# Step 116: Concurrent Tools & Cross-Lingual RAG Translation

## 2026-10-15T18:13:20+05:30
- Addressed issue #2: Upgraded tool execution in `app/pipeline/agent.py` to run multi-tool calls concurrently via `concurrent.futures.ThreadPoolExecutor` instead of sequential blocking.
- Addressed issue #3: Fixed cross-lingual semantic gap in RAG by adding automatic English query normalization/translation in `clean_rag_query` / `fetch_rag_context` before querying Qdrant, and instructed the agent system prompt to translate search queries to English keywords.

## 2026-10-15T18:25:30+05:30
- Implemented `extract_indic_keywords` and `has_indic_filler` in `app/text_cleaning.py` to strip Romanized Hindi/Urdu conversational filler words ("mai", "ke bare me", "janna chahata hu") and yield dense technical search terms.
- Connected keyword normalization to `clean_rag_query` in `app/pipeline/tools.py` and implemented retry with extracted keywords in `app/pipeline/enricher.py` (`fetch_rag_context`).
- Added cross-lingual relaxation floor (0.52) in `query_knowledge` (`app/rag.py`) to prevent false-negative `Knowledge_Search_Empty` when cosine similarity is attenuated by cross-lingual embeddings.

## 2026-10-15T18:32:00+05:30
- Added automated test cases: `test_07_concurrent_tool_execution`, `test_08_cross_lingual_indic_keyword_extraction`, and `test_09_clean_rag_query_bridges_cross_lingual_gap` in `tests/test_agent_tools.py`, and `test_07_cross_lingual_relaxation_floor` in `tests/test_rag_pipeline.py`.
- Executed `tests/run_all.py` inside `mail_ai_worker`: 114/114 tests passing with 0 failures and 0 errors.
- Restarted `mail_ai_worker` and `mail_ai_api` containers to load updated code in production runtime.


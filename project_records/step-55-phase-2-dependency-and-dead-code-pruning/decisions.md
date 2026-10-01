# Step 55: Decisions - Phase 2 Dependency & Dead Code Pruning

## 1. Removal of LangGraph & MCP Stack
- **Choice**: Permanently remove `app/langgraph_agent.py`, `app/mcp_server.py`, `tests/test_mcp_server.py`, and LangChain resolver helpers (`resolve_langchain_model` in `app/llm_config.py` and `app/llm.py`).
- **Rationale**: The production system uses the deterministic pipeline in `worker/tasks.py` and `app/pipeline/`. The LangGraph and MCP implementations were unused prototypes. Removing them eliminates dead code paths and allows pruning heavy external dependencies.

## 2. Python Dependency Trimming
- **Choice**: Remove `langgraph`, `langchain-mcp-adapters`, `langchain-openai`, `mcp`, `fastmcp`, and `yoyo-migrations` from `requirements.txt`.
- **Rationale**: These 6 packages add substantial weight and memory overhead to container builds without serving any active runtime functionality.

## 3. Database Migration Cleanup
- **Choice**: Delete `migrations/0001_initial.py` and `migrations/yoyo.ini`.
- **Rationale**: Schema definitions are exclusively managed in code via `app.migrations.init_schema` and `app.db_init`. The yoyo migration files were non-functional placeholders (`SELECT 1`).

## 4. Frontend Component & Package Optimization
- **Choice**: Remove `frontend/src/components/fluent/FluentSegmentedTiles.tsx` (and its export from `fluent/index.ts`), uninstall unused `zustand` from `frontend/package.json`, and delete stale `frontend/package-lock.json`.
- **Rationale**: `FluentSegmentedTiles` has zero consumers. `zustand` was never imported. `package-lock.json` was outdated compared to the active `pnpm-lock.yaml`.

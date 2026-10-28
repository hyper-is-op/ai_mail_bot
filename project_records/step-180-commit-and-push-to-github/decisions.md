# Step 180 Decisions: Test Isolation & Push Strategy

## 1. Test Isolation for Redis Chat History
- **Context**: `test_back_and_forth_scenarios.py` and `test_conversational_drift.py` were previously failing because test isolation in `setUp`/`tearDown` only deleted keys using `get_redis_main()`. Chat history operations in `app/chat_history.py` utilize `get_redis_history()` (isolated DB pool). Leftover turn history caused the worker loop to detect duplicate clarifications and bypass mock calls.
- **Decision**: Update test cleanup in `tests/run_all.py`, `tests/test_back_and_forth_scenarios.py`, and `tests/test_conversational_drift.py` to delete test keys on both Redis pools.
- **Outcome**: Deterministic test runs; 220/220 tests pass cleanly without cross-test state leakage.

## 2. Granular vs Unified Commit
- **Context**: 20 prior steps (160 to 179) and current fixes (step 180) are uncommitted in the working tree, along with untracked schema centralization, modern connector presets, clipboard utilities, test suites, and project documentation.
- **Decision**: Follow established repo commit conventions (`feat: ... (steps 160-180)`) to commit all synchronized changes and project records in a clean structured commit, and push directly to `origin/main`.

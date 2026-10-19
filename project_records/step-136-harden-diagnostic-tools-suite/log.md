# Step 136: Harden Diagnostic Tools Suite

## Objective
Harden and polish the newly implemented diagnostic tools suite (`inspect_thread.py`, `triage_recent.py`, `diag_common.py`, `check_pipeline_health.py`):
1. Resolve early venv re-exec bootstrap order in CLI tools before non-standard module imports occur.
2. Fix ANSI string width padding misalignment in `triage_recent.py` and provide `ljust_ansi` helper in `diag_common.py`.
3. Fix stale `primary` reference in `inspect_thread.py` to use `result["resolved_client_id"]`.
4. Hoist `hashlib` import to module level in `inspect_thread.py`.
5. Add `--json` flag to `triage_recent.py`.
6. Run unit tests to verify no regressions.

## Actions
- 2026-10-19 12:48: Initialized step 136 folder and commenced fixes.
- 2026-10-19 12:49: Added `strip_ansi` and `ljust_ansi` string width utilities in `diagnostic_tools/diag_common.py`.
- 2026-10-19 12:49: Added early pre-import virtualenv bootstrap checks to `inspect_thread.py`, `triage_recent.py`, `check_pipeline_health.py`, and `inspect_rag.py`.
- 2026-10-19 12:49: Hoisted `hashlib` to top of `inspect_thread.py` and replaced stale `primary` client_id reference with `result["resolved_client_id"]`.
- 2026-10-19 12:49: Replaced broken f-string ANSI padding in `triage_recent.py` with `ljust_ansi` and added `--json` output support.
- 2026-10-19 12:52: Added unit tests for ANSI formatting helpers in `tests/test_diagnostic_tools.py` (9/9 pass).
- 2026-10-19 12:53: Executed full test suite inside `mail_ai_worker` container (`python -m unittest discover -s tests -p "test_*.py"`): 140/140 tests passing in 19.013s with zero failures or regressions.

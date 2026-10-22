- 2026-10-21 14:34: Initialized step to harden thread entanglement resolution against false-positive hijacking, protect direct RFC replies, isolate quoted text, and expand stopwords.
- 2026-10-21 14:37: Created ThreadResolution tuple subclass in worker/tasks.py with is_rfc_match tracking.
- 2026-10-21 14:37: Updated check_and_resolve_thread_entanglement to strip quoted replies before topic matching, enforce direct RFC reply immunity against topic-keyword re-anchoring, and expand stopwords with 25+ conversational verbs, prepositions, and generic qualifiers.
- 2026-10-21 14:38: Added strip_quoted_reply(ctx.body) in process_email_task Phase B so downstream agents and evaluators operate on clean customer text.
- 2026-10-21 14:38: Added 4 new unit tests in tests/test_conversational_drift.py (test_03b to test_03e) covering RFC reply protection, quote stripping, stopword filtering, and ThreadResolution compatibility. All 14 tests in suite passed in 0.47s.
- 2026-10-21 14:40: Executed full regression test runner via docker exec mail_ai_worker python3 -u tests/run_all.py: all 178/178 unit tests passed in 37.34s with 0 errors, 0 failures, 0 skipped.
- 2026-10-21 14:40: Restarted mail_ai_worker container to ensure Celery worker loaded new Python bytecode into live processes.


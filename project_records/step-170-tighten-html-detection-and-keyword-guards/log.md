# Log - Step 170: Tighten HTML Detection and Keyword Guards

- **2026-10-26T18:29:40+05:30**: Initialized step to harden edge-case guards: replace loose `<p` substring search with regex tag boundary in `ThreadDetailView.tsx`, and sanitize allowed phrase whitespace matching in `app/keyword_filter.py`.
- **2026-10-26T18:30:03+05:30**: Updated `app/keyword_filter.py`: added non-empty string guards in `get_blocked_keyword_exceptions()` and `is_blocked()` to prevent blank/whitespace phrases from unconditionally bypassing keyword filters.
- **2026-10-26T18:30:13+05:30**: Updated `frontend/src/components/inbox/ThreadDetailView.tsx`: replaced `bodyText.includes('<p')` with strict regex `/<p[\s>]/i.test(bodyText) || /<\/p>/i.test(bodyText)` to eliminate false-positive HTML detection on plain text messages.
- **2026-10-26T18:30:22+05:30**: Ran `tests/test_pipeline_filters.py` in docker `mail_ai_worker` — 13/13 tests passed.
- **2026-10-26T18:30:51+05:30**: Ran `npm run build` in `frontend/` — TypeScript compilation and Vite bundling passed cleanly (0 errors).
- **2026-10-26T18:33:18+05:30**: Added Redis test isolation cleanup to `TestBackAndForthScenarios`, `TestConversationalDrift`, and `tests/run_all.py` to prevent leftover Redis history keys from leaking into subsequent test runs.
- **2026-10-26T18:34:21+05:30**: Ran complete test runner `tests/run_all.py` in docker `mail_ai_worker` — 210/210 tests passed (0 failures, 0 errors, 1 skipped).


# Step 58: Technical Decisions - Documentation Overhaul and GitHub Synchronization

## 1. Documentation Scope Realignment
- **Choice**: Completely rewrite `README.md` to reflect the full platform architecture rather than leaving it as a narrow Dynamic Connectors sub-spec.
- **Rationale**: The previous `README.md` was authored for an isolated feature milestone (dynamic connectors) and still referenced dead files (`app/request_handler.py`, legacy payload endpoints). It failed to describe the core autonomous agent pipeline (`filters`, `enricher`, `agent`, `tools`, `evaluator`), RAG fallback architecture, or multi-provider LLM telemetry.

## 2. Client Guide Modernization
- **Choice**: Modernize `client_side.md` to explain the 4-stage pipeline, operational switches, live WebSocket inbox, and dynamic CRM connectors from an operator/tenant perspective.
- **Rationale**: Replaces obsolete references (e.g. "runs on one AI provider Groq behind the scenes", old hardcoded paths A/B/C) with active production capabilities while maintaining accessible language for non-technical clients.

## 3. GitHub Push
- **Choice**: Push commits cleanly to `origin/main` (`git@github.com:hyper-is-op/ai_mail_bot.git`).
- **Rationale**: Publishes all phased cleanup, test additions, bugfixes, and documentation updates to the upstream remote repository.

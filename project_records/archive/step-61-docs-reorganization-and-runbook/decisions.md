# Step 61: Technical Decisions - Documentation Hub Reorganization & Operational Runbook

## 1. Documentation Taxonomy & Directory Hub
- **Choice**: Created a standardized `docs/` hub, migrating `email_bot_flow.md` to `docs/ARCHITECTURE_FLOW.md` and `client_side.md` to `docs/OPERATOR_GUIDE.md`, while maintaining root `README.md` as the unified entry point.
- **Rationale**: Root-level proliferation of specialized markdown documents degrades repository discoverability. Centralizing technical specs and operator guides in `docs/` preserves a clean root directory while allowing each guide to target its specific audience.

## 2. Operations Runbook Authoring (`docs/RUNBOOK.md`)
- **Choice**: Authored a dedicated production triage and disaster recovery runbook covering the first 60 seconds of incident response, deep `/health` probe interpretation, component-level triage (Celery, Qdrant, PyTorch, MySQL, Redis), and backup/restore workflows.
- **Rationale**: Prior to this step, on-call operators had no single source of truth for diagnosing worker stalls, PyTorch CPU contention, or Qdrant collection corruption.

## 3. External API & Ingestion Reference (`docs/API_REFERENCE.md`)
- **Choice**: Documented external ingestion schemas (`POST /process-email`), dynamic connector approval/rejection workflows, and error response codes.
- **Rationale**: Provides external teams and CRM webhook developers with a standalone integration contract without requiring them to spin up the local development stack.

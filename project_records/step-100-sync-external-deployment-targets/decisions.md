# Technical Decisions - Step 100: Sync Frontend and Backend Deployment Targets

## 1. Backend Synchronization (`/Czentrix/apps/Smart_Mail_Agent_BE`)
- **Choice**: Synchronized application code via `rsync -av` with selective exclusions preserving `.git/`, local vector databases (`chroma_db/`, `qdrant_storage/`), and local configuration (`.env*`). Excluded development tests and agent records.
- **Rationale**: Propagates all recent backend updates (thread ID propagation, draft service queries, backfilled billed cost scripts, week start day filters, etc.) to the deployment repository. Committed as commit `3c81c85`.

## 2. Frontend Synchronization & Production Rebuild (`/home/hyper_is_op/Smart_Mail_Agent_FE`)
- **Choice**: Synchronized `frontend/` source into `/home/hyper_is_op/Smart_Mail_Agent_FE` excluding `node_modules`, `dist/`, and runtime `public/config.js`, followed by running `pnpm run build`.
- **Rationale**: Verified 0 difference between source and destination `src/` directories. Cleanly built production assets (`dist/assets/index-Co8xsKA7.js` [1.35MB] and `dist/assets/index-kJ5uIDLg.css` [73kB]), deploying the UI standardization primitives, time filters, and drawer/modal enhancements.

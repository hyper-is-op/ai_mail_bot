# Technical Decisions - Step 74: Sync External Deployment Targets

## 1. Backend Synchronization (`/Czentrix/apps/Smart_Mail_Agent_BE`)
- **Choice**: Synchronized application code via `rsync -av` with selective exclusions preserving `.git/`, local vector databases (`chroma_db/`, `qdrant_storage/`), and local configuration (`.env*`). Restored existing architectural diagrams (`Email_Bot_Architecture.pdf`).
- **Rationale**: Keeps the downstream C-Zentrix backend repository updated with recent improvements (alert service, token economics, resilience fixes, dynamic report architecture) while preventing disruption to local state or git tracking. Committed cleanly as `c058283`.

## 2. Frontend Synchronization & Production Rebuild (`/home/hyper_is_op/Smart_Mail_Agent_FE`)
- **Choice**: Synchronized `frontend/` source into `/home/hyper_is_op/Smart_Mail_Agent_FE` preserving runtime dynamic configuration `public/config.js`, followed by executing a fresh `pnpm run build`.
- **Rationale**: Compiles modern TypeScript bundles (`dist/assets/index-CiA_V5e6.js`, `dist/assets/index-C_ezkmCV.css`) containing all recent UI additions (Reports page, token economics analytics, live audit deep-linking) ready for production serving.

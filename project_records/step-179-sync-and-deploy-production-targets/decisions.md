# Step 179 Decisions: Production Targets Sync & Web Root Deployment

## 1. Backend Synchronization (`/Czentrix/apps/Smart_Mail_Agent_BE`)
- **Strategy**: Follow standard rsync exclusion protocol established in step 159 (`.git`, `.env*`, `chroma_db`, `qdrant_storage`, `knowledge_fallback`, `frontend`, `.agents`, `project_records`, `tests`, `scratch`, `backups`, `check_352.py`, `Email_Bot_Architecture.pdf`, `__pycache__`, `.venv`).
- **Rationale**: Keeps runtime vector data and git remotes safe while synchronizing core logic in `app/`, `worker/`, and `app/schema/` across steps 160-178.

## 2. Frontend Build and Web Server Deployment
- **Strategy**:
  1. Rsync `frontend/src` into `/home/hyper_is_op/Smart_Mail_Agent_FE/src` (and configuration files if updated).
  2. Run `pnpm run build` in `/home/hyper_is_op/Smart_Mail_Agent_FE` to verify clean compilation.
  3. Deploy built distribution bundle to `/var/www/html/Smart_Mail_Agent/`.
  4. Strictly preserve `/var/www/html/Smart_Mail_Agent/config.js` (`BASENAME: "/Smart_Mail_Agent"`).
  5. Purge obsolete asset hashes and commit updated web root assets.

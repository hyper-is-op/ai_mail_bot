# Step 159 Decisions: Production Targets Sync & Web Root Deployment

## 1. Backend Synchronization (`/Czentrix/apps/Smart_Mail_Agent_BE`)
- **Options Considered**:
  1. Full recursive copy or git pull.
     - *Flaw*: Fails because `Smart_Mail_Agent_BE` tracks different upstream remotes (internal GitLab and separate HTTPS GitHub). Full overwrite would destroy `.git/` or clobber local runtime vector stores.
  2. Selective `rsync -av` with production exclusions (`.git`, `.env*`, `chroma_db`, `qdrant_storage`, `knowledge_fallback`, `frontend`, `.agents`, `project_records`, `tests`, `scratch`, `__pycache__`).
     - *Decision*: Option 2. Preserves all host runtime state while updating core application logic (`app/`, `worker/`, `scripts/`, `diagnostic_tools/`).

## 2. Web Root Subpath Routing Preservation (`/var/www/html/Smart_Mail_Agent`)
- **Context**: Standard Vite builds assume root `/`. The production web server hosts the application at subpath `/Smart_Mail_Agent/`.
- **Decision**: Strictly preserve `/var/www/html/Smart_Mail_Agent/config.js` (`BASENAME: "/Smart_Mail_Agent"`) during deployment, ensuring React Router routes cleanly without 404s.

## 3. Stale Asset Purging
- **Decision**: Purged legacy chunks `index--8EETgOw.js` and `index-CceJZypa.css` upon deploying the new bundle (`index-CFYyXlbV.js`, `index-BDLfxmJY.css`) to avoid disk bloat and ensure clean client caching.

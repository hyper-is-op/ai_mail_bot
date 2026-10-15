# Technical Decisions - Step 49: Sync Backend Codebase to C-Zentrix Smart_Mail_Agent_BE

## Decision: Preservation of `.git` and Local Vector Stores in Target Directory

### Context
User requested clearing `/Czentrix/apps/Smart_Mail_Agent_BE` and copying all contents from `/home/hyper_is_op/mail_ai_automation` except `frontend`, `.agents`, `project_records`, `.Test_files`, `tests`, `Email_Bot_Architecture.pdf`, `README.md`.

### Analysis & Risks
1. A raw `rm -rf /Czentrix/apps/Smart_Mail_Agent_BE/*` followed by copying would have deleted `/Czentrix/apps/Smart_Mail_Agent_BE/.git/`, severing the tracking with C-Zentrix internal GitLab (`git@czscm.c-zentrix.com:c-zentrix/digital/bots/email_bot_be.git`) and GitHub remote.
2. Naively copying `.git` from the source repository would have overwritten the target repo identity with `hyper-is-op/ai_mail_bot`.
3. Target contains `chroma_db` (root-owned) and `qdrant_storage` with local vector stores.
4. Python bytecode (`__pycache__`, `*.pyc`) should not be copied across environments.

### Decision
Use `rsync -av` with explicit `--exclude` rules to synchronize application source files (`app/`, `worker/`, `migrations/`, `scripts/`, `docker-compose.yml`, `embed_service.py`, `requirements*.txt`, `.env*`, etc.) into `/Czentrix/apps/Smart_Mail_Agent_BE/` while:
- Preserving target `.git/` history and remotes.
- Preserving existing database stores (`chroma_db/`, `qdrant_storage/`).
- Excluding all requested non-backend directories and files (`frontend/`, `.agents/`, `project_records/`, `.Test_files/`, `tests/`, `Email_Bot_Architecture.pdf`, `README.md`).
- Excluding stale bytecode (`__pycache__/`, `*.pyc`).
- Removing legacy untracked `.agents/` and `project_records/` in the target directory to ensure strict cleanliness.

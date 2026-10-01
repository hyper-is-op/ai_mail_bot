# Step 57: Decisions - Redis Thread Key Fix, Git Commit, and Deployment Sync

## 1. Thread Key Prefix Normalization
- **Choice**: Normalize `thread_id` in `app/chat_history.py:_make_key` to prevent duplicate `th_` prefixes (`thread_id if thread_id.startswith('th_') else f"th_{thread_id}"`).
- **Rationale**: Pipeline components provide `thread_id` with a `th_` prefix (e.g. `th_02bad6fc6d7a`). The previous hardcoded `f"th_{thread_id}"` generated redundant `th_th_` keys in Redis.

## 2. Git Atomic Baseline Commit
- **Choice**: Stage all cleanup and refactor changes and commit them cleanly to git.
- **Rationale**: Persists the clean state across Phases 1, 2, and 3, preserving the passing 83-test baseline.

## 3. External Deployment Sync
- **Choice**: Synchronize the backend code to `/Czentrix/apps/Smart_Mail_Agent_BE/` (preserving its `.git/` and local vector stores) and the frontend to `/home/hyper_is_op/Smart_Mail_Agent_FE/` (using `rsync -av --delete`).
- **Rationale**: Propagates the dead code removal, dependency trimming, and storage cleanup to active target deployment workspaces.

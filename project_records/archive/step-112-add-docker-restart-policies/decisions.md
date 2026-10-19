# Decisions: Step 112 - Docker Container Restart Policies

### Problem
When the host system upgrades `docker-ce` or the Docker daemon restarts, containers without an explicit restart policy exit with SIGTERM and do not restart automatically. This caused `mail_ai_api`, `mail_ai_redis`, and `mail_ai_worker` to stay down while `qdrant`, `embed_service`, and `listener` recovered.

### Decision
Add `restart: unless-stopped` to:
- `api`
- `worker`
- `redis`

### Rationale
- `unless-stopped` matches the existing policy for `qdrant` and `embed_service`.
- Allows intentional manual shutdowns (`docker compose stop` or `down`) to persist across daemon reboots without unwanted automatic restarts.
- Resumes containers upon daemon restarts or host reboot if they were running prior to the event.

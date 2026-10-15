# Log: Step 112 - Add Docker Restart Policies

- **2026-10-15T11:54:22+05:30**: Inspected root cause of container downtime after system package upgrades (`docker-ce` upgrade restarted daemon, terminating containers lacking restart policies).
- **2026-10-15T11:54:30+05:30**: Updated `docker-compose.yml` to set `restart: unless-stopped` on `api`, `worker`, and `redis`.
- **2026-10-15T11:55:15+05:30**: Ran `docker compose up -d` to reload daemon container configurations.
- **2026-10-15T11:55:24+05:30**: Verified with `docker inspect` that all 6 services (`mail_ai_api`, `mail_ai_worker`, `mail_ai_redis`, `mail_ai_listener`, `mail_ai_qdrant`, `mail_ai_embed_service`) have active restart policies (`unless-stopped` / `always`).
- **2026-10-15T11:55:30+05:30**: Verified API response `200 OK` on port 8024.

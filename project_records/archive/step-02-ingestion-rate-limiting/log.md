# Step 02: Ingestion Rate Limiting Hardening
- **Timestamp:** 2026-09-15 10:55 IST
- **Action:** Increased default sender rate limit and made it configurable via environment variables in `app/pipeline/filters.py`.
- **Details:** Increased the default hourly limit from 10 to 30 emails/hour to prevent false rate limiting during rapid troubleshooting testing. Exposed `SENDER_HOURLY_RATE_LIMIT` environment variable.

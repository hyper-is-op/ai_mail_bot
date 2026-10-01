# Decisions for Step 02

### Approach: Environment Variable Configuration
- **Context:** Sender rate limit was hardcoded to 10 emails/hour, blocking interactive customer sessions.
- **Options Considered:**
  1. Dynamically calculate limits per client in MySQL.
  2. Set a higher default threshold and read overrides from `os.getenv("SENDER_HOURLY_RATE_LIMIT", "30")`.
- **Reasoning:** Option 2 allows zero-code operational tuning in production via docker-compose/.env without altering DB schema or query overhead.

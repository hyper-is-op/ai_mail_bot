import os
import logging
import redis
from fastapi import Request, HTTPException, status

logger = logging.getLogger(__name__)

class RedisRateLimiter:
    """
    Production-grade Redis-backed request rate limiter for FastAPI.
    Tracks requests per client IP and endpoint path.
    Defends against DoS, brute-forcing, and high LLM API cost surges.
    """
    def __init__(self, limit: int = 60, window: int = 60):
        """
        Args:
            limit: Maximum requests allowed in the time window.
            window: Time window in seconds.
        """
        self.limit = limit
        self.window = window
        self.redis_client = None
        self._init_redis()

    def _init_redis(self):
        try:
            from app.redis_pool import get_redis_main
            self.redis_client = get_redis_main()
            self.redis_client.ping()
            logger.info("🔌 Rate Limiter successfully connected to pooled Redis")
        except Exception as e:
            logger.warning(f"⚠️ Redis connection for Rate Limiter failed: {e}. Rate limiter is in fallback mode (passthrough).")
            self.redis_client = None

    async def __call__(self, request: Request):
        if not self.redis_client:
            # Safe Fallback: if Redis is offline, do not block the app. Log a warning and allow.
            logger.debug("Rate Limiter running in passthrough mode (Redis offline).")
            return

        # Define unique request key by client IP and endpoint path
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        key = f"rate_limit:{client_ip}:{path}"

        try:
            # Use Redis transactional pipeline for an atomic increment and expire command
            current = self.redis_client.get(key)
            if current is not None and int(current) >= self.limit:
                ttl = self.redis_client.ttl(key)
                logger.warning(f"🚨 Rate limit exceeded for IP={client_ip} on path={path}. TTL={ttl}s")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "error": "Too Many Requests",
                        "message": f"Rate limit exceeded. Maximum {self.limit} requests per {self.window}s window.",
                        "retry_after_seconds": ttl if ttl > 0 else self.window
                    }
                )

            pipeline = self.redis_client.pipeline()
            pipeline.incr(key)
            if current is None:
                pipeline.expire(key, self.window)
            pipeline.execute()

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Redis Rate Limiter execution error: {e}. Passing request to avoid blocking.")


def ensure_rate_limit_exemptions_table(cursor=None):
    sql = """
        CREATE TABLE IF NOT EXISTS rate_limit_exemptions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            client_id VARCHAR(50) NOT NULL,
            sender_or_domain VARCHAR(255) NOT NULL,
            reason VARCHAR(255) DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_client_exempt (client_id, sender_or_domain),
            INDEX idx_exempt_client (client_id)
        )
    """
    if cursor is not None:
        cursor.execute(sql)
    else:
        try:
            from app.db import get_db_ctx
            with get_db_ctx() as db:
                with db.cursor() as cur:
                    cur.execute(sql)
                db.commit()
        except Exception as e:
            logger.warning(f"⚠️ Failed to ensure rate_limit_exemptions table: {e}")


def is_sender_exempt_from_rate_limit(client_id: str, from_email: str, cursor=None) -> bool:
    """
    Checks if this sender or their domain is exempt from rate limits for this tenant.
    Uses a 300s Redis set cache per client_id to avoid DB load on high email volumes.
    """
    if not client_id or not from_email:
        return False
    sender_clean = from_email.lower().strip()
    domain = sender_clean.split("@")[-1] if "@" in sender_clean else ""

    # 1. Try Redis cache first
    try:
        from app.redis_pool import get_redis_main
        r = get_redis_main()
        cache_key = f"ratelimit:exemptions:{client_id}"
        if r.exists(cache_key):
            exempt_members = r.smembers(cache_key)
            exempt_set = {m.decode() if isinstance(m, bytes) else str(m) for m in exempt_members}
            return sender_clean in exempt_set or f"@{domain}" in exempt_set or domain in exempt_set
    except Exception:
        pass

    # 2. Query MySQL
    try:
        def _fetch(cur):
            cur.execute(
                "SELECT sender_or_domain FROM rate_limit_exemptions WHERE client_id = %s",
                (client_id,)
            )
            return {row[0].lower().strip() for row in cur.fetchall()}

        if cursor is not None:
            exempt_set = _fetch(cursor)
        else:
            from app.db import get_db_ctx
            with get_db_ctx() as db:
                with db.cursor() as cur:
                    exempt_set = _fetch(cur)

        # Cache in Redis (300s TTL)
        try:
            from app.redis_pool import get_redis_main
            r = get_redis_main()
            cache_key = f"ratelimit:exemptions:{client_id}"
            if exempt_set:
                r.sadd(cache_key, *exempt_set)
            else:
                r.sadd(cache_key, "__NONE__")
            r.expire(cache_key, 300)
        except Exception:
            pass

        return sender_clean in exempt_set or f"@{domain}" in exempt_set or domain in exempt_set
    except Exception as e:
        logger.warning(f"⚠️ Rate limit exemption check failed: {e}")
        return False


def check_sender_rate_limit(
    client_id: str,
    from_email: str,
    limit: int = 10,
    window_seconds: int = 3600,
    cursor=None
) -> tuple[bool, int]:
    """
    Checks if an inbound sender has exceeded their hourly email processing limit.
    Returns (is_allowed: bool, current_count: int).
    Exempt senders or domains are never throttled.
    """
    if not from_email or not client_id:
        return True, 0

    if is_sender_exempt_from_rate_limit(client_id, from_email, cursor=cursor):
        logger.info(f"🛡️ [Client {client_id}] Sender {from_email} is exempt from rate limits")
        return True, 0

    sender_clean = from_email.lower().strip()
    key = f"ratelimit:sender:{client_id}:{sender_clean}"

    try:
        from app.redis_pool import get_redis_main
        r = get_redis_main()

        current = r.get(key)
        if current is not None and int(current) >= limit:
            return False, int(current)

        pipe = r.pipeline()
        pipe.incr(key)
        if current is None:
            pipe.expire(key, window_seconds)
        results = pipe.execute()
        new_count = results[0] if results else 1
        return True, new_count
    except Exception as e:
        logger.warning(f"⚠️ Redis rate limiter error for sender {from_email}: {e}. Allowing passthrough.")
        return True, 0


def get_redis_client():
    """Backward-compatible helper to retrieve main Redis client."""
    try:
        from app.redis_pool import get_redis_main
        return get_redis_main()
    except Exception:
        return None


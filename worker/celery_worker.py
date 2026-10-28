import os
import time
import logging
from celery import Celery
from celery.signals import worker_init, worker_process_init
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Get Redis URL from environment
redis_url = os.getenv("REDIS_URL", "redis://mail_ai_redis:6379/0")

# Initialize Celery
celery = Celery(
    "mail_ai_worker",
    broker=redis_url,
    backend=redis_url,
    include=["worker.tasks"]
)

# Optional configuration
celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    # Deliberately kept at 1 — embedding itself is now offloaded to
    # embed_service, so this isn't about avoiding duplicate model loads
    # (there's nothing to load here anymore); it's to keep per-process
    # memory low on a 6GB host at current traffic levels. Revisit if
    # traffic grows — see docker-compose.yml `worker` mem_limit for the
    # Concurrency scaled to 2: doubles throughput while keeping host footprint ~450MB
    worker_concurrency=2,
    beat_schedule={
        "sweep-stale-outbox-every-2-min": {
            "task": "worker.tasks.sweep_stale_outbox_task",
            "schedule": 120.0,
        },
    },
)


@worker_init.connect
def init_worker_database(**kwargs):
    """
    Guarantees all 25 MySQL tables exist and are properly migrated
    before Celery worker begins consuming tasks from Redis.
    """
    try:
        from app.db_init import run_sync_database_init
        run_sync_database_init()
    except Exception as e:
        logger.error(f"❌ Worker database pre-flight failed: {e}")


@worker_init.connect
def wait_for_embed_service_ready(**kwargs):
    """
    Blocks Celery parent process startup until embed_service finishes loading
    its PyTorch model (~40s cold load), or until timeout (60s).
    Guarantees no emails are consumed from Redis in degraded RAG mode.
    """
    try:
        from app.embed_client import embed_service_healthy
    except Exception as e:
        logger.warning(f"⚠️ Could not import embed_service_healthy: {e}")
        return

    max_wait_seconds = 60
    poll_interval = 2
    elapsed = 0

    # Quick check first to avoid wait/logs if already healthy
    if embed_service_healthy():
        logger.info("✅ [Startup Gate] embed_service is already healthy — proceeding with worker startup")
        return

    logger.info("⏳ [Startup Gate] Waiting for embed_service to be ready (PyTorch model loading)...")

    while elapsed < max_wait_seconds:
        time.sleep(poll_interval)
        elapsed += poll_interval
        if embed_service_healthy():
            logger.info(f"✅ [Startup Gate] embed_service is ready (waited {elapsed}s). Launching Celery workers.")
            return

    logger.warning(
        f"⚠️ [Startup Gate] embed_service NOT ready after {max_wait_seconds}s — starting Celery in degraded RAG mode"
    )


@worker_process_init.connect
def warm_embed_service_connection(**kwargs):
    """
    Fires once per child worker process on fork. Since the parent process
    already gated startup via wait_for_embed_service_ready, this is an instant
    confirmation.
    """
    try:
        from app.embed_client import embed_service_healthy
        if embed_service_healthy():
            logger.info("✅ embed_service reachable at worker process initialization")
        else:
            logger.warning("⚠️ embed_service NOT reachable at worker startup — RAG will degrade to fallback/tickets until it recovers")
    except Exception as e:
        logger.warning(f"⚠️ embed_service startup health check failed: {e}")


if __name__ == "__main__":
    celery.start()

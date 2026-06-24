import os
from celery import Celery
from dotenv import load_dotenv

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
)

if __name__ == "__main__":
    celery.start()

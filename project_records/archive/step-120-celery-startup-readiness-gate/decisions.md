# Decision: Celery Parent Process Readiness Gate

## Context
During container restarts or host reboot under `restart: unless-stopped`, the Docker daemon launches containers in parallel, bypassing Compose `depends_on: { embed_service: { condition: service_healthy } }`. Celery worker initializes in ~1s, while `embed_service` requires ~40s to load `intfloat/multilingual-e5-small` weights into memory and run warmup inference. During this ~40s window, Celery worker previously began consuming tasks from Redis, causing any arriving customer email to degrade to keyword/JSON RAG fallback.

## Options Considered
1. **Entrypoint wrapper script (`wait-for-it.sh` or inline python)**:
   - *Pros*: Completely stops Celery process from booting until HTTP healthcheck passes.
   - *Cons*: Coupled to Docker container entrypoints; breaks or behaves inconsistently during direct local testing, CLI execution, or pytest harness.
2. **Retry inside `worker_process_init`**:
   - *Pros*: Stays in Python.
   - *Cons*: Runs inside every child pool process (`ForkPoolWorker-*`), causing duplicate polling loops; the parent Celery process still declares `celery ready` and connects the task consumer to Redis before child workers finish waiting.
3. **`worker_init` Celery Parent Signal (Chosen)**:
   - *Pros*: Dispatched synchronously in the Celery main process *before* pool processes fork and *before* the consumer connects to the Redis task queue. Single polling loop. Zero startup overhead if service is already healthy. Includes 60s timeout fail-safe to avoid permanent hanging if embed_service experiences catastrophic failure.
   - *Cons*: Adds a blocking loop to parent process on cold boot (which is the desired behavior).

## Decision
Use Celery's `worker_init` signal in `worker/celery_worker.py` to block queue consumption until `embed_service` is verified healthy or until 60s timeout.

# Step 178: Decisions

## Decision 1: Pure PyMySQL Schema Registry vs ORM Migration Tool
- **Context**: Codebase uses raw PyMySQL with DBUtils.PooledDB across all query operations. Alembic and SQLAlchemy are absent from requirements.
- **Options Considered**:
  1. *Introduce SQLAlchemy + Alembic*: Would require adding dependencies and writing duplicate ORM models that query routes wouldn't use.
  2. *Centralize pure raw SQL in `app/schema/tables.py`*: Single source of truth with zero new dependencies, completely compatible with existing `get_db_ctx()` and `cursor.execute()`.
- **Choice**: Option 2. Centralize the 25 active table definitions in `app/schema/tables.py`.

## Decision 2: Synchronous DB Pre-Flight vs FastAPI-Only Initialization
- **Context**: Celery workers and IMAP listeners run as independent processes from FastAPI. If they start before `api`, queries on uninitialized tables fail.
- **Options Considered**:
  1. *Keep inline `_ensure_table()` in query paths*: Causes exclusive metadata locks (MDL) on MySQL per request.
  2. *Unify synchronous pre-flight initialization*: Run `run_sync_database_init()` during startup in `api` (lifespan), `worker` (`@worker_init`), and `listener` (process start), allowing complete removal of inline DDL.
- **Choice**: Option 2. Provide a unified `run_sync_database_init()` and wire it into all three service entrypoints.

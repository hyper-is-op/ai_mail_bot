# Step 146 Decisions: Hardened Dynamic Tenant Purge Architecture

## Context
When client account `CLI-4159FFCF` was deleted, `delete_client_account` in `app/auth.py` omitted multiple database tables (including `connector_configs`, `action_logs`, `email_logs`, `client_prompt_configs`, etc.), leaving orphaned ghost records for over 90 client IDs. Additionally, in-flight background tasks, missing database indexes, and static test dependencies presented race conditions and database lock risks during account deletion.

## Decision 1: Two-Stage Tenant Suspension Before Purge
- **Options Considered:**
  1. *Immediate Blind DELETE*: Run DELETE queries directly when API endpoint is called.
     - *Flaw*: In-flight Celery tasks or IMAP listener threads will either crash mid-stream or write final records after deletion commits, resurrecting ghost logs.
  2. *Two-Stage Decommission*:
     - Stage 1: Mark account `status = 'deleting'` in `users`, clear Redis session/reset keys, and drop chat history.
     - Stage 2: Execute physical purge of operational data.
- **Chosen:** Option 2. Guarantees workers reject/drop incoming processing for the deleted client before physical deletion begins.

## Decision 2: Dynamic Schema Discovery with Whitelisted Operational Cascade
- **Options Considered:**
  1. *Expanded Static Query List*: Add `connector_configs`, `client_prompt_configs`, etc. to hardcoded SQL in `app/auth.py`.
     - *Flaw*: Fragile. Will break again the moment a developer adds another table with a `client_id` column.
  2. *Dynamic Information Schema Introspection with Safety Filtering*:
     - Query `information_schema.columns` for `column_name = 'client_id'` in active database.
     - Protect shared/global resources (`client_email_disclaimers` where `client_id = 'GLOBAL'`).
     - Execute deletion across all discovered tables in a single transaction with parent `users` record deleted last.
- **Chosen:** Option 2. Eliminates future schema drift and guarantees that any newly created table with `client_id` is automatically purged.

## Decision 3: Index Enforcement on `celery_task_log`
- Adding an index on `celery_task_log(client_id)` ensures `DELETE FROM celery_task_log WHERE client_id = %s` executes as an indexed point lookup/range deletion rather than a full table scan that escalates InnoDB table locks.

## Decision 4: Self-Contained Test Fixtures
- Tests must not rely on the persistence of historical production tenant data (e.g., historical email ID 371 or pre-existing fallback files). Added self-contained knowledge seeding in test `setUpClass` and dynamic row lookups in diagnostic tests.

# Step 177: Decisions

## Decision: Permanent Drop of Legacy Tables
- **Context**: The database contained 2 residual tables (`create_payload_table` and `payload_get_table`) from legacy custom connector storage that was replaced in Step 56 by `connector_configs`.
- **Options Considered**:
  1. *Leave tables in place*: Retains clutter in `SHOW TABLES` and database backups, potentially misleading new developers.
  2. *Permanently DROP tables*: Eliminates orphaned schema artifacts since code references were pruned and both tables contained zero rows.
- **Choice**: Permanently DROP `create_payload_table` and `payload_get_table` with user confirmation per data loss prevention procedures.

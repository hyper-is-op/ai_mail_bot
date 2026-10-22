# Step 143 Decisions: Connector Configuration Restoration Architecture

## Context
The user requested extracting connector configurations from an old account (`CLI-4159FFCF`) and packaging them into an executable file capable of restoring those configurations to any target client ID (specifically `CLI-4B46C071`).

## Decision 1: Self-Contained Config Snapshot with Runtime Cryptographic Re-Keying
- **Options Considered:**
  1. *Database-to-Database Clone Tool*: Query `connector_configs` WHERE `client_id = source` directly at runtime.
     - *Flaw*: If the source client rows are ever purged or cleaned up from MySQL later, the script becomes completely non-functional.
  2. *Raw SQL Dump / Row Insert Script*: Dump raw row values including ciphertext and execute `INSERT`.
     - *Flaw*: Catastrophic failure. `connector_configs.auth_secret_encrypted` uses HKDF tenant derivation keyed on `client_id`. Copying ciphertext causes `InvalidToken` at runtime when `decrypt_secret` is called with the target client ID.
  3. *Self-Contained Executable Bundle with Master-Key / Tenant Re-Keying*: Embed the exported configuration payloads directly in the script (or companion JSON), with secrets encrypted under master key or re-encrypted on-the-fly using `CONNECTOR_SECRET_ENCRYPTION_KEY` and the target client ID's HKDF salt.
- **Chosen:** Option 3. The script embeds the exported schema/payload definitions and contains dual-mode capability: it can restore from embedded config snapshot OR migrate live from DB if source records exist, while enforcing target tenant HKDF re-encryption.

## Decision 2: Idempotent Conflict Resolution & Target Account Validation
- Target client existence must be validated against `users` table to prevent orphaned connector records.
- Due to strict MySQL UNIQUE constraints on `(client_id, live_marker)` and `(client_id, pending_marker)`, the script provides an `--overwrite` flag: when set (or default prompt confirmed), existing connector triggers for the target client are safely deactivated or updated in-place rather than causing duplicate key collision errors.

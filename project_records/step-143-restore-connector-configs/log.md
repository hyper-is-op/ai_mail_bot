# Step 143: Restore Connector Configs with Cryptographic Re-encryption

- 2026-10-19T18:52:30+05:30: Initialized Step 143 to create a standalone connector configuration export and restore utility for migrating connector configurations across tenant accounts.
- 2026-10-19T18:52:43+05:30: Queried MySQL database `connector_configs` table and confirmed that tenant account `CLI-4159FFCF` deletion in `app/auth.py` did not purge connector records. Retrieved 2 live configs (ID 3 `ticket_create`, ID 10 `ticket_status`) for Zoho Desk.
- 2026-10-19T18:52:50+05:30: Decrypted the authentication secrets under `CLI-4159FFCF` and confirmed tenant-isolated HKDF encryption: verified that direct ciphertext duplication to `CLI-4B46C071` throws `InvalidToken`, proving that re-encryption under the target client's HKDF salt is mandatory.
- 2026-10-19T18:53:18+05:30: Created `scripts/restore_connector_configs.py` embedding complete configuration templates (headers, request templates, response mappings, and OAuth2 credentials), supporting `--target` (default `CLI-4B46C071`), `--dry-run`, `--no-overwrite`, and auto-re-encryption with target tenant HKDF keys.
- 2026-10-19T18:53:24+05:30: Created root symlink `restore_connector_configs.py` and set executable permissions.
- 2026-10-19T18:53:41+05:30: Fixed `PROJECT_ROOT` discovery to resolve symlinks and work identically when invoked from repo root or subdirectories.
- 2026-10-19T18:53:47+05:30: Validated CLI dry-run execution against target `CLI-4B46C071` and verified user validation rejection for nonexistent client IDs.
- 2026-10-19T18:54:02+05:30: Executed live restoration for `CLI-4B46C071`: created connector IDs 11 (`ticket_create`) and 12 (`ticket_status`) in `live` status with re-encrypted secrets.
- 2026-10-19T18:54:07+05:30: Validated idempotent re-execution: verified in-place update without constraint collision.
- 2026-10-19T18:54:51+05:30: Executed verification inside live production container (`mail_ai_worker`): `get_live_config` resolved both `ticket_create` and `ticket_status` for `CLI-4B46C071`, and `decrypt_secret` successfully decrypted both tokens.


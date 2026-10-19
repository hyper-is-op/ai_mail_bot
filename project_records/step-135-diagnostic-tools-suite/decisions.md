# Step 135: Decisions - Diagnostic Tools Suite

## 1. Dual-Mode Execution Architecture (Host vs Container)
- **Decision**: Design diagnostic CLI tools to be dual-mode: they run natively if dependencies (pymysql, redis, etc.) and environment variables exist in the execution environment, or automatically self-delegate via `docker exec -i mail_ai_worker` if executed directly on the host machine where external dependencies are absent.
- **Context**: The host machine python environment does not have `pymysql` or other project dependencies installed, whereas `mail_ai_worker` and `mail_ai_api` containers have full environments. Requiring the user to remember complex `docker exec` flags or install pip packages on the host creates friction and fragility.
- **Alternatives Considered**:
  - Require host pip installation: Breaks encapsulation and violates `managing-python-dependencies` isolation standards.
  - Require manual `docker exec` commands: Error-prone and inconvenient for rapid CLI usage.

## 2. Universal Identifier Resolution
- **Decision**: Build fuzzy/polymorphic identifier resolution supporting:
  1. Integer Email Log ID (e.g. `371`, `#371`)
  2. Thread ID with or without `th_` prefix (e.g. `th_e3897a2164b8`, `e3897a2164b8`)
  3. RFC Message-ID (e.g. `<CAOSZpAbP0iyxRMDSrj5Er...mail.gmail.com>`)
  4. Composite queries (specifying both `--thread-id` and `--email-id` or `--search`)

## 3. Deterministic SHA256 Idempotency Action Outbox Correlation
- **Decision**: In `inspect_thread.py`, calculate deterministic SHA256 idempotency keys (`sha256(f"{client_id}:{message_id}:{action_type}".encode())`) for known action types (`smtp_send_reply`, `send_email`, `crm_ticket_create`, `create_ticket`) rather than using loose SQL substring searches (`LIKE '%<id>%'`).
- **Context**: Idempotency keys in `action_logs` are 64-char hex strings. Fuzzy substring searches matched unrelated keys that incidentally contained substrings like '371'. Computing the exact SHA256 hashes achieves 100% precision.

## 4. Explicit Venv Bootstrap in CLI Entrypoints
- **Decision**: Expose `ensure_venv()` in `diag_common.py` and call it explicitly inside `main()` of CLI tools rather than executing `os.execv` at module import time.
- **Context**: Calling `os.execv` during module-level imports broke test runners (such as `unittest discover tests`), which import test modules dynamically in-process. Making the bootstrap explicit keeps modules safely importable across unit test suites.


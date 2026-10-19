# Step 136 Decisions: Diagnostic Tools Hardening

## Decision 1: Pre-Import Inline Virtualenv Bootstrap Guard vs Wrapper Script
- **Context**: When diagnostic CLI tools are run directly on the host using system Python (e.g. `/usr/bin/python3`), third-party packages (`requests`, `pymysql`, `dbutils`) may not be installed in system Python, but are present in `/home/hyper_is_op/.venv/bin/python`. If `ensure_venv()` is only called in `main()`, importing `requests` or `app.db` at top of file triggers an unhandled `ModuleNotFoundError` before `main()` can execute.
- **Alternatives Considered**:
  1. Bash wrapper scripts (`./diag_thread.sh`): Adds extra files and indirection for operators.
  2. Pre-import inline bootstrap check in each CLI entrypoint: Inspects `sys.executable` and `os.execv`'s to `.venv` immediately if dependencies are missing, before importing heavy project packages.
- **Chosen**: Option 2. Preserves standard `python3 diagnostic_tools/<tool>.py` invocation ergonomics with zero wrapper scripts.

## Decision 2: Visible-Width ANSI Formatting
- **Context**: Standard Python format specifiers like `{val:<25}` count invisible terminal escape sequences (e.g. `\033[92m`) toward string length, leading to severe table column misalignments in ANSI terminals.
- **Chosen**: Created regex-based `strip_ansi()` and `ljust_ansi()` helpers in `diag_common.py` that calculate visible glyph counts and pad accordingly.

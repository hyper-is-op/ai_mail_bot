# Step 182: Technical Decisions - Reconciling Centralized Table Schemas

## Context
During fresh database initialization on a remote deployment, `GET /admin/global-default-llm` failed with `(1054, "Unknown column 'provider' in 'field list'")`. Investigation revealed that `app/schema/tables.py` (introduced in step-178 as the centralized single source of truth) contained stale/draft schemas for 4 tables (`global_default_llm`, `globally_available_llm_configs`, `paused_emails`, `llm_logs`) and omitted `thread_id` from `draft_emails`.

## Decisions

### 1. Reconcile `app/schema/tables.py` directly with active SQL query surfaces
- **global_default_llm**: Align columns to `id INT PRIMARY KEY DEFAULT 1, provider VARCHAR(50) NOT NULL DEFAULT 'groq', api_key TEXT NOT NULL, base_url VARCHAR(255) NULL, model_name VARCHAR(255) NOT NULL DEFAULT '', api_version VARCHAR(50) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, refreshed TIMESTAMP NULL, is_override_active TINYINT(1) NOT NULL DEFAULT 0`.
- **globally_available_llm_configs**: Align columns to `id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, provider VARCHAR(50) NOT NULL, api_key TEXT NOT NULL, base_url VARCHAR(255) NULL, model_name VARCHAR(255) NOT NULL DEFAULT '', api_version VARCHAR(50) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, refreshed TIMESTAMP NULL`.
- **paused_emails**: Align columns to `id INT AUTO_INCREMENT PRIMARY KEY, client_id VARCHAR(50) NOT NULL, paused_email VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_client_paused_email (client_id, paused_email)`.
- **llm_logs**: Align columns to `id BIGINT AUTO_INCREMENT PRIMARY KEY, client_id VARCHAR(50) NOT NULL, email_log_id INT DEFAULT NULL, thread_id VARCHAR(100) DEFAULT NULL, caller_function VARCHAR(100) NOT NULL, model_name VARCHAR(100) NOT NULL, provider VARCHAR(50) NOT NULL DEFAULT 'groq', prompt_tokens INT NOT NULL DEFAULT 0, completion_tokens INT NOT NULL DEFAULT 0, cost DECIMAL(10, 6) NOT NULL DEFAULT 0.000000, billed_cost DECIMAL(10, 6) DEFAULT NULL, latency_ms INT NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP` with relevant performance indices.
- **draft_emails**: Include `thread_id VARCHAR(255) DEFAULT NULL AFTER message_id` and `INDEX idx_thread_id (thread_id)` in the initial DDL.

### 2. Add defensive column migration in `app/db_init.py`
- Rather than relying solely on `CREATE TABLE IF NOT EXISTS`, `ensure_global_llm_tables()`, `ensure_paused_emails_table()`, and `ensure_llm_logs_table()` will inspect `information_schema.COLUMNS` and dynamically run `ALTER TABLE ADD COLUMN` for any missing columns on existing databases.
- This guarantees self-healing across both fresh installations and legacy upgrades.

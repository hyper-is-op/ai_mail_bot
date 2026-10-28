"""
app/schema/tables.py

Centralized MySQL Table Definitions (25 active tables).
Single Source of Truth for schema initialization and validation across API, Worker, and Listener.
"""

TABLE_DEFINITIONS: dict[str, str] = {
    # =========================================================================
    # 1. Authentication, Tenants & System Settings
    # =========================================================================
    "users": """
        CREATE TABLE IF NOT EXISTS users (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            client_id     VARCHAR(50) UNIQUE NOT NULL,
            email         VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role          ENUM('admin', 'client') DEFAULT 'client',
            status        ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
            name          VARCHAR(255) DEFAULT NULL,
            phone_number  VARCHAR(50) DEFAULT NULL,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,

    "url_allowlist": """
        CREATE TABLE IF NOT EXISTS url_allowlist (
            id         BIGINT AUTO_INCREMENT PRIMARY KEY,
            scheme     VARCHAR(20)  NOT NULL,
            netloc     VARCHAR(255) NOT NULL,
            path       VARCHAR(255) NOT NULL DEFAULT '',
            added_by   VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE INDEX uq_scheme_netloc_path (scheme, netloc, path(191))
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,

    "email_accounts": """
        CREATE TABLE IF NOT EXISTS email_accounts (
            id                       INT AUTO_INCREMENT PRIMARY KEY,
            client_id                VARCHAR(50) NOT NULL,
            email                    VARCHAR(255) NOT NULL,
            password                 VARCHAR(255) NOT NULL,
            score_threshold          INT DEFAULT 80,
            response_tone            VARCHAR(50) DEFAULT 'Formal',
            agent_type               VARCHAR(50) DEFAULT 'customer_support_agent',
            department_name          VARCHAR(100) DEFAULT NULL,
            company_name             VARCHAR(100) DEFAULT NULL,
            connector_cap            INT DEFAULT 5,
            feature_ticket_creation  BOOLEAN DEFAULT TRUE,
            feature_auto_send        BOOLEAN DEFAULT TRUE,
            feature_rag              BOOLEAN DEFAULT TRUE,
            feature_order_tracking   BOOLEAN DEFAULT TRUE,
            feature_manual_reply     BOOLEAN DEFAULT TRUE,
            feature_strip_disclaimers BOOLEAN DEFAULT TRUE,
            admin_bot_enabled        BOOLEAN DEFAULT TRUE,
            client_bot_enabled       BOOLEAN DEFAULT TRUE,
            cost_multiplier          FLOAT DEFAULT 1.0,
            monthly_budget_usd       FLOAT DEFAULT NULL,
            auth_type                VARCHAR(20) DEFAULT 'password',
            refresh_token            TEXT DEFAULT NULL,
            oauth_provider           VARCHAR(30) DEFAULT NULL,
            oauth_client_id          VARCHAR(255) DEFAULT NULL,
            oauth_client_secret      TEXT DEFAULT NULL,
            inactivity_timeout_hours INT DEFAULT 72,
            webhook_url              VARCHAR(500) DEFAULT NULL,
            alert_email              VARCHAR(255) DEFAULT NULL,
            alert_on_sla_breach      BOOLEAN DEFAULT TRUE,
            alert_on_worker_stall    BOOLEAN DEFAULT TRUE,
            alert_sla_hours          INT DEFAULT 4,
            week_start_day           VARCHAR(10) DEFAULT 'monday',
            created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_client_id (client_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,

    "client_email_disclaimers": """
        CREATE TABLE IF NOT EXISTS client_email_disclaimers (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            client_id       VARCHAR(50) NOT NULL,
            disclaimer_text TEXT NOT NULL,
            is_active       BOOLEAN DEFAULT TRUE,
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_client (client_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    """,

    # =========================================================================
    # 2. LLM Configs, Prompts & Model Defaults
    # =========================================================================
    "global_default_llm": """
        CREATE TABLE IF NOT EXISTS global_default_llm (
            id                INT AUTO_INCREMENT PRIMARY KEY,
            default_llm_model VARCHAR(100) NOT NULL,
            updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,

    "globally_available_llm_configs": """
        CREATE TABLE IF NOT EXISTS globally_available_llm_configs (
            id             INT AUTO_INCREMENT PRIMARY KEY,
            model_name     VARCHAR(100) NOT NULL,
            provider       VARCHAR(100) NOT NULL,
            pricing_json   JSON NOT NULL,
            created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_model_provider (model_name, provider)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,

    "client_llm_config": """
        CREATE TABLE IF NOT EXISTS client_llm_config (
            id                INT AUTO_INCREMENT PRIMARY KEY,
            client_id         VARCHAR(100) NOT NULL,
            caller_function   VARCHAR(100) NOT NULL,
            global_config_id  INT NULL,
            provider          VARCHAR(50) NULL,
            api_key           TEXT NULL,
            base_url          VARCHAR(255) NULL,
            model_name        VARCHAR(255) NOT NULL DEFAULT '',
            api_version       VARCHAR(50) NULL,
            created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            refreshed         TIMESTAMP NULL,
            UNIQUE KEY uk_client_caller (client_id, caller_function)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,

    "client_prompt_configs": """
        CREATE TABLE IF NOT EXISTS client_prompt_configs (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            client_id   VARCHAR(64) NOT NULL,
            prompt_key  VARCHAR(64) NOT NULL,
            prompt_text MEDIUMTEXT NOT NULL,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_client_prompt (client_id, prompt_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    """,

    # =========================================================================
    # 3. Connectors, Filtering & Rate Limiting
    # =========================================================================
    "connector_configs": """
        CREATE TABLE IF NOT EXISTS connector_configs (
            id                      BIGINT AUTO_INCREMENT PRIMARY KEY,
            client_id               VARCHAR(50) NOT NULL,
            trigger_type            VARCHAR(100) NOT NULL,
            http_method             VARCHAR(10) NOT NULL,
            url                     VARCHAR(500) NOT NULL,
            headers_template        JSON,
            request_template        JSON,
            response_mapping        JSON,
            auth_type               ENUM('bearer','basic','api_key_header','api_key_query','oauth2_client_credentials') NOT NULL,
            auth_secret_encrypted   TEXT,
            auth_field_name         VARCHAR(100) NULL,
            payload_encoding        ENUM('plain','base64_query') NOT NULL DEFAULT 'plain',
            base64_query_param_name VARCHAR(50) NULL,
            id_pattern_regex        VARCHAR(255) NULL,
            owner_email_path        VARCHAR(255) NULL,
            status                  ENUM('draft','pending_approval','live','disabled','pending_deletion') NOT NULL DEFAULT 'draft',
            version                 INT NOT NULL DEFAULT 1,
            created_by              VARCHAR(50),
            approved_by             VARCHAR(50) NULL,
            approved_at             TIMESTAMP NULL,
            created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            live_marker VARCHAR(100)
                GENERATED ALWAYS AS (CASE WHEN status = 'live' THEN trigger_type ELSE NULL END) STORED,
            pending_marker VARCHAR(100)
                GENERATED ALWAYS AS (CASE WHEN status = 'pending_approval' THEN trigger_type ELSE NULL END) STORED,
            UNIQUE INDEX uq_client_live_trigger (client_id, live_marker),
            UNIQUE INDEX uq_client_pending_trigger (client_id, pending_marker),
            INDEX idx_client_status (client_id, status),
            INDEX idx_trigger_type (trigger_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,

    "rate_limit_exemptions": """
        CREATE TABLE IF NOT EXISTS rate_limit_exemptions (
            id               INT AUTO_INCREMENT PRIMARY KEY,
            client_id        VARCHAR(50) NOT NULL,
            sender_or_domain VARCHAR(255) NOT NULL,
            added_by         VARCHAR(100) DEFAULT 'admin',
            notes            VARCHAR(255) DEFAULT NULL,
            created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_client_sender (client_id, sender_or_domain),
            INDEX idx_client_exemption (client_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,

    "blocked_keywords": """
        CREATE TABLE IF NOT EXISTS blocked_keywords (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            client_id  VARCHAR(50) NOT NULL,
            keyword    VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_client_keyword (client_id, keyword)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,

    "blocked_keyword_exceptions": """
        CREATE TABLE IF NOT EXISTS blocked_keyword_exceptions (
            id             INT AUTO_INCREMENT PRIMARY KEY,
            client_id      VARCHAR(50) NOT NULL,
            keyword        VARCHAR(255) NOT NULL,
            allowed_phrase VARCHAR(255) NOT NULL,
            created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_client_kw_phrase (client_id, keyword, allowed_phrase),
            INDEX idx_kw_exceptions_client (client_id, keyword)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,

    "reply_blocked_by_keyword": """
        CREATE TABLE IF NOT EXISTS reply_blocked_by_keyword (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            client_id       VARCHAR(50) NOT NULL,
            from_email      VARCHAR(255) NOT NULL,
            subject         TEXT,
            body            TEXT,
            matched_keyword VARCHAR(255) NOT NULL,
            status          ENUM('pending_review', 'ignored', 'replied') DEFAULT 'pending_review',
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,

    # =========================================================================
    # 4. Email Pipeline, Execution & Ticketing
    # =========================================================================
    "email_logs": """
        CREATE TABLE IF NOT EXISTS email_logs (
            id                   INT AUTO_INCREMENT PRIMARY KEY,
            client_id            VARCHAR(50) NULL,
            from_email           VARCHAR(255),
            subject              TEXT,
            body                 TEXT,
            body_html            LONGTEXT NULL,
            reply                TEXT,
            score                INT,
            status               VARCHAR(50),
            rag_id               VARCHAR(255),
            sentiment            VARCHAR(50) DEFAULT 'Neutral',
            priority             VARCHAR(50) DEFAULT 'Medium',
            execution_steps      TEXT NULL,
            summary              VARCHAR(255) NULL,
            message_id           VARCHAR(255) NULL,
            in_reply_to          VARCHAR(255) NULL,
            thread_id            VARCHAR(100) NULL,
            is_resolved          TINYINT(1) DEFAULT 0,
            troubleshooting_step INT DEFAULT 0,
            intent               VARCHAR(50) DEFAULT NULL,
            escalation_reason    VARCHAR(50) DEFAULT NULL,
            conversation_closed  TINYINT(1) DEFAULT 0,
            created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_email_logs_client_created (client_id, created_at),
            INDEX idx_email_logs_client_status (client_id, status),
            INDEX idx_email_logs_msg_id (message_id),
            INDEX idx_email_logs_thread (client_id, thread_id),
            INDEX idx_email_logs_thread_created (client_id, thread_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,

    "paused_emails": """
        CREATE TABLE IF NOT EXISTS paused_emails (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            client_id  VARCHAR(50) NOT NULL,
            from_email VARCHAR(255) NOT NULL,
            subject    TEXT,
            body       TEXT,
            reason     VARCHAR(255) NOT NULL,
            status     VARCHAR(50) DEFAULT 'Paused',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_client_paused (client_id, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,

    "paused_email_history": """
        CREATE TABLE IF NOT EXISTS paused_email_history (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            client_id  VARCHAR(50) NOT NULL,
            from_email VARCHAR(255) NOT NULL,
            subject    TEXT,
            body       TEXT,
            status     ENUM('pending_review', 'ignored', 'replied') DEFAULT 'pending_review',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_client_status (client_id, status),
            INDEX idx_client_email (client_id, from_email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,

    "draft_emails": """
        CREATE TABLE IF NOT EXISTS draft_emails (
            id               INT AUTO_INCREMENT PRIMARY KEY,
            client_id        VARCHAR(50) NOT NULL,
            email_log_id     INT DEFAULT NULL,
            from_email       VARCHAR(255) NOT NULL,
            sender_name      VARCHAR(255) DEFAULT NULL,
            to_email         VARCHAR(255) NOT NULL,
            subject          VARCHAR(500) NOT NULL,
            original_body    MEDIUMTEXT NOT NULL,
            draft_reply      MEDIUMTEXT NOT NULL,
            confidence_score INT DEFAULT 0,
            intent           VARCHAR(100) DEFAULT NULL,
            sentiment        VARCHAR(50) DEFAULT NULL,
            priority         VARCHAR(20) DEFAULT 'Normal',
            ticket_id        VARCHAR(100) DEFAULT NULL,
            in_reply_to      VARCHAR(255) DEFAULT NULL,
            message_id       VARCHAR(255) DEFAULT NULL,
            status           ENUM('pending', 'approved', 'sent', 'rejected', 'discarded', 'sending') DEFAULT 'pending',
            rejection_reason VARCHAR(255) DEFAULT NULL,
            reviewed_by      VARCHAR(100) DEFAULT NULL,
            reviewed_at      TIMESTAMP NULL DEFAULT NULL,
            sent_at          TIMESTAMP NULL DEFAULT NULL,
            created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_client_status (client_id, status),
            INDEX idx_from_email (from_email),
            INDEX idx_created_at (created_at),
            INDEX idx_intent (intent),
            INDEX idx_confidence (confidence_score)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,

    "ticket_record": """
        CREATE TABLE IF NOT EXISTS ticket_record (
            ticket_id         VARCHAR(50)  NOT NULL PRIMARY KEY,
            client_id         VARCHAR(50)  NOT NULL,
            mail_id           VARCHAR(100) NOT NULL,
            subject           TEXT         NOT NULL,
            body              TEXT         NOT NULL,
            status            VARCHAR(50)  NOT NULL,
            sentiment         VARCHAR(50)  DEFAULT NULL,
            priority          VARCHAR(50)  DEFAULT NULL,
            intent            VARCHAR(50)  DEFAULT NULL,
            escalation_reason VARCHAR(50)  DEFAULT NULL,
            thread_id         VARCHAR(100) DEFAULT NULL,
            turns_to_escalate INT          DEFAULT 1,
            created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ticket_thread (client_id, thread_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,

    "celery_task_log": """
        CREATE TABLE IF NOT EXISTS celery_task_log (
            task_id    VARCHAR(255) NOT NULL PRIMARY KEY,
            client_id  VARCHAR(50)  NOT NULL,
            from_email VARCHAR(255) NOT NULL,
            status     VARCHAR(50)  NOT NULL DEFAULT 'processing',
            created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_celery_task_client (client_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,

    # =========================================================================
    # 5. Observability, History & Customer Entities
    # =========================================================================
    "llm_logs": """
        CREATE TABLE IF NOT EXISTS llm_logs (
            id                BIGINT AUTO_INCREMENT PRIMARY KEY,
            client_id         VARCHAR(50) NOT NULL,
            email_log_id      BIGINT NULL,
            function_name     VARCHAR(100) NOT NULL,
            model             VARCHAR(100) NOT NULL,
            provider          VARCHAR(50) NOT NULL,
            prompt_tokens     INT NOT NULL DEFAULT 0,
            completion_tokens INT NOT NULL DEFAULT 0,
            total_tokens      INT NOT NULL DEFAULT 0,
            estimated_cost    DECIMAL(10,6) NOT NULL DEFAULT 0.000000,
            latency_ms        INT NOT NULL DEFAULT 0,
            status            VARCHAR(20) NOT NULL DEFAULT 'success',
            created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_client_created (client_id, created_at),
            INDEX idx_function (function_name),
            INDEX idx_email_log (email_log_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,

    "action_logs": """
        CREATE TABLE IF NOT EXISTS action_logs (
            idempotency_key VARCHAR(255) PRIMARY KEY,
            client_id       VARCHAR(50)  NOT NULL,
            action_type     VARCHAR(50)  NOT NULL,
            status          VARCHAR(20)  NOT NULL,
            external_ref    VARCHAR(255) NULL,
            error_message   TEXT         NULL,
            created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_client_action (client_id, action_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,

    "chat_history": """
        CREATE TABLE IF NOT EXISTS chat_history (
            id             INT AUTO_INCREMENT PRIMARY KEY,
            client_id      VARCHAR(50)  NOT NULL,
            ticket_id      VARCHAR(100) NOT NULL,
            customer_email VARCHAR(255) NOT NULL,
            summary        TEXT,
            priority       VARCHAR(50)  DEFAULT 'Normal',
            status         VARCHAR(50)  DEFAULT 'NEW',
            created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            updated_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_ticket (ticket_id),
            INDEX idx_client_ticket (client_id, ticket_id),
            INDEX idx_client_customer (client_id, customer_email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,

    "email_customers": """
        CREATE TABLE IF NOT EXISTS email_customers (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            client_id     VARCHAR(255) UNIQUE,
            rag_id        VARCHAR(255),
            customer_name VARCHAR(255),
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,

    "marketing_senders": """
        CREATE TABLE IF NOT EXISTS marketing_senders (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            client_id    VARCHAR(50) NOT NULL,
            sender_email VARCHAR(255) NOT NULL,
            created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_client_sender (client_id, sender_email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,

    "report_column_profiles": """
        CREATE TABLE IF NOT EXISTS report_column_profiles (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            client_id  VARCHAR(50) NOT NULL,
            name       VARCHAR(100) NOT NULL,
            columns    JSON NOT NULL,
            is_default BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_client_profile_name (client_id, name),
            INDEX idx_report_profiles_client (client_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,
}

ALL_TABLES: list[str] = list(TABLE_DEFINITIONS.keys())

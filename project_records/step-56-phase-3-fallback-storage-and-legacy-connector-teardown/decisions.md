# Step 56: Decisions - Phase 3 Fallback Storage & Legacy Connector Teardown

## 1. Neutral Fallback Directory Naming
- **Choice**: Rename `chroma_db/` to `knowledge_fallback/`, update `CHROMA_PATH` in `app/rag.py`, and update mounts in `docker-compose.yml`.
- **Rationale**: ChromaDB was replaced with Qdrant. Retaining the directory name `chroma_db/` created false expectations that ChromaDB was still in use, when the folder only stores emergency offline JSON fallback files.

## 2. Legacy Connector Stack Teardown
- **Choice**: Remove `app/request_handler.py`, delete the 4 legacy payload endpoints in `app/api/connectors.py`, remove legacy table references (`create_payload_table`, `payload_get_ticket_table`) from `app/email_credential.py`, `app/db_init.py`, and `app/migrations/init_schema.py`, and eliminate the legacy fallback in `app/order_routes.py`.
- **Rationale**: The dynamic connector system in `app/connector_executor.py` and `app/connector_config/` is the single source of truth for all CRM, ERP, and status integrations.

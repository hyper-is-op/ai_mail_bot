# Step 03: RAG Embedding Batching and DB Schema Alignment
- **Timestamp:** 2026-09-15 11:10 IST
- **Action:** Fixed batch size overflow on `/embed` and corrected column name mismatch in MySQL knowledge base tables.
- **Details:** 
  1. Segmented payloads into batches <= 32 in `app/embed_client.py` to prevent HTTP 422 errors against `embed_service.py` (which caps at 64).
  2. Fixed SQL query in `app/rag.py` to target `rag_id` rather than nonexistent `collect_name`.

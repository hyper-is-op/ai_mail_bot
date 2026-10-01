# Decisions for Step 03

### Approach: Chunk Segment Batching in Client
- **Context:** Uploading documents generated >64 chunks, exceeding `embed_service.py`'s `MAX_BATCH_SIZE = 64`.
- **Options Considered:**
  1. Increase `MAX_BATCH_SIZE` on the embed service.
  2. Implement client-side segment batching (`BATCH_SIZE = 32`) in `app/embed_client.py`.
- **Reasoning:** Option 2 makes the client resilient regardless of remote service batch constraints and avoids OOM risk on GPU/CPU embedding instances.

# Step 134: Decisions - Fallback RAG Lifecycle Hardening

## 1. Compound Chunk Deletion Filter
- **Decision**: Filter fallback JSON documents using a 3-way compound predicate:
  `doc.get("id") != doc_id and doc.get("doc_id") != doc_id and not str(doc.get("id", "")).startswith(f"{doc_id}_")`
- **Context**: Chunks in fallback JSON are stored with compound IDs like `f"{doc_id}_{idx}"` and metadata `"doc_id": doc_id`. The prior filter `doc.get("id") != doc_id` failed to match chunks, leaving zombie documents in fallback JSON indefinitely.
- **Alternatives Considered**:
  - Filter solely by `doc.get("doc_id") != doc_id`: would fail on legacy unchunked entries that only possess `"id": doc_id`.
  - Prefix matching only: could lead to false positives if doc_id was a substring of another ID without boundary delimiter. The compound predicate solves both edge cases safely.

## 2. Server-Side Fallback UI Schema Normalization
- **Decision**: Introduce `_group_fallback_chunks_into_documents` in `app/rag.py` to aggregate raw chunk rows into unified parent document objects matching Qdrant's `get_client_documents()` output schema (`{id, title, chunks_count, content, client_id?}`).
- **Context**: During vector store or embedding outages, fallback retrieval returns raw chunk fragments. For a document with 32 chunks, the frontend knowledge table displayed 32 fragmented rows instead of 1 document.
- **Alternatives Considered**:
  - Frontend aggregation: Would duplicate normalization logic across web clients, CLI, and API consumers, and would fail if new clients are introduced. Normalizing at the service boundary guarantees contract consistency.

## 3. Title-Assisted Fallback Scoring & Document ID Mapping
- **Decision**: Concatenate title with content (`f"{title}\n{content}"`) in `calculate_fallback_score()` across `query_knowledge()` and `retrieve_knowledge()`, and map `doc_id: doc.get("doc_id") or doc.get("id")`.
- **Context**: Fallback scoring previously scored against chunk content only. Chunks without the product name (e.g. "Verify microphone settings") received score 0.0 against queries like "CZ Dialer" despite the document title being "CZ Dialer Troubleshooting Guide". Furthermore, `retrieve_knowledge` returned chunk-level IDs as `doc_id`, breaking frontend delete operations.

## 4. Two-Pass Zero-Data-Loss Reconciliation
- **Decision**: Implement a two-pass architecture in `reconcile_and_sync_knowledge()`:
  - **Pass 1 (Upstream Recovery)**: Detect unindexed fallback chunks created during embedding outages, embed them, and upsert to Qdrant without holding file locks during network calls.
  - **Pass 2 (Downstream Snapshot)**: Paginated scroll of Qdrant points with UUID string casting, writing an authoritative snapshot to disk only if Qdrant has active chunks for the tenant.
- **Context**: Prevents permanent vector loss for offline-uploaded documents while ensuring fallback JSON remains an exact mirror of confirmed vector store points.
- **Alternatives Considered**:
  - Blind full-store overwrite: Risked wiping offline documents if Qdrant was empty or degraded during reconciliation. Gating snapshot write behind `if all_chunks` ensures non-destructive degradation.

## 5. Physical Disk Purge on Tenant Deletion
- **Decision**: Hook `purge_client_fallback(client_id)` into `app/auth.py:delete_client_account()`.
- **Context**: Deleting a tenant account previously purged MySQL, Redis, and Qdrant points, but left `fallback_<client_id>.json` on disk, causing zombie records to resurface in admin ALL views.

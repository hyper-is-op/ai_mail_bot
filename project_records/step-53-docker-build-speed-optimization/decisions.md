# Decisions: Step 53 - Docker Build Speed Optimization

## 1. Docker Build Context Exclusion (.dockerignore)
- **Problem**: 298.8 MB of build context transferred on every build, taking ~18s transfer + 20s copy.
- **Alternatives Considered**:
  - Keep full context: Unacceptable 38s penalty per build.
  - Granular `.dockerignore`: Exclude `.git`, `qdrant_storage`, `chroma_db`, `frontend`, `project_records`, `.agents`, docs, and caches.
- **Decision**: Implemented comprehensive `.dockerignore` targeting large git history, database volumes, and node/frontend files. Drops context size to < 1 MB.

## 2. Dockerfile.embed Layer Caching Order
- **Problem**: `COPY embed_service.py .` was positioned immediately before the Hugging Face model download. Any modification to `embed_service.py` invalidated the cache for `intfloat/multilingual-e5-small`, forcing a 54s cold download over the network.
- **Decision**: Invert layer order so that the model download occurs immediately after installing dependencies (`requirements.embed.txt`), and `COPY embed_service.py .` occurs last. Subsequent code edits to `embed_service.py` re-use the cached model layer in 0.0s.

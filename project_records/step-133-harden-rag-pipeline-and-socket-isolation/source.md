# Sources: Step 133

## External References
- **Celery Multiprocessing & Shared Sockets**:
  - Source: Celery Worker Guide & Python multiprocessing docs on `fork()` socket inheritance.
  - Context: Sockets, database pools, and HTTP connection pools instantiated in parent process cannot be safely shared across forked children.
- **Multilingual-E5-Small Embedding Properties**:
  - Source: HuggingFace `intfloat/multilingual-e5-small` documentation.
  - Context: E5 models compress cosine similarity space into 0.70-0.95 due to low-temperature InfoNCE contrastive training; relative top-k ordering must be preferred over rigid hard-coded absolute floors.

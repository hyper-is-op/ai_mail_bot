# Step 60: Technical Decisions - Architecture & Execution Lifecycle Flow Specification

## 1. Flow Diagram Realignment
- **Choice**: Rebuilt the Mermaid state chart to depict the modern 5-tier execution path: Ingestion -> Safety Filters -> Context Enrichment -> Autonomous Agent & Tool Dispatch -> Evaluator & Gating -> Actions & Persistence.
- **Rationale**: The previous flow chart reflected the legacy, static A/B routing design. It omitted multi-turn agent loops, safety loop-breaking filters, dynamic connector dispatches, and operator review queues.

## 2. Removal of Obsolete PDF Generator References
- **Choice**: Pruned references to `scripts/generate_flow_pdf.py` and `Email_Bot_Architecture.pdf`.
- **Rationale**: The generator script and binary artifact were deleted in Phase 1 / Step 54 cleanup. Keeping instructions to run a deleted script creates immediate technical debt and user confusion.

## 3. Dynamic Connector Spec Alignment
- **Choice**: Documented `CONTEXT_DATA_KEYS` template expansion, JMESPath response extraction, and SSRF allowlisting in place of the obsolete base64 GET query parameter payloads.
- **Rationale**: Reflects active production code in `app/connector_executor.py` and `app/order_routes.py`.

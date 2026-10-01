# Step 27 Decisions - Fix LLM Metrics API Route Alignment

## Context & Rationale
Investigation into whether LLM token & cost telemetry was working revealed that `frontend/src/lib/api/llm.ts` called `/llm-metrics/${clientId}`, but the backend in `app/api/analytics.py` only declared `@router.get("/llm/metrics/{client_id}")` (with a slash). This caused HTTP 404 responses whenever the LLM telemetry tab was opened or latency was queried.

## Changes Made
1. Added route alias `@router.get("/llm-metrics/{client_id}")` alongside `/llm/metrics/{client_id}` in `app/api/analytics.py` for backwards and forwards compatibility.
2. Aligned `frontend/src/lib/api/llm.ts` to call `/llm/metrics/${clientId}`.

# Step 27 Log - Fix LLM Metrics API Route Alignment

- 2026-09-28T19:15:30Z - Initialized step-27 to investigate whether LLM token & cost telemetry is working and resolve API route mismatch between frontend and backend.
- 2026-09-28T19:15:40Z - Added @router.get("/llm-metrics/{client_id}") route alias in app/api/analytics.py.
- 2026-09-28T19:15:45Z - Aligned frontend/src/lib/api/llm.ts to call /llm/metrics/${clientId}.

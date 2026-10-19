# Step 63: Decisions - WebSocket Dependency Restoration

## 1. WebSocket Library Selection
- **Choice**: Specify `uvicorn[standard]==0.52.4` and add explicit `websockets>=12.0` in `requirements.txt`.
- **Rationale**:
  - `uvicorn` base package only ships with minimal HTTP/1.1 handlers (`h11`). It explicitly requires `websockets` or `wsproto` to upgrade connections to WebSockets.
  - When incoming WebSocket connections hit `/ws`, without a WebSocket protocol library Uvicorn rejects the upgrade and falls back to HTTP GET, which produces a 404 because FastAPI only registers `@app.websocket("/ws")`.
  - Adding `uvicorn[standard]` pulls in optimized C extensions (`uvloop`, `httptools`, `watchfiles`) while `websockets>=12.0` explicitly guarantees RFC 6455 WebSocket support for production and tests.

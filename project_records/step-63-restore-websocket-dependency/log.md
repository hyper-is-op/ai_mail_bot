# Step 63: Restore WebSocket Dependency Log

- **2026-10-05T14:30:10+05:30**: Diagnosed `GET /ws 404 Not Found` and `WARNING: No supported WebSocket library detected` error loop in `mail_ai_api` container.
- **2026-10-05T14:30:30+05:30**: Identified root cause: bare `uvicorn==0.52.4` lacks WebSocket protocol handlers (`websockets` was previously imported transitively by pruned `mcp`/`fastmcp` stack in step-55).
- **2026-10-05T14:30:45+05:30**: Updated `requirements.txt` to use `uvicorn[standard]==0.52.4` and added explicit `websockets>=12.0` dependency.

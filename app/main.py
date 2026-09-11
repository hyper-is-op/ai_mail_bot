import os
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.db_init import initialize_database_and_services
from app.api import (
    auth_router,
    emails_router,
    drafts_router,
    knowledge_router,
    connectors_router,
    analytics_router,
    settings_router,
)

logger = logging.getLogger(__name__)


# =====================================================================
# WebSocket Connection Management & Redis Pub/Sub Listener
# =====================================================================

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Active connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"Active connections: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        dead_connections = []
        for connection in list(self.active_connections):
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.warning(f"WebSocket send failed: {e}")
                dead_connections.append(connection)
        for dc in dead_connections:
            self.disconnect(dc)

manager = ConnectionManager()


async def redis_pubsub_listener(app: FastAPI):
    import redis.asyncio as async_redis
    redis_url = os.getenv("REDIS_URL", "redis://mail_ai_redis:6379/0")
    if not redis_url:
        redis_url = "redis://localhost:6379/0"
    
    while True:
        try:
            logger.info(f"Connecting to Redis pub/sub at {redis_url}...")
            r = async_redis.from_url(redis_url, decode_responses=True, socket_timeout=None)
            pubsub = r.pubsub()
            await pubsub.subscribe("email_updates")
            logger.info("Subscribed to Redis channel 'email_updates'")
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = message["data"]
                    logger.info(f"Broadcasting Redis pub/sub event: {data}")
                    await manager.broadcast(data)
        except asyncio.CancelledError:
            logger.info("Redis pubsub listener cancelled")
            break
        except Exception as e:
            logger.error(f"Redis pubsub error: {e}. Retrying in 5 seconds...")
            await asyncio.sleep(5)


# =====================================================================
# Application Lifespan
# =====================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    await initialize_database_and_services()
    listener_task = asyncio.create_task(redis_pubsub_listener(app))
    yield
    listener_task.cancel()
    try:
        await listener_task
    except asyncio.CancelledError:
        pass


# =====================================================================
# FastAPI Application & Middlewares
# =====================================================================

app = FastAPI(
    title="Mail AI Automation API",
    description="Enterprise Email AI Automation and Customer Support Platform",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def detailed_error_logging_middleware(request: Request, call_next):
    response = await call_next(request)
    if response.status_code >= 400:
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")
        logger.warning(
            f"⚠️ [HTTP {response.status_code}] "
            f"{request.method} {request.url.path} | "
            f"Client IP: {client_ip} | "
            f"User-Agent: {user_agent}"
        )
    return response


# =====================================================================
# Root Endpoints & WebSocket
# =====================================================================

@app.get("/")
def home():
    return {"status": "mail_ai_automation running"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket connection error: {e}")
        manager.disconnect(websocket)


# =====================================================================
# Include Modular Domain Routers
# =====================================================================

app.include_router(auth_router)
app.include_router(emails_router)
app.include_router(drafts_router)
app.include_router(knowledge_router)
app.include_router(connectors_router)
app.include_router(analytics_router)
app.include_router(settings_router)
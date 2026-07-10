from fastapi import FastAPI, HTTPException, File, UploadFile, Form, Depends, Header
from pydantic import BaseModel, EmailStr, field_validator
from worker.tasks import process_email_task
from app.email_credential import ensure_payload_get_ticket_table, insert_payload_get_ticket, save_email_account, get_email_account, create_email_record_db, ensure_create_payload_table, insert_create_payload_ticket, get_create_payload_table, get_payload_get_ticket_table, get_all_create_payloads, get_all_get_payloads
from app.order_routes import get_order_by_id
from app.auth import ensure_users_table, login_user #,register_user
from app.rate_limiter import RedisRateLimiter
from enum import Enum
from contextlib import asynccontextmanager
from typing import Any
import asyncio
import logging

from app.auth_deps import get_current_user, require_admin, require_client_access
from fastapi import Depends

logger = logging.getLogger(__name__)


def preload_qdrant_collection():
    """
    Startup equivalent of the old Chroma warmup — here it just means
    "make sure the shared collection exists" and log whether embed_service
    is reachable. There's no per-request model warmup to do on this side
    anymore; that lives entirely in embed_service's own startup.
    """
    try:
        from app.vector_store import ensure_collection
        from app.embed_client import embed_service_healthy
        if ensure_collection():
            logger.info("✅ Qdrant collection ensured at startup")
        else:
            logger.warning("⚠️ Qdrant not reachable at API startup — RAG will degrade until it recovers")
        if not embed_service_healthy():
            logger.warning("⚠️ embed_service not reachable at API startup — RAG will degrade until it recovers")
    except Exception as e:
        logger.warning(f"⚠️ Qdrant/embed_service startup check failed: {e}")

def backfill_client_ids():
    try:
        from app.db import get_db_ctx
        with get_db_ctx() as db:
            with db.cursor() as cursor:
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS email_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    client_id VARCHAR(50) NULL,
                    from_email VARCHAR(255),
                    subject TEXT,
                    body TEXT,
                    reply TEXT,
                    score INT,
                    status VARCHAR(50),
                    rag_id VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """)
                try:
                    cursor.execute("ALTER TABLE email_logs ADD COLUMN client_id VARCHAR(50) NULL AFTER id")
                except:
                    pass
                try:
                    cursor.execute("ALTER TABLE email_logs ADD COLUMN sentiment VARCHAR(50) DEFAULT 'Neutral'")
                except:
                    pass
                try:
                    cursor.execute("ALTER TABLE email_logs ADD COLUMN priority VARCHAR(50) DEFAULT 'Medium'")
                except:
                    pass
                try:
                    cursor.execute("ALTER TABLE email_logs ADD COLUMN execution_steps TEXT NULL")
                except:
                    pass
                
                cursor.execute("SELECT id, rag_id FROM email_logs WHERE client_id IS NULL AND rag_id IS NOT NULL")
                rows = cursor.fetchall()
                for row in rows:
                    log_id, rag_id = row
                    if rag_id.startswith("client_"):
                        parts = rag_id.split("_")
                        if len(parts) >= 2:
                            raw_id = parts[1].upper()
                            if len(parts) > 2:
                                raw_id = raw_id + "-" + "-".join(parts[2:]).upper()
                            cursor.execute("UPDATE email_logs SET client_id = %s WHERE id = %s", (raw_id, log_id))
                db.commit()
                logger.info("✅ Backfilled existing email_logs client_ids successfully")
    except Exception as e:
        logger.warning(f"⚠️ Backfill client_ids failed: {e}")

from fastapi import WebSocket, WebSocketDisconnect
import os

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
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.warning(f"WebSocket send failed: {e}")

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

def ensure_paused_emails_table():
    try:
        from app.db import get_db_ctx
        with get_db_ctx() as db:
            with db.cursor() as cursor:
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS paused_emails (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    client_id VARCHAR(50),
                    paused_email VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(client_id, paused_email)
                )
                """)
                db.commit()
                logger.info("✅ Ensured paused_emails table exists")
    except Exception as e:
        logger.warning(f"⚠️ Failed to ensure paused_emails table: {e}")

def ensure_llm_configs_table():
    try:
        from app.db import get_db_ctx
        with get_db_ctx() as db:
            with db.cursor() as cursor:
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS llm_configs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    client_id VARCHAR(50) NOT NULL,
                    name VARCHAR(100) NOT NULL,
                    provider VARCHAR(50) NOT NULL,
                    api_key VARCHAR(255) NOT NULL,
                    base_url VARCHAR(255) NULL,
                    model_name VARCHAR(100) NOT NULL,
                    api_version VARCHAR(50) NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """)
                db.commit()
                logger.info("✅ Ensured llm_configs table exists")
    except Exception as e:
        logger.warning(f"⚠️ Failed to ensure llm_configs table: {e}")

# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     await asyncio.to_thread(ensure_create_payload_table)
#     await asyncio.to_thread(ensure_payload_get_ticket_table)
#     await asyncio.to_thread(ensure_users_table)
#     await asyncio.to_thread(preload_chroma_embeddings)
#     await asyncio.to_thread(backfill_client_ids)
#     await asyncio.to_thread(ensure_paused_emails_table)
#     
#     listener_task = asyncio.create_task(redis_pubsub_listener(app))
#     yield
#     listener_task.cancel()
#     try:
#         await listener_task
#     except asyncio.CancelledError:
#         pass

def _run_ensure_accounts_table():
    from app.db import get_db_ctx
    from app.email_credential import ensure_accounts_table_startup
    with get_db_ctx() as db:
        with db.cursor() as cursor:
            ensure_accounts_table_startup(cursor)
        db.commit()
    logger.info("✅ email_accounts table ensured at startup")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await asyncio.to_thread(_run_ensure_accounts_table)
    await asyncio.to_thread(ensure_create_payload_table)
    await asyncio.to_thread(ensure_payload_get_ticket_table)
    await asyncio.to_thread(ensure_users_table)
    await asyncio.to_thread(preload_qdrant_collection)
    await asyncio.to_thread(backfill_client_ids)
    await asyncio.to_thread(ensure_paused_emails_table)
    await asyncio.to_thread(ensure_llm_configs_table)
    
    listener_task = asyncio.create_task(redis_pubsub_listener(app))
    yield
    listener_task.cancel()
    try:
        await listener_task
    except asyncio.CancelledError:
        pass


# app = FastAPI() # old way
app = FastAPI(lifespan=lifespan) # new way with lifespan

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

class EmailRequest(BaseModel):
    client_id: str
    from_email: str
    subject: str
    body: str

class CreateAdminRequest(BaseModel):
    email: EmailStr
    password: str

@app.post("/admin/create-admin")
def create_admin(data: CreateAdminRequest, user: dict = Depends(require_admin())):
    from app.auth import register_admin_by_admin
    res = register_admin_by_admin(data.email, data.password, user["client_id"])
    if not res["success"]:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

class AdminResetPasswordRequest(BaseModel):
    client_id: str
    new_password: str

@app.post("/admin/reset-client-password")
def reset_client_password_endpoint(data: AdminResetPasswordRequest, user: dict = Depends(require_admin())):
    from app.auth import admin_reset_client_password
    res = admin_reset_client_password(data.client_id, data.new_password)
    if not res["success"]:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

class ApproveRequest(BaseModel):
    email: EmailStr

@app.get("/")
def home():
    return {"status": "mail_ai_automation running"}

@app.post("/process-email", dependencies=[Depends(RedisRateLimiter(limit=10, window=60))])
def process_email(data: EmailRequest):
    process_email_task.delay(data.model_dump())
    return {"status": "queued"}


# following by hyper_is_op

class AcceptEmailRequest(BaseModel):
    client_id: str
    email: EmailStr
    password: str
    score_threshold: int = 80
    response_tone: str = "Formal"


    @field_validator("password")
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    # role: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

# @app.post("/register", dependencies=[Depends(RedisRateLimiter(limit=5, window=60))])
# def register(data: RegisterRequest):
#     from app.auth import register_user
#     res = register_user(data.email, data.password)
#     if not res["success"]:
#         raise HTTPException(status_code=400, detail=res["error"])
#     return res

@app.post("/login", dependencies=[Depends(RedisRateLimiter(limit=5, window=60))])
def login(data: LoginRequest):
    res = login_user(data.email, data.password)
    if not res["success"]:
        raise HTTPException(status_code=401, detail=res["error"])
    return res

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordWithOtpRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str

@app.post("/forgot-password/send-otp", dependencies=[Depends(RedisRateLimiter(limit=5, window=60))])
def send_otp_endpoint(data: ForgotPasswordRequest):
    from app.auth import send_reset_otp
    res = send_reset_otp(data.email)
    if not res["success"]:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@app.post("/forgot-password/reset", dependencies=[Depends(RedisRateLimiter(limit=5, window=60))])
def reset_password_endpoint(data: ResetPasswordWithOtpRequest):
    from app.auth import reset_password_with_otp
    res = reset_password_with_otp(data.email, data.otp, data.new_password)
    if not res["success"]:
        raise HTTPException(status_code=400, detail=res["error"])
    return res


class OrderStatusRequest(BaseModel):
    client_id: str
    order_id: str

class EmailStatus(str, Enum):
    done_replied     = "Done_Replied"
    ticket_generated = "Ticket_Generated"

class EmailRecordRequest(BaseModel):
    client_id: str
    mail_id: str
    subject: str
    body: str
    status: EmailStatus

    model_config = {"use_enum_values": True}


@app.post("/accept-email")
def accept_email(data: AcceptEmailRequest, user: dict = Depends(get_current_user)):
    require_client_access(data.client_id, user)
    try:
        save_email_account(data.client_id, data.email, data.password, data.score_threshold, data.response_tone)
        return {"status": "saved", "client_id": data.client_id, "email": data.email, "score_threshold": data.score_threshold, "response_tone": data.response_tone}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")
        
        
@app.get("/email-account/{client_id}")
def get_email_account_by_id(client_id: str):
    try:
        account = get_email_account(client_id)
        if not account:
            raise HTTPException(status_code=404, detail=f"No account found for client_id {client_id}")
        return account
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/email-accounts")
def get_all_email_accounts_endpoint(user: dict = Depends(require_admin())):
    try:
        from app.db import get_db_ctx
        import pymysql
        with get_db_ctx() as db:
            cursor = db.cursor(pymysql.cursors.DictCursor)
            cursor.execute("""
                SELECT 
                    ea.client_id, 
                    COALESCE(u.email, ea.email) AS email, 
                    ea.password,
                    u.email AS login_email,
                    ea.email AS imap_email,
                    ea.password AS imap_password,
                    u.name,
                    u.phone_number,
                    ea.agent_type,
                    ea.department_name,
                    ea.company_name
                FROM email_accounts ea 
                LEFT JOIN users u ON ea.client_id = u.client_id
            """)
            rows = cursor.fetchall()
            return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/create-ticket", status_code=201)
def create_ticket(data: EmailRecordRequest, user: dict = Depends(get_current_user)):
    require_client_access(data.client_id, user)
    result = create_email_record_db(data.model_dump())
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return {
        "message": "Ticket created successfully",
        "ticket_id": result["ticket_id"],
        "client_id": result["client_id"],
        "mail_id": result["mail_id"],
        "status": data.status,
    }

@app.post("/order-status")
def order_status(data: OrderStatusRequest, user: dict = Depends(get_current_user)):
    require_client_access(data.client_id, user)
    try:
        order = get_order_by_id(data.client_id, data.order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        return {"status": "success", "data": order}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")



class PayloadRequest(BaseModel):
    client_id: str
    url: str
    paylod: dict[str, Any]
    

@app.post("/insert-create_payload_ticket")
def create_payload_ticket(data: PayloadRequest, user: dict = Depends(get_current_user)):
    require_client_access(data.client_id, user)
    try:
        res_id = insert_create_payload_ticket(client_id=data.client_id, url=data.url, paylod=data.paylod)
        return {"status": "success", "client_id": res_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/insert-payload_get_ticket")
def payload_get_ticket(data: PayloadRequest, user: dict = Depends(get_current_user)):
    require_client_access(data.client_id, user)
    try:
        res_id = insert_payload_get_ticket(client_id=data.client_id, url=data.url, paylod=data.paylod)
        return {"status": "success", "client_id": res_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/get-create_payload/{client_id}")
def get_create_payload_endpoint(client_id: str, user: dict = Depends(get_current_user)):
    require_client_access(client_id, user)
    try:
        if client_id == "ALL":
            return get_all_create_payloads()
        res = get_create_payload_table(client_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/get-get_payload/{client_id}")
def get_payload_get_endpoint(client_id: str, user: dict = Depends(get_current_user)):
    require_client_access(client_id, user)
    try:
        if client_id == "ALL":
            return get_all_get_payloads()
        res = get_payload_get_ticket_table(client_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/dashboard/stats/{client_id}")
def get_dashboard_stats_endpoint(client_id: str, range_type: str = "all", start_date: str = None, end_date: str = None, user: dict = Depends(get_current_user)):
    require_client_access(client_id, user)
    try:
        from app.db import get_db_ctx
        import datetime
        
        # Initialize default response
        stats_data = {
            "total_emails": 0,
            "pending_emails": 0,
            "ai_replies": 0,
            "failed_emails": 0,
            "tickets_generated": 0,
            "orders_tracked": 0,
            "active_accounts": 0,
            "avg_confidence": 0.0,
            "chart_data": []
        }
        
        # Determine the date range where clause
        date_filter = ""
        date_params = []
        
        if range_type == "today":
            date_filter = " AND DATE(created_at) = CURDATE()"
        elif range_type == "yesterday":
            date_filter = " AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)"
        elif range_type == "this_month":
            date_filter = " AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())"
        elif range_type == "last_month":
            date_filter = " AND MONTH(created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))"
        elif range_type == "custom" and start_date and end_date:
            date_filter = " AND DATE(created_at) BETWEEN %s AND %s"
            date_params = [start_date, end_date]

        with get_db_ctx() as db:
            with db.cursor() as cursor:
                # Dynamically determine if the column is 'client_id' or 'user_id' in email_logs
                col = "client_id"
                try:
                    cursor.execute("DESCRIBE email_logs")
                    cols = [r[0] for r in cursor.fetchall()]
                    if "client_id" not in cols and "user_id" in cols:
                        col = "user_id"
                except Exception as ex:
                    logger.warning(f"⚠️ Could not describe email_logs: {ex}")
                
                # Dynamically determine if the column is 'client_id' or 'user_id' in email_accounts
                acct_col = "client_id"
                try:
                    cursor.execute("DESCRIBE email_accounts")
                    cols = [r[0] for r in cursor.fetchall()]
                    if "client_id" not in cols and "user_id" in cols:
                        acct_col = "user_id"
                except Exception as ex:
                    logger.warning(f"⚠️ Could not describe email_accounts: {ex}")
                
                # 1. Total Emails
                if client_id == "ALL":
                    cursor.execute(f"SELECT COUNT(*) FROM email_logs WHERE 1=1" + date_filter, tuple(date_params))
                else:
                    cursor.execute(f"SELECT COUNT(*) FROM email_logs WHERE {col} = %s" + date_filter, (client_id, *date_params))
                stats_data["total_emails"] = cursor.fetchone()[0]
                
                # 2. Pending Emails
                if client_id == "ALL":
                    cursor.execute(f"SELECT COUNT(*) FROM email_logs WHERE status = 'pending'" + date_filter, tuple(date_params))
                else:
                    cursor.execute(f"SELECT COUNT(*) FROM email_logs WHERE {col} = %s AND status = 'pending'" + date_filter, (client_id, *date_params))
                stats_data["pending_emails"] = cursor.fetchone()[0]
                
                # 3. AI Replies Sent
                if client_id == "ALL":
                    cursor.execute(f"SELECT COUNT(*) FROM email_logs WHERE status IN ('sent', 'ticket_created_and_sent')" + date_filter, tuple(date_params))
                else:
                    cursor.execute(f"SELECT COUNT(*) FROM email_logs WHERE {col} = %s AND status IN ('sent', 'ticket_created_and_sent')" + date_filter, (client_id, *date_params))
                stats_data["ai_replies"] = cursor.fetchone()[0]
                
                # 4. Failed Emails
                if client_id == "ALL":
                    cursor.execute(f"SELECT COUNT(*) FROM email_logs WHERE status IN ('send_failed', 'ticket_created_send_failed')" + date_filter, tuple(date_params))
                else:
                    cursor.execute(f"SELECT COUNT(*) FROM email_logs WHERE {col} = %s AND status IN ('send_failed', 'ticket_created_send_failed')" + date_filter, (client_id, *date_params))
                stats_data["failed_emails"] = cursor.fetchone()[0]
                
                # 5. Tickets Generated (representing processed request tickets)
                if client_id == "ALL":
                    cursor.execute(f"SELECT COUNT(*) FROM email_logs WHERE status IN ('ticket_created_and_sent', 'ticket_created_send_failed')" + date_filter, tuple(date_params))
                else:
                    cursor.execute(f"SELECT COUNT(*) FROM email_logs WHERE {col} = %s AND status IN ('ticket_created_and_sent', 'ticket_created_send_failed')" + date_filter, (client_id, *date_params))
                stats_data["tickets_generated"] = cursor.fetchone()[0]
                
                # 6. Orders Tracked (approx based on queries containing 'order')
                if client_id == "ALL":
                    cursor.execute(f"SELECT COUNT(*) FROM email_logs WHERE (subject LIKE '%%order%%' OR body LIKE '%%order%%')" + date_filter, tuple(date_params))
                else:
                    cursor.execute(f"SELECT COUNT(*) FROM email_logs WHERE {col} = %s AND (subject LIKE '%%order%%' OR body LIKE '%%order%%')" + date_filter, (client_id, *date_params))
                stats_data["orders_tracked"] = cursor.fetchone()[0]
                
                # 7. Active Accounts
                if client_id == "ALL":
                    cursor.execute(f"SELECT COUNT(*) FROM email_accounts")
                else:
                    cursor.execute(f"SELECT COUNT(*) FROM email_accounts WHERE {acct_col} = %s", (client_id,))
                stats_data["active_accounts"] = cursor.fetchone()[0]
                
                # 7b. Average AI Confidence
                if client_id == "ALL":
                    cursor.execute(f"SELECT AVG(score) FROM email_logs WHERE score IS NOT NULL" + date_filter, tuple(date_params))
                else:
                    cursor.execute(f"SELECT AVG(score) FROM email_logs WHERE {col} = %s AND score IS NOT NULL" + date_filter, (client_id, *date_params))
                avg_score = cursor.fetchone()[0]
                stats_data["avg_confidence"] = round(float(avg_score), 1) if avg_score is not None else 0.0
                
                # 8. Dynamic Chart Data
                group_by_format = "%%Y-%%m-%%d"
                group_by_name = "%%b %%d"
                chart_interval = "1=1"
                
                if range_type == "today":
                    group_by_format = "%%H:00"
                    group_by_name = "%%h %%p"
                    chart_interval = "DATE(created_at) = CURDATE()"
                elif range_type == "yesterday":
                    group_by_format = "%%H:00"
                    group_by_name = "%%h %%p"
                    chart_interval = "DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)"
                elif range_type == "this_month":
                    group_by_format = "%%Y-%%m-%%d"
                    group_by_name = "%%b %%d"
                    chart_interval = "MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())"
                elif range_type == "last_month":
                    group_by_format = "%%Y-%%m-%%d"
                    group_by_name = "%%b %%d"
                    chart_interval = "MONTH(created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))"
                elif range_type == "custom" and start_date and end_date:
                    group_by_format = "%%Y-%%m-%%d"
                    group_by_name = "%%b %%d"
                    chart_interval = "DATE(created_at) BETWEEN %s AND %s"
                    
                if client_id == "ALL":
                    chart_params = []
                    if range_type == "custom" and start_date and end_date:
                        chart_params.extend([start_date, end_date])
                    
                    cursor.execute(f"""
                        SELECT DATE_FORMAT(created_at, '{group_by_name}') as formatted_time, 
                               COUNT(*) as emails, 
                               SUM(CASE WHEN status IN ('sent', 'ticket_created_and_sent') THEN 1 ELSE 0 END) as ai_replies,
                               DATE_FORMAT(created_at, '{group_by_format}') as sort_key
                        FROM email_logs
                        WHERE {chart_interval}
                        GROUP BY sort_key, formatted_time
                        ORDER BY sort_key ASC
                    """, tuple(chart_params))
                else:
                    chart_params = [client_id]
                    if range_type == "custom" and start_date and end_date:
                        chart_params.extend([start_date, end_date])
                    
                    cursor.execute(f"""
                        SELECT DATE_FORMAT(created_at, '{group_by_name}') as formatted_time, 
                               COUNT(*) as emails, 
                               SUM(CASE WHEN status IN ('sent', 'ticket_created_and_sent') THEN 1 ELSE 0 END) as ai_replies,
                               DATE_FORMAT(created_at, '{group_by_format}') as sort_key
                        FROM email_logs
                        WHERE {col} = %s AND {chart_interval}
                        GROUP BY sort_key, formatted_time
                        ORDER BY sort_key ASC
                    """, tuple(chart_params))
                rows = cursor.fetchall()
                
        chart_data = []
        for row in rows:
            chart_data.append({
                "name": row[0],
                "emails": row[1],
                "aiReplied": int(row[2] or 0)
            })
            
        stats_data["chart_data"] = chart_data
        return stats_data
        
    except Exception as e:
        logger.error(f"❌ Failed to fetch dashboard stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/emails/{client_id}")
def get_emails_logs_endpoint(client_id: str, user: dict = Depends(get_current_user)):
    require_client_access(client_id, user)
    try:
        from app.db import get_db_ctx
        with get_db_ctx() as db:
            with db.cursor() as cursor:
                # Dynamically determine column
                col = "client_id"
                try:
                    cursor.execute("DESCRIBE email_logs")
                    cols = [r[0] for r in cursor.fetchall()]
                    if "client_id" not in cols and "user_id" in cols:
                        col = "user_id"
                except Exception as ex:
                    logger.warning(f"⚠️ Could not describe email_logs: {ex}")
                
                try:
                    cursor.execute("ALTER TABLE email_logs ADD COLUMN summary VARCHAR(255) NULL")
                    db.commit()
                except Exception:
                    pass
                
                if client_id == "ALL":
                    cursor.execute(f"""
                        SELECT id, from_email, subject, body, reply, score, status, created_at, rag_id, sentiment, priority, execution_steps, summary, {col} as client_id 
                        FROM email_logs 
                        ORDER BY created_at DESC
                    """)
                else:
                    cursor.execute(f"""
                        SELECT id, from_email, subject, body, reply, score, status, created_at, rag_id, sentiment, priority, execution_steps, summary, {col} as client_id 
                        FROM email_logs 
                        WHERE {col} = %s 
                        ORDER BY created_at DESC
                    """, (client_id,))
                rows = cursor.fetchall()
                
                import json
                emails_list = []
                for r in rows:
                    ui_status = "New"
                    if r[6] in ["sent", "ticket_created_and_sent"]:
                        ui_status = "Replied" if r[6] == "sent" else "Ticket_Generated"
                    elif r[6] in ["send_failed", "ticket_created_send_failed"]:
                        ui_status = "Failed"
                    elif r[6] == "pending":
                        ui_status = "Processing"
                    elif r[6] == "pending_manual_review":
                        ui_status = "Pending Review"
                        
                    steps = ["Start"]
                    if len(r) > 11 and r[11]:
                        try:
                            steps = json.loads(r[11])
                        except Exception:
                            pass

                    emails_list.append({
                        "id": r[0],
                        "mailId": f"msg-{r[0]}",
                        "sender": r[1],
                        "subject": r[2],
                        "preview": r[3],
                        "reply": r[4],
                        "confidence": f"{r[5]}%" if r[5] else "90%",
                        "status": ui_status,
                        "category": "Customer Query",
                        "time": r[7].strftime("%I:%M %p") if r[7] else "Just Now",
                        "date_str": r[7].strftime("%b %d, %Y") if r[7] else "",
                        "raw_status": r[6],
                        "score": r[5] if r[5] is not None else 90,
                        "rag_id": r[8] if len(r) > 8 else None,
                        "sentiment": r[9] if len(r) > 9 and r[9] else "Neutral",
                        "priority": r[10] if len(r) > 10 and r[10] else "Medium",
                        "execution_steps": steps,
                        "summary": r[12] if len(r) > 12 and r[12] else "",
                        "client_id": r[13] if len(r) > 13 else None
                    })
                return emails_list
    except Exception as e:
        logger.error(f"❌ Failed to fetch emails logs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tickets/{client_id}")
def get_tickets_logs_endpoint(client_id: str, user: dict = Depends(get_current_user)):
    require_client_access(client_id, user)
    try:
        from app.db import get_db_ctx
        with get_db_ctx() as db:
            with db.cursor() as cursor:
                # Ensure the table is created/updated
                try:
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS ticket_record (
                            ticket_id  VARCHAR(50)  NOT NULL PRIMARY KEY,
                            client_id  VARCHAR(50)  NOT NULL,
                            mail_id    VARCHAR(100) NOT NULL,
                            subject    TEXT         NOT NULL,
                            body       TEXT         NOT NULL,
                            status     VARCHAR(50)  NOT NULL,
                            created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
                        )
                    """)
                except Exception as tbl_ex:
                    logger.warning(f"⚠️ Could not ensure ticket_record table: {tbl_ex}")

                # Ensure sentiment and priority exist in ticket_record
                try:
                    cursor.execute("ALTER TABLE ticket_record ADD COLUMN sentiment VARCHAR(50) DEFAULT 'Neutral'")
                except Exception:
                    pass
                try:
                    cursor.execute("ALTER TABLE ticket_record ADD COLUMN priority VARCHAR(50) DEFAULT 'Medium'")
                except Exception:
                    pass

                # Dynamically determine column
                col = "client_id"
                try:
                    cursor.execute("DESCRIBE ticket_record")
                    cols = [r[0] for r in cursor.fetchall()]
                    if "client_id" not in cols and "user_id" in cols:
                        col = "user_id"
                except Exception as ex:
                    logger.warning(f"⚠️ Could not describe ticket_record: {ex}")
                
                if client_id == "ALL":
                    cursor.execute(f"""
                        SELECT ticket_id, mail_id, subject, body, status, created_at, sentiment, priority 
                        FROM ticket_record 
                        ORDER BY created_at DESC
                    """)
                else:
                    cursor.execute(f"""
                        SELECT ticket_id, mail_id, subject, body, status, created_at, sentiment, priority 
                        FROM ticket_record 
                        WHERE {col} = %s 
                        ORDER BY created_at DESC
                    """, (client_id,))
                rows = cursor.fetchall()
                
                tickets_list = []
                for r in rows:
                    tickets_list.append({
                        "id": r[0],
                        "mailId": r[1],
                        "subject": r[2],
                        "preview": r[3],
                        "status": r[4],
                        "priority": r[7] if len(r) > 7 and r[7] else "Medium",
                        "sentiment": r[6] if len(r) > 6 and r[6] else "Neutral",
                        "time": r[5].strftime("%I:%M %p") if r[5] else "Just Now",
                        "date_str": r[5].strftime("%Y-%m-%d %I:%M %p") if r[5] else ""
                    })
                return tickets_list
    except Exception as e:
        logger.error(f"❌ Failed to fetch tickets list: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))




class RagUploadRequest(BaseModel):
    client_id: str
    title: str
    content: str

class RagQueryRequest(BaseModel):
    client_id: str
    query: str

@app.post("/rag/upload", dependencies=[Depends(RedisRateLimiter(limit=10, window=60))])
def upload_rag_data_endpoint(data: RagUploadRequest, user: dict = Depends(get_current_user)):
    require_client_access(data.client_id, user)
    try:
        from app.rag import add_knowledge
        doc_id = add_knowledge(data.client_id, data.title, data.content)
        return {"status": "success", "doc_id": doc_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/rag/documents/{client_id}")
def get_rag_documents_endpoint(client_id: str, user: dict = Depends(get_current_user)):
    require_client_access(client_id, user)
    try:
        from app.rag import get_knowledge_base
        docs = get_knowledge_base(client_id)
        return docs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/rag/documents/{client_id}/{doc_id}")
def delete_rag_document_endpoint(client_id: str, doc_id: str, user: dict = Depends(get_current_user)):
    require_client_access(client_id, user)
    try:
        from app.rag import delete_knowledge
        success = delete_knowledge(client_id, doc_id)
        if not success:
            raise HTTPException(status_code=404, detail="Document not found")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/rag/query", dependencies=[Depends(RedisRateLimiter(limit=20, window=60))])
def query_rag_endpoint(data: RagQueryRequest, user: dict = Depends(get_current_user)):
    require_client_access(data.client_id, user)
    try:
        from app.rag import query_knowledge
        context = query_knowledge(data.client_id, data.query)
        return {"context": context}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class RagRetrieveRequest(BaseModel):
    client_id: str
    query: str
    top_k: int = 3

@app.post("/rag/retrieve", dependencies=[Depends(RedisRateLimiter(limit=20, window=60))])
def retrieve_rag_endpoint(data: RagRetrieveRequest, user: dict = Depends(get_current_user)):
    require_client_access(data.client_id, user)
    try:
        from app.rag import retrieve_knowledge
        results = retrieve_knowledge(data.client_id, data.query, data.top_k)
        return {"status": "success", "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/admin/knowledge-stats")
def get_admin_knowledge_stats(user: dict = Depends(require_admin())):
    try:
        from app.db import get_db_ctx
        from app.rag import get_knowledge_base
        
        with get_db_ctx() as db:
            cursor = db.cursor()
            cursor.execute("""
                SELECT ea.client_id, COALESCE(u.email, ea.email) AS email 
                FROM email_accounts ea 
                LEFT JOIN users u ON ea.client_id = u.client_id
            """)
            clients = cursor.fetchall()
            
        stats = []
        for cid, email in clients:
            try:
                docs = get_knowledge_base(cid)
                doc_count = len(docs)
            except Exception:
                doc_count = 0
            stats.append({
                "client_id": cid,
                "email": email,
                "documents_count": doc_count
            })
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/rag/upload-file", dependencies=[Depends(RedisRateLimiter(limit=10, window=60))])
async def upload_rag_file_endpoint(
    client_id: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    require_client_access(client_id, user)
    try:
        from app.rag import parse_uploaded_file, add_knowledge
        ext = file.filename.split('.')[-1].lower()
        if ext not in ['pdf', 'doc', 'docx', 'txt']:
            raise HTTPException(status_code=400, detail="Unsupported file format. Only .pdf, .doc, .docx, and .txt files are allowed.")
        file_bytes = await file.read()
        title, content = parse_uploaded_file(file.filename, file_bytes)
        if not content.strip():
            raise HTTPException(status_code=400, detail="The uploaded file does not contain any readable text content.")
        doc_id = add_knowledge(client_id, title, content)
        return {"status": "success", "doc_id": doc_id, "title": title}
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))





# chat history start
# ==============================
# 💬 Chat History Endpoints
# ==============================
from app.chat_history import get_history, clear_history

@app.get("/chat-history/{client_id}/{from_email}")
def get_chat_history(client_id: str, from_email: str, last_n: int = 15, user: dict = Depends(get_current_user)):
    require_client_access(client_id, user)
    """
    Returns last N messages for a customer.
    Checks Redis first, falls back to MySQL.
    """
    history = get_history(client_id, from_email, last_n=last_n)
    if not history:
        raise HTTPException(status_code=404, detail="No history found")
    return {
        "client_id":  client_id,
        "from_email": from_email,
        "count":      len(history),
        "history":    history
    }


@app.delete("/chat-history/{client_id}/{from_email}")
def delete_chat_history(client_id: str, from_email: str, user: dict = Depends(get_current_user)):
    require_client_access(client_id, user)
    """
    Clears Redis cache for this customer.
    MySQL history is permanent and not deleted.
    """
    clear_history(client_id, from_email)
    return {
        "status":     "redis_cache_cleared",
        "client_id":  client_id,
        "from_email": from_email,
        "note":       "MySQL history is retained"
    }
# chat history end


# ==============================
# 📊 LLM Analytics Endpoints
# ==============================

@app.get("/llm/metrics/{client_id}")
def get_llm_metrics_endpoint(client_id: str, user: dict = Depends(get_current_user)):
    require_client_access(client_id, user)
    try:
        from app.db import get_db_ctx
        with get_db_ctx() as db:
            with db.cursor() as cursor:
                # First ensure table exists
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS llm_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    client_id VARCHAR(50) NOT NULL,
                    model_name VARCHAR(100) NOT NULL,
                    prompt_tokens INT NOT NULL,
                    completion_tokens INT NOT NULL,
                    cost DECIMAL(10, 6) NOT NULL,
                    latency_ms INT NOT NULL,
                    caller_function VARCHAR(100) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """)
                db.commit()
                
                # 1. Total statistics
                if client_id == "ALL":
                    cursor.execute("""
                        SELECT 
                            COUNT(id) as total_requests,
                            SUM(prompt_tokens) as total_prompt_tokens,
                            SUM(completion_tokens) as total_completion_tokens,
                            SUM(cost) as total_cost,
                            AVG(latency_ms) as avg_latency
                        FROM llm_logs
                    """)
                else:
                    cursor.execute("""
                        SELECT 
                            COUNT(id) as total_requests,
                            SUM(prompt_tokens) as total_prompt_tokens,
                            SUM(completion_tokens) as total_completion_tokens,
                            SUM(cost) as total_cost,
                            AVG(latency_ms) as avg_latency
                        FROM llm_logs
                        WHERE client_id = %s
                    """, (client_id,))
                total_row = cursor.fetchone()
                
                totals = {
                    "total_requests": int(total_row[0] or 0),
                    "total_prompt_tokens": int(total_row[1] or 0),
                    "total_completion_tokens": int(total_row[2] or 0),
                    "total_cost": float(total_row[3] or 0.0),
                    "avg_latency": float(total_row[4] or 0.0)
                }
                
                # 2. Breakdown by Model
                if client_id == "ALL":
                    cursor.execute("""
                        SELECT 
                            model_name,
                            COUNT(id) as requests,
                            SUM(prompt_tokens) as prompt_tokens,
                            SUM(completion_tokens) as completion_tokens,
                            SUM(cost) as cost,
                            AVG(latency_ms) as avg_latency
                        FROM llm_logs
                        GROUP BY model_name
                    """)
                else:
                    cursor.execute("""
                        SELECT 
                            model_name,
                            COUNT(id) as requests,
                            SUM(prompt_tokens) as prompt_tokens,
                            SUM(completion_tokens) as completion_tokens,
                            SUM(cost) as cost,
                            AVG(latency_ms) as avg_latency
                        FROM llm_logs
                        WHERE client_id = %s
                        GROUP BY model_name
                    """, (client_id,))
                model_rows = cursor.fetchall()
                model_breakdown = []
                for row in model_rows:
                    model_breakdown.append({
                        "model_name": row[0],
                        "requests": int(row[1] or 0),
                        "prompt_tokens": int(row[2] or 0),
                        "completion_tokens": int(row[3] or 0),
                        "cost": float(row[4] or 0.0),
                        "avg_latency": float(row[5] or 0.0)
                    })
                    
                # 3. Breakdown by Caller Function
                if client_id == "ALL":
                    cursor.execute("""
                        SELECT 
                            caller_function,
                            COUNT(id) as requests,
                            SUM(prompt_tokens) as prompt_tokens,
                            SUM(completion_tokens) as completion_tokens,
                            SUM(cost) as cost,
                            AVG(latency_ms) as avg_latency
                        FROM llm_logs
                        GROUP BY caller_function
                    """)
                else:
                    cursor.execute("""
                        SELECT 
                            caller_function,
                            COUNT(id) as requests,
                            SUM(prompt_tokens) as prompt_tokens,
                            SUM(completion_tokens) as completion_tokens,
                            SUM(cost) as cost,
                            AVG(latency_ms) as avg_latency
                        FROM llm_logs
                        WHERE client_id = %s
                        GROUP BY caller_function
                    """, (client_id,))
                caller_rows = cursor.fetchall()
                caller_breakdown = []
                for row in caller_rows:
                    func_name = row[0]
                    if func_name == "detect_intent_llm":
                        func_display = "Intent Classification"
                    elif func_name == "generate_reply_llm" or "reply" in func_name:
                        func_display = "Reply Draft Generation"
                    else:
                        func_display = func_name.replace("_", " ").title()
                        
                    caller_breakdown.append({
                        "caller_function": row[0],
                        "caller_display": func_display,
                        "requests": int(row[1] or 0),
                        "prompt_tokens": int(row[2] or 0),
                        "completion_tokens": int(row[3] or 0),
                        "cost": float(row[4] or 0.0),
                        "avg_latency": float(row[5] or 0.0)
                    })
                    
                # 4. Recent Logs (last 30)
                if client_id == "ALL":
                    cursor.execute("""
                        SELECT 
                            id, model_name, prompt_tokens, completion_tokens, cost, latency_ms, caller_function, created_at
                        FROM llm_logs
                        ORDER BY created_at DESC
                        LIMIT 30
                    """)
                else:
                    cursor.execute("""
                        SELECT 
                            id, model_name, prompt_tokens, completion_tokens, cost, latency_ms, caller_function, created_at
                        FROM llm_logs
                        WHERE client_id = %s
                        ORDER BY created_at DESC
                        LIMIT 30
                    """, (client_id,))
                log_rows = cursor.fetchall()
                recent_logs = []
                for row in log_rows:
                    func_name = row[6]
                    if func_name == "detect_intent_llm":
                        func_display = "Intent Classification"
                    elif func_name == "generate_reply_llm" or "reply" in func_name:
                        func_display = "Reply Draft Generation"
                    else:
                        func_display = func_name.replace("_", " ").title()
                        
                    recent_logs.append({
                        "id": row[0],
                        "model_name": row[1],
                        "prompt_tokens": int(row[2]),
                        "completion_tokens": int(row[3]),
                        "cost": float(row[4]),
                        "latency_ms": int(row[5]),
                        "caller_function": row[6],
                        "caller_display": func_display,
                        "created_at": row[7].strftime("%b %d, %H:%M:%S") if row[7] else ""
                    })
                
   
                # 5. Budget Info
                from app.email_credential import get_budget_status
                budget_info = get_budget_status(client_id, cursor)
                
                    
                return {
                    "status": "success",
                    "totals": totals,
                    "models": model_breakdown,
                    "callers": caller_breakdown,
                    "logs": recent_logs,
                    "budget": budget_info
                }
    except Exception as e:
        logger.error(f"❌ Failed to fetch LLM analytics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/approve-registration")
def approve_registration_endpoint(data: ApproveRequest, user: dict = Depends(require_admin())):
    email = data.email
    try:
        from app.db import get_db_ctx
        with get_db_ctx() as db:
            with db.cursor() as cursor:
                cursor.execute("SELECT client_id, role, status FROM users WHERE email = %s", (email,))
                db_user = cursor.fetchone()
                if not db_user:
                    raise HTTPException(status_code=404, detail="User not found")
                
                client_id, role, status = db_user[0], db_user[1], db_user[2]
                if status == 'active':
                    return {"status": "success", "message": "User is already active"}
                
                cursor.execute("UPDATE users SET status = 'active' WHERE email = %s", (email,))
                db.commit()
                
                try:
                    cursor.execute("SELECT client_id FROM email_accounts LIMIT 1")
                    row = cursor.fetchone()
                    sender_client_id = row[0] if row else "CLI-7AE811F3"
                    
                    from app.mailer import send_email
                    subject = "Your Mail AI Account is Approved!"
                    body = (
                        f"Hello,\n\n"
                        f"Your registration request has been approved by the admin.\n"
                        f"You can now log in to your account at:\n"
                        f"http://172.16.3.215:1947/login\n\n"
                        f"Best regards,\n"
                        f"Mail AI Team"
                    )
                    send_email(sender_client_id, email, subject, body)
                except Exception as mail_err:
                    logger.error(f"Failed to send confirmation email: {mail_err}")
                
                return {"status": "success", "message": f"User {email} has been approved successfully."}
    except Exception as e:
        logger.error(f"Approval error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/logout")
def logout(authorization: str = Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        from app.auth import destroy_session
        destroy_session(authorization[7:])
    return {"status": "logged_out"}


# ==============================
# ⏸ Pause Emails & Manual Reply
# ==============================

class PauseEmailRequest(BaseModel):
    client_id: str
    email: str

class ManualReplyRequest(BaseModel):
    client_id: str
    to_email: str
    subject: str
    body: str = ""
    reply_text: str
    blocked_record_id: int | None = None  # optional, only for keyword-blocked emails

@app.post("/pause-email")
def pause_email(data: PauseEmailRequest, user: dict = Depends(get_current_user)):
    require_client_access(data.client_id, user)
    try:
        from app.db import get_db_ctx
        with get_db_ctx() as db:
            with db.cursor() as cursor:
                cursor.execute("INSERT IGNORE INTO paused_emails (client_id, paused_email) VALUES (%s, %s)", (data.client_id, data.email))
                db.commit()
        return {"status": "success", "message": f"{data.email} is paused."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# unpause-email had NO auth at all — anyone could unpause any client's emails
@app.post("/unpause-email")
def unpause_email(data: PauseEmailRequest, user: dict = Depends(get_current_user)):
    require_client_access(data.client_id, user)
    try:
        from app.db import get_db_ctx
        with get_db_ctx() as db:
            with db.cursor() as cursor:
                cursor.execute("DELETE FROM paused_emails WHERE client_id = %s AND paused_email = %s", (data.client_id, data.email))
                db.commit()
        return {"status": "success", "message": f"{data.email} is unpaused."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/paused-emails/{client_id}")
def get_paused_emails_endpoint(client_id: str, user: dict = Depends(get_current_user)):
    require_client_access(client_id, user)
    try:
        from app.db import get_db_ctx
        with get_db_ctx() as db:
            with db.cursor() as cursor:
                if client_id == "ALL":
                    cursor.execute("SELECT paused_email FROM paused_emails")
                else:
                    cursor.execute("SELECT paused_email FROM paused_emails WHERE client_id = %s", (client_id,))
                rows = cursor.fetchall()
                return [r[0] for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/manual-reply")
def send_manual_reply(data: ManualReplyRequest, user: dict = Depends(get_current_user)):
    require_client_access(data.client_id, user)
    try:
        from app.mailer import send_email
        import json

        from app.db import get_db_ctx
        with get_db_ctx() as db:
            with db.cursor() as cursor:

                # STEP 1 — validate blocked_record_id before anything irreversible
                if data.blocked_record_id is not None:
                    cursor.execute("""
                        SELECT status FROM reply_blocked_by_keyword
                        WHERE id = %s AND client_id = %s
                    """, (data.blocked_record_id, data.client_id))
                    record = cursor.fetchone()

                    if not record:
                        raise HTTPException(
                            status_code=404,
                            detail=f"blocked_record_id={data.blocked_record_id} not found for this client"
                        )
                    if record[0] != 'pending_review':
                        raise HTTPException(
                            status_code=400,
                            detail=f"Record already actioned — current status is '{record[0]}'"
                        )

                # STEP 2 — send email, capture result, never let it throw
                send_status = send_email(
                    data.client_id, data.to_email, data.subject, data.reply_text
                )

                # STEP 3 — log regardless of send outcome
                exec_steps = ["Start", "Manual_Reply", "SMTP_Send" if send_status else "SMTP_Failed"]
                cursor.execute("""
                    INSERT INTO email_logs (client_id, from_email, subject, body, reply, score, status, priority, sentiment, execution_steps)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    data.client_id, data.to_email, data.subject, data.body,
                    data.reply_text, 100,
                    'manual_reply' if send_status else 'manual_reply_send_failed',
                    'Medium', 'Neutral',
                    json.dumps(exec_steps)
                ))

                # STEP 4 — only mark replied if SMTP confirmed success
                if data.blocked_record_id is not None:
                    if send_status:
                        cursor.execute("""
                            UPDATE reply_blocked_by_keyword
                            SET status = 'replied'
                            WHERE id = %s AND client_id = %s
                        """, (data.blocked_record_id, data.client_id))
                    else:
                        logger.warning(
                            f"⚠️ SMTP failed for blocked_record_id={data.blocked_record_id}"
                            f" — status stays 'pending_review'"
                        )

                db.commit()

                if not send_status:
                    raise HTTPException(
                        status_code=502,
                        detail="Email failed to send — record kept as pending_review, log entry written"
                    )

        # STEP 5 — chat history
        from app.chat_history import push_message
        push_message(
            client_id=data.client_id,
            from_email=data.to_email,
            role="support",
            subject=data.subject,
            body=data.reply_text,
            ticket_id=""
        )

        # STEP 6 — Redis broadcast
        import redis
        import os
        redis_url = os.getenv("REDIS_URL", "redis://mail_ai_redis:6379/0") or "redis://localhost:6379/0"
        try:
            r = redis.from_url(redis_url)
            r.publish("email_updates", json.dumps({
                "type": "NEW_EMAIL",
                "client_id": data.client_id
            }))
        except Exception as ex:
            logger.warning(f"Redis publish failed: {ex}")

        return {"status": "success", "message": "Manual reply sent"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Manual reply error: {e}")
        raise HTTPException(status_code=500, detail=str(e))




class ApprovePendingReplyRequest(BaseModel):
    client_id: str
    log_id: int

@app.post("/approve-pending-reply")
def approve_pending_reply(data: ApprovePendingReplyRequest, user: dict = Depends(get_current_user)):
    require_client_access(data.client_id, user)
    from app.db import get_db_ctx
    with get_db_ctx() as db:
        with db.cursor() as cursor:
            cursor.execute(
                "SELECT from_email, subject, reply, status FROM email_logs WHERE id=%s AND client_id=%s",
                (data.log_id, data.client_id)
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Log entry not found")
            from_email, subject, reply, status = row
            if status != "pending_manual_review":
                raise HTTPException(status_code=400, detail=f"Log is not pending review (status={status})")
            if not reply:
                raise HTTPException(status_code=400, detail="No stored reply — use /manual-reply to compose one instead")

            send_status = send_email(data.client_id, from_email, "Re: " + subject, reply)
            new_status = "sent" if send_status else "send_failed"
            cursor.execute("UPDATE email_logs SET status=%s WHERE id=%s", (new_status, data.log_id))
            db.commit()

    from app.chat_history import push_message
    push_message(client_id=data.client_id, from_email=from_email, role="support",
                 subject="Re: " + subject, body=reply, ticket_id="")
    return {"status": "success", "new_status": new_status}


class ClientFeaturesRequest(BaseModel):
    client_id: str
    feature_ticket_creation: bool
    feature_auto_send: bool
    feature_rag: bool
    feature_order_tracking: bool
    feature_manual_reply: bool

@app.post("/admin/client-features")
def set_client_features(data: ClientFeaturesRequest, user: dict = Depends(require_admin())):
    from app.db import get_db_ctx
    with get_db_ctx() as db:
        with db.cursor() as cursor:
            cursor.execute("""
                UPDATE email_accounts SET feature_ticket_creation=%s, feature_auto_send=%s,
                feature_rag=%s, feature_order_tracking=%s, feature_manual_reply=%s
                WHERE client_id=%s
            """, (data.feature_ticket_creation, data.feature_auto_send, data.feature_rag,
                  data.feature_order_tracking, data.feature_manual_reply, data.client_id))
            db.commit()
    return {"status": "success"}

class ClientModelConfigRequest(BaseModel):
    client_id: str
    caller_function: str
    model_name: str

@app.post("/admin/client-model-config")
def set_client_model_config(data: ClientModelConfigRequest, user: dict = Depends(require_admin())):
    from app.db import get_db_ctx
    with get_db_ctx() as db:
        with db.cursor() as cursor:
            cursor.execute("""
                INSERT INTO client_model_config (client_id, caller_function, model_name)
                VALUES (%s, %s, %s) ON DUPLICATE KEY UPDATE model_name=%s
            """, (data.client_id, data.caller_function, data.model_name, data.model_name))
            db.commit()
    return {"status": "success"}

@app.get("/admin/client-model-config/{client_id}")
def get_client_model_config(client_id: str, user: dict = Depends(require_admin())):
    from app.db import get_db_ctx
    with get_db_ctx() as db:
        with db.cursor() as cursor:
            cursor.execute("SELECT caller_function, model_name FROM client_model_config WHERE client_id=%s", (client_id,))
            rows = cursor.fetchall()
    return [{"caller_function": r[0], "model_name": r[1]} for r in rows]

class ClientCostConfigRequest(BaseModel):
    client_id: str
    cost_multiplier: float
    monthly_budget_usd: float | None = None

@app.post("/admin/client-cost-config")
def set_client_cost_config(data: ClientCostConfigRequest, user: dict = Depends(require_admin())):
    from app.db import get_db_ctx
    with get_db_ctx() as db:
        with db.cursor() as cursor:
            cursor.execute(
                "UPDATE email_accounts SET cost_multiplier=%s, monthly_budget_usd=%s WHERE client_id=%s",
                (data.cost_multiplier, data.monthly_budget_usd, data.client_id)
            )
            db.commit()
    return {"status": "success"}


class LlmConfigRequest(BaseModel):
    id: int | None = None
    client_id: str
    name: str
    provider: str
    api_key: str
    base_url: str | None = None
    model_name: str
    api_version: str | None = None

@app.get("/admin/llm-configs")
def get_llm_configs_endpoint(user: dict = Depends(require_admin())):
    from app.db import get_db_ctx
    try:
        with get_db_ctx() as db:
            with db.cursor() as cursor:
                cursor.execute("""
                    SELECT id, client_id, name, provider, api_key, base_url, model_name, api_version, created_at 
                    FROM llm_configs 
                    ORDER BY id DESC
                """)
                rows = cursor.fetchall()
                configs = []
                for r in rows:
                    configs.append({
                        "id": r[0],
                        "client_id": r[1],
                        "name": r[2],
                        "provider": r[3],
                        "api_key": r[4],
                        "base_url": r[5],
                        "model_name": r[6],
                        "api_version": r[7],
                        "created_at": str(r[8])
                    })
                return configs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/admin/llm-configs")
def save_llm_config_endpoint(data: LlmConfigRequest, user: dict = Depends(require_admin())):
    from app.db import get_db_ctx
    try:
        with get_db_ctx() as db:
            with db.cursor() as cursor:
                if data.id:
                    cursor.execute("""
                        UPDATE llm_configs 
                        SET client_id=%s, name=%s, provider=%s, api_key=%s, base_url=%s, model_name=%s, api_version=%s
                        WHERE id=%s
                    """, (data.client_id, data.name, data.provider, data.api_key, data.base_url, data.model_name, data.api_version, data.id))
                else:
                    cursor.execute("""
                        INSERT INTO llm_configs (client_id, name, provider, api_key, base_url, model_name, api_version)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """, (data.client_id, data.name, data.provider, data.api_key, data.base_url, data.model_name, data.api_version))
            db.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/admin/llm-configs/{config_id}")
def delete_llm_config_endpoint(config_id: int, user: dict = Depends(require_admin())):
    from app.db import get_db_ctx
    try:
        with get_db_ctx() as db:
            with db.cursor() as cursor:
                cursor.execute("DELETE FROM llm_configs WHERE id=%s", (config_id,))
            db.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/budget-status/{client_id}")
def get_budget_status_endpoint(client_id: str, user: dict = Depends(get_current_user)):
    require_client_access(client_id, user)
    from app.db import get_db_ctx
    from app.email_credential import get_budget_status
    with get_db_ctx() as db:
        with db.cursor() as cursor:
            return get_budget_status(client_id, cursor)

@app.get("/admin/budget-status")
def get_all_budget_statuses(user: dict = Depends(require_admin())):
    from app.db import get_db_ctx
    from app.email_credential import get_budget_status
    with get_db_ctx() as db:
        with db.cursor() as cursor:
            cursor.execute("SELECT client_id FROM email_accounts")
            client_ids = [r[0] for r in cursor.fetchall()]
            results = []
            for cid in client_ids:
                status = get_budget_status(cid, cursor)
                status["client_id"] = cid
                results.append(status)
    return results


class CreateClientRequest(BaseModel):
    name: str
    phone_number: str
    login_email: EmailStr
    login_password: str
    imap_email: str = ""
    imap_password: str = ""
    score_threshold: int = 80
    response_tone: str = "Formal"
    agent_type: str = "customer_support_agent"
    department_name: str = None
    company_name: str = None

    @field_validator("login_password")
    def login_pw_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("imap_password")
    def imap_pw_strength(cls, v):
        if v and len(v) < 8:
            raise ValueError("IMAP password must be at least 8 characters")
        return v

@app.post("/admin/create-client")
def create_client(data: CreateClientRequest, user: dict = Depends(require_admin())):
    from app.auth import create_client_atomic
    res = create_client_atomic(
        data.name, data.phone_number, data.login_email, data.login_password, data.imap_email, data.imap_password,
        data.score_threshold, data.response_tone,
        data.agent_type, data.department_name, data.company_name
    )
    if not res["success"]:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@app.get("/admin/pending-users")
def list_pending_users(user: dict = Depends(require_admin())):
    from app.auth import get_pending_users
    rows = get_pending_users()
    return [
        {"id": r["id"], "client_id": r["client_id"], "email": r["email"], "role": r["role"],
         "created_at": r["created_at"].strftime("%b %d, %Y %H:%M") if r["created_at"] else ""}
        for r in rows
    ]

# also fix approve_registration_endpoint signature — was a GET with ?email= query param,
# api.ts now POSTs a body. Update the existing route:


@app.get("/admin/users")
def admin_get_all_users(user: dict = Depends(require_admin())):
    from app.auth import get_all_users
    users = get_all_users()
    return {"success": True, "users": users}



class SetUserStatusRequest(BaseModel):
    client_id: str
    status: str  # 'active' or 'inactive'

@app.post("/admin/set-user-status")
def set_user_status_endpoint(data: SetUserStatusRequest, user: dict = Depends(require_admin())):
    from app.auth import set_user_status
    res = set_user_status(data.client_id, data.status)
    if not res["success"]:
        raise HTTPException(status_code=400, detail=res["error"])
    return res


class ClientProfileRequest(BaseModel):
    client_id: str
    name: str = None
    phone_number: str = None
    login_email: str = None
    imap_email: str = None
    imap_password: str = None
    agent_type: str = None
    department_name: str = None
    company_name: str = None

@app.post("/admin/client-profile")
def set_client_profile(data: ClientProfileRequest, user: dict = Depends(require_admin())):
    from app.db import get_db_ctx
    with get_db_ctx() as db:
        with db.cursor() as cursor:
            # Update users table if exists
            cursor.execute("""
                UPDATE users 
                SET name=%s, phone_number=%s, email=%s
                WHERE client_id=%s
            """, (data.name or "", data.phone_number or "", data.login_email or "", data.client_id))
            
            # Update email_accounts table
            cursor.execute("""
                UPDATE email_accounts 
                SET agent_type=%s, department_name=%s, company_name=%s, email=%s, password=%s
                WHERE client_id=%s
            """, (data.agent_type or "", data.department_name or "", data.company_name or "", data.imap_email or "", data.imap_password or "", data.client_id))
            
            db.commit()
    return {"success": True}


class SelfProfileRequest(BaseModel):
    client_id: str
    department_name: str = None
    company_name: str = None

@app.post("/client/profile")
def update_self_profile(data: SelfProfileRequest, user: dict = Depends(get_current_user)):
    require_client_access(data.client_id, user)
    from app.db import get_db_ctx
    with get_db_ctx() as db:
        with db.cursor() as cursor:
            cursor.execute("""
                UPDATE email_accounts 
                SET department_name=%s, company_name=%s
                WHERE client_id=%s
            """, (data.department_name, data.company_name, data.client_id))
            db.commit()
    return {"success": True}



@app.delete("/admin/delete-client/{client_id}")
def delete_client(client_id: str, user: dict = Depends(require_admin())):
    from app.auth import delete_client_account
    res = delete_client_account(client_id)
    if not res["success"]:
        raise HTTPException(status_code=404, detail=res["error"])
    return res



class BlockedKeywordRequest(BaseModel):
    client_id: str
    keyword: str

@app.post("/blocked-keywords/add")
def add_blocked_keyword(data: BlockedKeywordRequest, user: dict = Depends(get_current_user)):
    require_client_access(data.client_id, user)
    from app.db import get_db_ctx
    with get_db_ctx() as db:
        with db.cursor() as cursor:
            from app.keyword_filter import _ensure_table
            _ensure_table(cursor)
            cursor.execute(
                "INSERT IGNORE INTO blocked_keywords (client_id, keyword) VALUES (%s, %s)",
                (data.client_id, data.keyword.strip())
            )
            db.commit()
    return {"status": "success"}

@app.delete("/blocked-keywords/{client_id}/{keyword}")
def remove_blocked_keyword(client_id: str, keyword: str, user: dict = Depends(get_current_user)):
    require_client_access(client_id, user)
    from app.db import get_db_ctx
    from app.keyword_filter import _ensure_table
    with get_db_ctx() as db:
        with db.cursor() as cursor:
            _ensure_table(cursor)
            cursor.execute("DELETE FROM blocked_keywords WHERE client_id=%s AND keyword=%s", (client_id, keyword))
            db.commit()
    return {"status": "success"}

@app.get("/blocked-keywords/{client_id}")
def list_blocked_keywords(client_id: str, user: dict = Depends(get_current_user)):
    require_client_access(client_id, user)
    from app.db import get_db_ctx
    from app.keyword_filter import get_blocked_keywords
    with get_db_ctx() as db:
        with db.cursor() as cursor:
            return {"keywords": get_blocked_keywords(cursor, client_id)}



class ReplyBlockedPolicyRequest(BaseModel):
    client_id: str
    action: str   # 'reply' (manual review) or 'ignore'

@app.post("/blocked-keywords/policy")
def set_block_policy(data: ReplyBlockedPolicyRequest, user: dict = Depends(get_current_user)):
    require_client_access(data.client_id, user)
    if data.action not in ("reply", "ignore"):
        raise HTTPException(status_code=400, detail="action must be 'reply' or 'ignore'")

    from app.db import get_db_ctx
    from app.keyword_filter import _ensure_policy_table
    with get_db_ctx() as db:
        with db.cursor() as cursor:
            _ensure_policy_table(cursor)
            cursor.execute("""
                INSERT INTO keyword_block_policy (client_id, action)
                VALUES (%s, %s)
                ON DUPLICATE KEY UPDATE action=VALUES(action)
            """, (data.client_id, data.action))
            db.commit()
    return {"status": "success"}

@app.get("/blocked-keywords/policy/{client_id}")
def get_block_policy_endpoint(client_id: str, user: dict = Depends(get_current_user)):
    require_client_access(client_id, user)
    from app.db import get_db_ctx
    from app.keyword_filter import get_block_policy
    with get_db_ctx() as db:
        with db.cursor() as cursor:
            return {"action": get_block_policy(cursor, client_id)}




class UpdateBlockedEmailStatusRequest(BaseModel):
    status: str  # 'ignored' or 'replied'

@app.get("/blocked-emails/{client_id}")
def list_blocked_emails(
    client_id: str,
    status: str = None,
    user: dict = Depends(get_current_user)
):
    require_client_access(client_id, user)
    from app.db import get_db_ctx
    from app.keyword_filter import _ensure_reply_blocked_table
    with get_db_ctx() as db:
        with db.cursor() as cursor:
            _ensure_reply_blocked_table(cursor)
            if status:
                cursor.execute("""
                    SELECT id, from_email, subject, body, matched_keyword, status, created_at
                    FROM reply_blocked_by_keyword
                    WHERE client_id = %s AND status = %s
                    ORDER BY created_at DESC
                """, (client_id, status))
            else:
                cursor.execute("""
                    SELECT id, from_email, subject, body, matched_keyword, status, created_at
                    FROM reply_blocked_by_keyword
                    WHERE client_id = %s
                    ORDER BY created_at DESC
                """, (client_id,))
            rows = cursor.fetchall()
    return [
        {
            "id": r[0],
            "from_email": r[1],
            "subject": r[2],
            "body": r[3],
            "matched_keyword": r[4],
            "status": r[5],
            "created_at": r[6].strftime("%Y-%m-%d %H:%M:%S") if r[6] else ""
        }
        for r in rows
    ]


@app.patch("/blocked-emails/{client_id}/{record_id}")
def update_blocked_email_status(
    client_id: str,
    record_id: int,
    data: UpdateBlockedEmailStatusRequest,
    user: dict = Depends(get_current_user)
):
    require_client_access(client_id, user)
    if data.status not in ("ignored", "replied"):
        raise HTTPException(status_code=400, detail="status must be 'ignored' or 'replied'")
    from app.db import get_db_ctx
    with get_db_ctx() as db:
        with db.cursor() as cursor:
            cursor.execute("""
                UPDATE reply_blocked_by_keyword
                SET status = %s
                WHERE id = %s AND client_id = %s
            """, (data.status, record_id, client_id))
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Record not found")
            db.commit()
    return {"status": "success"}


@app.patch("/blocked-emails/{client_id}/bulk-ignore")
def bulk_ignore_blocked_emails(
    client_id: str,
    user: dict = Depends(get_current_user)
):
    """Marks all pending_review rows as ignored for this client."""
    require_client_access(client_id, user)
    from app.db import get_db_ctx
    with get_db_ctx() as db:
        with db.cursor() as cursor:
            cursor.execute("""
                UPDATE reply_blocked_by_keyword
                SET status = 'ignored'
                WHERE client_id = %s AND status = 'pending_review'
            """, (client_id,))
            affected = cursor.rowcount
            db.commit()
    return {"status": "success", "rows_updated": affected}
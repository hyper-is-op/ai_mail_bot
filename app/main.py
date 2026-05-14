from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, EmailStr, field_validator
from worker.tasks import process_email_task
from app.email_credential import save_email_account, get_email_account, create_email_record_db
from app.order_routes import get_order_by_id
from enum import Enum

app = FastAPI()

class EmailRequest(BaseModel):
    from_email: str
    subject: str
    body: str

@app.get("/")
def home():
    return {"status": "mail_ai_automation running"}

@app.post("/process-email")
def process_email(data: EmailRequest):
    process_email_task.delay(data.dict())
    return {"status": "queued"}


# following by hyper_is_op

class AcceptEmailRequest(BaseModel):
    user_id: int
    email: EmailStr
    password: str

    @field_validator("password")
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

class OrderStatusRequest(BaseModel):
    order_id: str

class EmailStatus(str, Enum):
    done_replied     = "Done_Replied"
    ticket_generated = "Ticket_Generated"

class EmailRecordRequest(BaseModel):
    user_id: int
    mail_id: str
    subject: str
    body: str
    status: EmailStatus

    model_config = {"use_enum_values": True}


@app.post("/accept-email")
def accept_email(data: AcceptEmailRequest):
    try:
        save_email_account(data.user_id, data.email, data.password)
        return {"status": "saved", "user_id": data.user_id, "email": data.email}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")
        
        
@app.get("/email-account/{user_id}")
def get_email_account_by_id(user_id: int):
    try:
        account = get_email_account(user_id)
        if not account:
            raise HTTPException(status_code=404, detail=f"No account found for user_id {user_id}")
        return account
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/create-ticket", status_code=201)
def create_ticket(data: EmailRecordRequest):
    """
    Receives and stores an email record as a support ticket.
    status must be exactly 'Done_Replied' or 'Ticket_Generated'.
    """
    result = create_email_record_db(data.dict())
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return {
        "message": "Ticket created successfully",
        "ticket_id": result["ticket_id"],
        "user_id":result["user_id"],
        "mail_id":result["mail_id"],
        "status": data.status,
    }


@app.post("/order-status")
def order_status(data: OrderStatusRequest):
    try:
        order = get_order_by_id(data.order_id)

        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        return {
            "status": "success",
            "data": order
        }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")

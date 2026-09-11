from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
import re
from app.text_cleaning import extract_clean_text_from_html, is_html_content


@dataclass
class PipelineContext:
    task_id: str
    client_id: str
    from_email: str
    subject: str
    body: str
    body_html: Optional[str] = None
    body_raw: str = ""
    message_id: Optional[str] = None
    mail_id: Optional[str] = None
    in_reply_to: Optional[str] = None
    sender_name: Optional[str] = None

    # Configuration toggles
    features: Dict[str, Any] = field(default_factory=dict)

    # Classification & Routing
    intent: Optional[str] = None
    sentiment: str = "Neutral"
    priority: str = "Medium"
    ticket_id: Optional[str] = None
    order_id: Optional[str] = None
    extracted_tickets: List[str] = field(default_factory=list)

    # Context & RAG
    rag_id: Optional[str] = None
    context_text: str = ""
    context_data: Dict[str, Any] = field(default_factory=dict)
    history: List[Dict[str, Any]] = field(default_factory=list)
    active_state_name: Optional[str] = None

    # Response & Evaluation
    draft_reply: Optional[str] = None
    score: int = 0
    status: str = "processing"
    summary: Optional[str] = None
    execution_steps: List[str] = field(default_factory=lambda: ["Start"])

    # Control Flow
    halted: bool = False
    halt_reason: Optional[str] = None
    response_action: Optional[str] = None  # e.g., 'auto_send', 'create_ticket', 'draft_created'

    @classmethod
    def from_task_data(cls, task_id: str, data: Dict[str, Any]) -> "PipelineContext":
        client_id = data.get("client_id", "SYSTEM") or "SYSTEM"
        from_email = data.get("from_email", "") or ""
        raw_subject = (data.get("subject") or "").strip()
        body_text = data.get("body", "") or ""
        body_html = data.get("body_html", "") or None

        # Clean HTML if present
        if is_html_content(body_text):
            if not body_html:
                body_html = body_text
            body_text = extract_clean_text_from_html(body_text)

        # Normalize subject if missing or blank placeholder
        if not raw_subject or raw_subject.lower() in ("(no subject)", "no subject", "none", "null"):
            first_line = body_text.strip().split("\n")[0].strip() if body_text.strip() else ""
            clean_first = re.sub(r'[\r\n\t]+', ' ', first_line)[:60].strip()
            raw_subject = clean_first if len(clean_first) >= 3 else "Support Request"

        return cls(
            task_id=task_id,
            client_id=client_id,
            from_email=from_email,
            subject=raw_subject,
            body=body_text,
            body_html=body_html,
            body_raw=data.get("body", "") or "",
            message_id=data.get("message_id"),
            mail_id=data.get("mail_id"),
            in_reply_to=data.get("in_reply_to"),
            sender_name=data.get("sender_name")
        )

    def to_task_data(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "client_id": self.client_id,
            "from_email": self.from_email,
            "subject": self.subject,
            "body": self.body,
            "body_html": self.body_html,
            "message_id": self.message_id,
            "mail_id": self.mail_id,
            "in_reply_to": self.in_reply_to,
            "sender_name": self.sender_name
        }

    def log_step(self, step_name: str):
        self.execution_steps.append(step_name)

    def halt(self, status: str, reason: str, log_step_name: Optional[str] = None):
        self.halted = True
        self.status = status
        self.halt_reason = reason
        if log_step_name:
            self.log_step(log_step_name)


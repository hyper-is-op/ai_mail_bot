import logging
from typing import Tuple, Optional, Dict, Any
from app.connector_config import run_order_status_lookup
from app.rag import query_rag, get_rag_id, query_knowledge

logger = logging.getLogger(__name__)

VERIFICATION_STATES = {"pending_verification", "verification_failed"}


def tpl_please_verify(ticket_id: str, customer_name: str = "Customer") -> str:
    return (
        f"Hi {customer_name},\n\n"
        f"Thank you for reaching out. We received your query regarding ticket "
        f"**{ticket_id}**, but we were unable to locate this ID in our system.\n\n"
        f"Could you please double-check the ticket ID and confirm it in your reply? "
        f"If you have a reference email or screenshot, feel free to attach it.\n\n"
        f"Thanks & Regards,\n"
        f"Support Team"
    )


def tpl_verification_failed(customer_name: str = "Customer") -> str:
    return (
        f"Hi {customer_name},\n\n"
        f"We were still unable to locate the ticket ID in our system after verification.\n\n"
        f"No worries — please describe your issue in your next reply and we will raise a "
        f"fresh support ticket on your behalf right away.\n\n"
        f"Thanks & Regards,\n"
        f"Support Team"
    )


def fetch_crm_ticket_status(
    client_id: str,
    ticket_id: str,
    body: str = "",
    history: list = None,
    subject: str = "",
    from_email: str = ""
) -> Dict[str, Any]:
    """
    Queries external CRM for ticket status using the Dynamic Connector System.
    """
    logger.info(f"🔍 Looking up CRM status for ticket #{ticket_id} (Client: {client_id})")
    try:
        res = run_order_status_lookup(
            client_id=client_id,
            ticket_id=ticket_id,
            body=body or "",
            history=history or [],
            subject=subject or "",
            from_email=from_email or ""
        )
        return res
    except Exception as e:
        logger.error(f"❌ Error during CRM status lookup: {e}")
        return {"success": False, "error": str(e)}


def fetch_rag_context(client_id: str, query: str, rag_id: Optional[str] = None) -> Tuple[str, bool, Optional[str]]:
    """
    Retrieves relevant knowledge base chunks via Qdrant/Chroma vector store.
    Returns (context_text, success_bool, rag_id).
    """
    if not rag_id:
        rag_id = get_rag_id(client_id)

    context = ""
    try:
        if rag_id:
            rag_res = query_rag(rag_id, query)
            context = rag_res.get("answer", "")
        else:
            # Fallback direct knowledge query
            rag_res = query_knowledge(query, client_id, top_k=3)
            context = rag_res.get("context", "") if isinstance(rag_res, dict) else str(rag_res)

        succeeded = bool(context and "No context found" not in context)
        return context, succeeded, rag_id
    except Exception as e:
        logger.warning(f"⚠️ RAG retrieval failed: {e}")
        return "", False, rag_id

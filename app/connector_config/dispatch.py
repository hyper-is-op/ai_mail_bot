import logging
from typing import Optional, List, Dict, Any

from app.db import get_db

logger = logging.getLogger(__name__)


def get_live_config(client_id: str, trigger_type: str) -> Optional[dict]:
    """
    Fetches the live connector_configs row for (client_id, trigger_type),
    or None if none exists. Callers (worker/tasks.py) must treat None
    the same as get_order_status's {"success": False} — fall to the
    existing verification/ticket-creation fallback path, never raise.
    """
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT url, http_method, headers_template, request_template,
                       response_mapping, auth_type, auth_secret_encrypted,
                       auth_field_name, payload_encoding, base64_query_param_name,
                       trigger_type
                FROM connector_configs
                WHERE client_id=%s AND trigger_type=%s AND status='live'
                LIMIT 1
            """, (client_id, trigger_type))
            row = cursor.fetchone()
            if row is None:
                return None
            return {
                "client_id": client_id,
                "url": row[0], "http_method": row[1], "headers_template": row[2],
                "request_template": row[3], "response_mapping": row[4],
                "auth_type": row[5], "auth_secret_encrypted": row[6],
                "auth_field_name": row[7], "payload_encoding": row[8],
                "base64_query_param_name": row[9],
                "trigger_type": row[10],
            }
    finally:
        conn.close()


def run_ticket_create(
    client_id: str,
    from_email: str,
    subject: str,
    body: str,
    history: list,
    status: str = "Ticket_Generated",
    old_summary: str = "",
    intent: str = "general_query",
    sentiment: str = "Neutral",
    priority: str = "Medium",
) -> dict:
    """
    Drop-in replacement for app.request_handler.call_create_ticket's core
    API-call responsibility. Matches call_create_ticket's return shape:
    {"success": bool, "ticket_id": str|None, ...extra CRM-returned fields}.
    """
    from app.context_data import build_context_data_base
    from app.connector_executor import execute_connector
    from app.utils import normalize_subject

    config = get_live_config(client_id, "ticket_create")
    if config is None:
        return {"success": False, "ticket_id": None, "error": f"No live ticket_create connector config for client_id={client_id}"}

    clean_sub = normalize_subject(subject, body)

    context_base = build_context_data_base(
        client_id=client_id, from_email=from_email, subject=clean_sub,
        body=body, cleaned_body=body, ticket_id=None,
        intent=intent, sentiment=sentiment, priority=priority,
        history=history,
    )

    result = execute_connector(config, context_base, body=body, history=history, old_summary=old_summary)
    if not result.get("success"):
        return {"success": False, "ticket_id": None, "error": result.get("error", "Unknown executor failure")}

    mapped = result["data"]
    reserved_keys = {"success", "ticket_id", "message"}
    collision = reserved_keys & mapped.keys() - {"ticket_id"}  # ticket_id collision is expected/harmless
    if collision:
        logger.warning(
            f"⚠️ response_mapping for ticket_create produced reserved field name(s) "
            f"{collision} — these will be silently overwritten by run_ticket_create's "
            f"own return contract. Rename these fields in response_mapping to avoid confusion."
        )
    return {
        "success": True,
        "ticket_id": mapped.get("ticket_id"),
        "message": "Ticket created successfully",
        **{k: v for k, v in mapped.items() if k not in ("success", "message")},
    }


def run_order_status_lookup(
    client_id: str,
    ticket_id: str,
    body: str,
    history: list,
    subject: str = "",
    from_email: str = "",
    old_summary: str = "",
    intent: str = "ticket_status",
    sentiment: str = "Neutral",
    priority: str = "Medium",
) -> dict:
    """
    Drop-in replacement for app.request_handler.get_order_status.
    Seamlessly supports both ticket_status (e.g. Zoho Desk) and
    order_status (e.g. Shopify) connectors. If both are active, it queries
    the most relevant one first and falls back to the other.
    """
    from app.context_data import build_context_data_base
    from app.connector_executor import execute_connector

    cfg_ticket = get_live_config(client_id, "ticket_status")
    cfg_order = get_live_config(client_id, "order_status")

    # Determine which connector applies based on inquiry content & ID format
    text_corpus = f"{subject} {body}".lower()
    is_order_inquiry = any(w in text_corpus for w in ("order", "ship", "shipped", "shipping", "deliver", "delivery", "track", "tracking", "package", "item", "purchase"))
    is_ticket_inquiry = any(w in text_corpus for w in ("ticket", "case", "complaint", "issue", "billing", "escalat"))

    ticket_str = str(ticket_id or "").strip()
    looks_like_crm_ticket = len(ticket_str) > 8 or ticket_str.upper().startswith(("T-", "INC", "CAS", "SR", "REQ"))

    selected_config = None
    if cfg_ticket and cfg_order:
        if is_order_inquiry and not is_ticket_inquiry:
            selected_config = cfg_order
        elif is_ticket_inquiry and not is_order_inquiry:
            selected_config = cfg_ticket
        elif looks_like_crm_ticket:
            selected_config = cfg_ticket
        else:
            selected_config = cfg_order
    elif cfg_ticket:
        selected_config = cfg_ticket
    elif cfg_order:
        selected_config = cfg_order
    else:
        return {"success": False, "error": f"No live ticket_status or order_status connector config for client_id={client_id}"}

    context_base = build_context_data_base(
        client_id=client_id, from_email=from_email, subject=subject,
        body=body, cleaned_body=body, ticket_id=ticket_id,
        intent=intent, sentiment=sentiment, priority=priority,
        history=history,
    )

    result = execute_connector(selected_config, context_base, body=body, history=history, old_summary=old_summary)
    if not result.get("success"):
        return {"success": False, "error": result.get("error", "Unknown executor failure")}

    data = result.get("data", {})
    has_record = any(data.get(k) for k in ("docket_no", "ticket_status", "ticket_id"))

    # If an e-commerce order (like Shopify) wasn't found with plain '1001', retry with '%231001' (#1001)
    if not has_record and selected_config.get("trigger_type") == "order_status" and ticket_id and not str(ticket_id).startswith("#"):
        context_base_hash = dict(context_base)
        context_base_hash["ticket_id"] = f"%23{ticket_id}"
        result_hash = execute_connector(selected_config, context_base_hash, body=body, history=history, old_summary=old_summary)
        if result_hash.get("success"):
            data_hash = result_hash.get("data", {})
            if any(data_hash.get(k) for k in ("docket_no", "ticket_status", "ticket_id")):
                return {"success": True, "data": data_hash}

    if not has_record:
        return {"success": False, "error": f"No matching record found in {selected_config.get('trigger_type')} system response"}

    return {"success": True, "data": data}

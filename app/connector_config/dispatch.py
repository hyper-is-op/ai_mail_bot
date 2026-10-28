import re
import logging
from typing import Optional, List, Dict, Any

from app.db import get_db

logger = logging.getLogger(__name__)


def check_connector_rate_limit(client_id: str, from_email: str, max_calls: int = 5, window_seconds: int = 600) -> bool:
    """
    Sliding window rate limit check for connector execution per (client_id, from_email).
    Returns True if allowed, False if limit exceeded.
    """
    if not from_email or not client_id:
        return True
    try:
        from app.redis_pool import get_redis_main
        r = get_redis_main()
        key = f"rate_limit:connector:{client_id}:{from_email.lower().strip()}"
        current = r.incr(key)
        if current == 1:
            r.expire(key, window_seconds)
        if current > max_calls:
            logger.warning(f"⚠️ Connector rate limit exceeded for {from_email} (client={client_id}, calls={current}/{max_calls})")
            return False
        return True
    except Exception as e:
        logger.error(f"❌ Redis rate limit error, allowing by default: {e}")
        return True


def redact_sensitive_pii(data: dict) -> dict:
    """
    Masks sensitive PII in connector response when email ownership is unverified.
    """
    if not isinstance(data, dict):
        return data
    redacted = dict(data)
    sensitive_keys = (
        "email", "customer_email", "phone", "mobile", "address", "shipping_address",
        "billing_address", "recipient", "customer_name", "tracking_url", "name"
    )
    for k, v in list(redacted.items()):
        lower_k = k.lower()
        if any(s in lower_k for s in sensitive_keys) and isinstance(v, str) and v.strip():
            if len(v) <= 4:
                redacted[k] = "***"
            else:
                redacted[k] = f"{v[:2]}***{v[-2:]}"
    return redacted


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
                       trigger_type, id_pattern_regex, owner_email_path
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
                "id_pattern_regex": row[11] if len(row) > 11 else None,
                "owner_email_path": row[12] if len(row) > 12 else None,
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
    thread_id: str = "",
    customer_name: Optional[str] = None,
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
        history=history, thread_id=thread_id,
        customer_name=customer_name,
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


def run_payment_status_lookup(
    client_id: str,
    payment_id: str = "",
    order_id: str = "",
    body: str = "",
    history: list = None,
    subject: str = "",
    from_email: str = "",
    old_summary: str = "",
    intent: str = "payment_status",
    sentiment: str = "Neutral",
    priority: str = "Medium",
) -> dict:
    """
    Executes real-time payment status lookup against payment gateways
    (e.g., Stripe, Razorpay, Shopify Payments, Zoho Books).
    """
    from app.context_data import build_context_data_base
    from app.connector_executor import execute_connector

    cfg_payment = get_live_config(client_id, "payment_status")
    if not cfg_payment:
        return {
            "success": False,
            "error": f"No live payment_status connector config found for client_id={client_id}"
        }

    ref = str(payment_id or order_id or "").strip()
    clean_ref = ref.lstrip("#")
    id_pattern = cfg_payment.get("id_pattern_regex")
    if id_pattern:
        try:
            compiled = re.compile(id_pattern, re.IGNORECASE)
            if not compiled.search(ref) and not compiled.search(clean_ref):
                return {
                    "success": False,
                    "invalid_format": True,
                    "not_found": True,
                    "error": f"Payment reference '{ref}' does not match expected format pattern."
                }
        except Exception as re_err:
            logger.warning(f"⚠️ Invalid id_pattern_regex '{id_pattern}' for client_id={client_id}: {re_err}")

    if from_email and not check_connector_rate_limit(client_id, from_email):
        return {
            "success": False,
            "rate_limited": True,
            "error": "Connector rate limit exceeded (max 5 lookups per 10 minutes). Held for review."
        }

    context_base = build_context_data_base(
        client_id=client_id,
        from_email=from_email,
        subject=subject,
        body=body,
        cleaned_body=body,
        ticket_id=ref,
        order_id=order_id or ref,
        payment_id=payment_id or ref,
        reference_id=ref,
        intent=intent,
        sentiment=sentiment,
        priority=priority,
        history=history or [],
    )

    result = execute_connector(cfg_payment, context_base, body=body, history=history or [], old_summary=old_summary)
    if not result.get("success"):
        return {
            "success": False,
            "not_found": bool(result.get("not_found")),
            "invalid_format": bool(result.get("invalid_format")),
            "upstream_outage": bool(result.get("upstream_outage")),
            "status_code": result.get("status_code"),
            "error": result.get("error", "Unknown payment connector failure")
        }

    data = result.get("data", {})
    has_record = any(data.get(k) for k in ("payment_status", "status", "transaction_id", "amount", "id"))
    if not has_record:
        return {"success": False, "not_found": True, "error": f"No matching payment record found for reference '{ref}'"}

    owner_email = result.get("owner_email")
    ownership_verified = True
    if owner_email and from_email:
        if from_email.strip().lower() != owner_email.strip().lower():
            logger.warning(f"🔒 BOLA ownership mismatch for payment '{ref}': from={from_email} vs record_owner={owner_email}")
            ownership_verified = False
            data = redact_sensitive_pii(data)

    return {"success": True, "data": data, "ownership_verified": ownership_verified}


def run_ticket_status_lookup(
    client_id: str,
    ticket_id: str,
    body: str = "",
    history: list = None,
    subject: str = "",
    from_email: str = "",
    old_summary: str = "",
    intent: str = "ticket_status",
    sentiment: str = "Neutral",
    priority: str = "Medium",
) -> dict:
    """
    Specifically queries CRM ticket_status connectors (e.g. Zoho Desk, Freshdesk, Zendesk).
    """
    from app.context_data import build_context_data_base
    from app.connector_executor import execute_connector

    cfg_ticket = get_live_config(client_id, "ticket_status")
    if not cfg_ticket:
        # Fallback to order_status if client configured it under order_status
        cfg_ticket = get_live_config(client_id, "order_status")

    if not cfg_ticket:
        return {"success": False, "error": f"No live ticket_status connector config for client_id={client_id}"}

    if from_email and not check_connector_rate_limit(client_id, from_email):
        return {
            "success": False,
            "rate_limited": True,
            "error": "Connector rate limit exceeded (max 5 lookups per 10 minutes). Held for review."
        }

    clean_ticket_id = str(ticket_id or "").strip().lstrip("#")
    raw_ticket_id = str(ticket_id or "").strip()
    id_pattern = cfg_ticket.get("id_pattern_regex")
    if id_pattern:
        try:
            compiled = re.compile(id_pattern, re.IGNORECASE)
            if not compiled.search(raw_ticket_id) and not compiled.search(clean_ticket_id):
                return {
                    "success": False,
                    "invalid_format": True,
                    "not_found": True,
                    "error": f"Ticket reference '{raw_ticket_id}' does not match expected format pattern."
                }
        except Exception as re_err:
            logger.warning(f"⚠️ Invalid id_pattern_regex '{id_pattern}' for client_id={client_id}: {re_err}")

    context_base = build_context_data_base(
        client_id=client_id, from_email=from_email, subject=subject,
        body=body, cleaned_body=body, ticket_id=clean_ticket_id,
        order_id=clean_ticket_id, reference_id=clean_ticket_id,
        intent=intent, sentiment=sentiment, priority=priority,
        history=history or [],
    )

    result = execute_connector(cfg_ticket, context_base, body=body, history=history or [], old_summary=old_summary)
    if not result.get("success"):
        return {
            "success": False,
            "not_found": bool(result.get("not_found")),
            "invalid_format": bool(result.get("invalid_format")),
            "upstream_outage": bool(result.get("upstream_outage")),
            "status_code": result.get("status_code"),
            "error": result.get("error", "Unknown executor failure")
        }

    data = result.get("data", {})
    has_record = any(data.get(k) for k in ("docket_no", "ticket_status", "ticket_id", "status"))
    if not has_record:
        return {"success": False, "not_found": True, "error": f"No matching ticket record found for '{ticket_id}'"}

    owner_email = result.get("owner_email")
    ownership_verified = True
    if owner_email and from_email:
        if from_email.strip().lower() != owner_email.strip().lower():
            logger.warning(f"🔒 BOLA ownership mismatch for ticket '{ticket_id}': from={from_email} vs record_owner={owner_email}")
            ownership_verified = False
            data = redact_sensitive_pii(data)

    return {"success": True, "data": data, "ownership_verified": ownership_verified}


def run_order_status_lookup(
    client_id: str,
    ticket_id: str = "",
    body: str = "",
    history: list = None,
    subject: str = "",
    from_email: str = "",
    old_summary: str = "",
    intent: str = "order_status",
    sentiment: str = "Neutral",
    priority: str = "Medium",
    order_id: str = "",
) -> dict:
    """
    Queries e-commerce/ERP order_status connectors (e.g. Shopify, Magento, ERP).
    """
    from app.context_data import build_context_data_base
    from app.connector_executor import execute_connector

    clean_order_id = str(order_id or ticket_id or "").strip()
    clean_ref = clean_order_id.lstrip("#")

    cfg_order = get_live_config(client_id, "order_status")
    cfg_ticket = get_live_config(client_id, "ticket_status")
    selected_config = cfg_order or cfg_ticket

    if not selected_config:
        return {"success": False, "error": f"No live order_status connector config for client_id={client_id}"}

    id_pattern = selected_config.get("id_pattern_regex")
    if id_pattern:
        try:
            compiled = re.compile(id_pattern, re.IGNORECASE)
            if not compiled.search(clean_order_id) and not compiled.search(clean_ref):
                return {
                    "success": False,
                    "invalid_format": True,
                    "not_found": True,
                    "error": f"Order reference '{clean_order_id}' does not match expected format pattern."
                }
        except Exception as re_err:
            logger.warning(f"⚠️ Invalid id_pattern_regex '{id_pattern}' for client_id={client_id}: {re_err}")

    if from_email and not check_connector_rate_limit(client_id, from_email):
        return {
            "success": False,
            "rate_limited": True,
            "error": "Connector rate limit exceeded (max 5 lookups per 10 minutes). Held for review."
        }

    context_base = build_context_data_base(
        client_id=client_id, from_email=from_email, subject=subject,
        body=body, cleaned_body=body, ticket_id=clean_order_id,
        order_id=clean_order_id, reference_id=clean_order_id,
        intent=intent, sentiment=sentiment, priority=priority,
        history=history or [],
    )

    result = execute_connector(selected_config, context_base, body=body, history=history or [], old_summary=old_summary)
    if not result.get("success"):
        return {
            "success": False,
            "not_found": bool(result.get("not_found")),
            "invalid_format": bool(result.get("invalid_format")),
            "upstream_outage": bool(result.get("upstream_outage")),
            "status_code": result.get("status_code"),
            "error": result.get("error", "Unknown executor failure")
        }

    data = result.get("data", {})
    has_record = any(data.get(k) for k in ("docket_no", "ticket_status", "ticket_id", "status", "order_id"))

    # If an e-commerce order (like Shopify) wasn't found with plain '1001', retry with '%231001' (#1001)
    if not has_record and selected_config.get("trigger_type") == "order_status" and clean_order_id and not clean_order_id.startswith("#"):
        context_base_hash = dict(context_base)
        context_base_hash["ticket_id"] = f"%23{clean_order_id}"
        context_base_hash["order_id"] = f"%23{clean_order_id}"
        result_hash = execute_connector(selected_config, context_base_hash, body=body, history=history or [], old_summary=old_summary)
        if result_hash.get("success"):
            data_hash = result_hash.get("data", {})
            if any(data_hash.get(k) for k in ("docket_no", "ticket_status", "ticket_id", "status", "order_id")):
                owner_email = result_hash.get("owner_email")
                ownership_verified = True
                if owner_email and from_email:
                    if from_email.strip().lower() != owner_email.strip().lower():
                        logger.warning(f"🔒 BOLA ownership mismatch for order '{clean_order_id}': from={from_email} vs record_owner={owner_email}")
                        ownership_verified = False
                        data_hash = redact_sensitive_pii(data_hash)
                return {"success": True, "data": data_hash, "ownership_verified": ownership_verified}

    if not has_record:
        return {
            "success": False,
            "not_found": True,
            "error": f"No matching record found for '{clean_order_id}' in {selected_config.get('trigger_type')} system response"
        }

    owner_email = result.get("owner_email")
    ownership_verified = True
    if owner_email and from_email:
        if from_email.strip().lower() != owner_email.strip().lower():
            logger.warning(f"🔒 BOLA ownership mismatch for order '{clean_order_id}': from={from_email} vs record_owner={owner_email}")
            ownership_verified = False
            data = redact_sensitive_pii(data)

    return {"success": True, "data": data, "ownership_verified": ownership_verified}

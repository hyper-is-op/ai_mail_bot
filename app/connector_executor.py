"""
app/connector_executor.py

Generic executor for connector_configs: render request_template from
context_data → fire HTTP request → apply response_mapping → return a
result shaped like get_order_status()'s existing {"success", "data"/"error"}
contract, so worker/tasks.py's PATH A/B/C branches don't need restructuring.

Zero per-trigger_type Python here — trigger_type is only used by the
caller to look up which config row to pass in.

Caller contract: `config` must be a dict containing ALL columns needed
for execution — url, http_method, headers_template, request_template,
response_mapping, auth_type, auth_secret_encrypted, auth_field_name,
payload_encoding, base64_query_param_name. This is a separate, full
fetch from whatever narrow SELECT swap_to_live/activate_first_live do
for approval-time validation — those two are unrelated read paths
against the same table.
"""

import base64
import json
import logging
import re
import requests
import jmespath

from app.context_data import CONTEXT_DATA_KEYS, resolve_expensive_keys
from app.url_allowlist import is_url_allowed
from app.secrets_crypto import decrypt_secret

logger = logging.getLogger(__name__)

_PLACEHOLDER_RE = re.compile(r"\{\{(\w+)\}\}")
REQUEST_TIMEOUT_SECONDS = 10


class ExecutorError(Exception):
    """
    Base class for all executor failures. worker/tasks.py should catch
    this (or its subclasses) and fall to manual review — same degraded
    path as 'no config exists yet', per the spec's explicit requirement
    that a zero-live-config or executor failure never propagates as an
    unhandled exception.
    """
    pass


class TemplateRenderError(ExecutorError):
    """Placeholder references an unknown key, or a referenced key's value is missing/None."""
    pass


class ExecutorAllowlistError(ExecutorError):
    """URL failed the execution-time allowlist re-check."""
    pass


def _find_placeholders(template_json: str | None) -> set:
    if not template_json:
        return set()
    return set(_PLACEHOLDER_RE.findall(template_json))


def _render_template(template_json: str | None, context: dict) -> dict | None:
    """
    Substitutes {{key}} placeholders in template_json with JSON-escaped
    values from context, returns the parsed dict. Fails loudly on any
    unknown or missing/None placeholder.
    """
    if not template_json:
        return None

    def _replace(match):
        key = match.group(1)
        if key not in CONTEXT_DATA_KEYS:
            raise TemplateRenderError(
                f"Template references unknown placeholder '{{{{{key}}}}}' — "
                f"not in context_data schema."
            )
        if key not in context or context[key] is None:
            raise TemplateRenderError(
                f"Template placeholder '{{{{{key}}}}}' has no value in this "
                f"email's context (missing or None) — cannot render."
            )
        escaped = json.dumps(str(context[key]))[1:-1]
        return escaped

    rendered_str = _PLACEHOLDER_RE.sub(_replace, template_json)
    try:
        return json.loads(rendered_str)
    except json.JSONDecodeError as e:
        raise TemplateRenderError(
            f"Rendered template is not valid JSON: {e}. Rendered string: {rendered_str[:500]}"
        ) from e


def _apply_auth(request_kwargs: dict, auth_type: str, secret: str, auth_field_name: str | None) -> None:
    if auth_type == "bearer":
        request_kwargs.setdefault("headers", {})["Authorization"] = f"Bearer {secret}"
    elif auth_type == "basic":
        creds = json.loads(secret)
        request_kwargs["auth"] = (creds["username"], creds["password"])
    elif auth_type == "api_key_header":
        if not auth_field_name:
            raise ExecutorError("auth_type=api_key_header requires auth_field_name")
        request_kwargs.setdefault("headers", {})[auth_field_name] = secret
    elif auth_type == "api_key_query":
        if not auth_field_name:
            raise ExecutorError("auth_type=api_key_query requires auth_field_name")
        request_kwargs.setdefault("params", {})[auth_field_name] = secret
    else:
        raise ExecutorError(f"Unknown auth_type: {auth_type}")


def _apply_response_mapping(response_json: dict, response_mapping) -> dict:
    """
    response_mapping: raw JSON string from the DB column (pymysql returns
    JSON columns as str, confirmed by direct test), or None, or already
    a dict if a caller passes one directly (defensive — accept both).
    """
    if response_mapping is None:
        return response_json

    if isinstance(response_mapping, str):
        try:
            response_mapping = json.loads(response_mapping)
        except json.JSONDecodeError as e:
            logger.error(f"❌ response_mapping is not valid JSON: {e}")
            return response_json

    if "fields" not in response_mapping:
        return response_json

    if response_mapping.get("pagination", {}).get("enabled"):
        logger.warning(
            "⚠️ response_mapping.pagination.enabled=True but pagination is NOT "
            "implemented in this executor — ignoring pagination config, "
            "returning only the first page's mapped fields. Per spec, "
            "pagination is scaffolded/unvalidated and must not be trusted "
            "until tested against a real integration."
        )

    result = {}
    for field_spec in response_mapping["fields"]:
        field_name = field_spec["field"]
        path = field_spec.get("path")
        extract_regex = field_spec.get("extract_regex")

        value = None
        if path:
            try:
                value = jmespath.search(path, response_json)
            except Exception as e:
                logger.warning(f"⚠️ JMESPath extraction failed for field={field_name} path={path}: {e}")
                value = None

        if extract_regex and isinstance(value, str):
            match = re.search(extract_regex, value)
            if match:
                value = match.group(0)
            else:
                logger.warning(
                    f"⚠️ extract_regex '{extract_regex}' did not match extracted "
                    f"value for field={field_name} — keeping raw JMESPath result"
                )

        result[field_name] = value

    return result

def execute_connector(
    config: dict,
    context_base: dict,
    body: str,
    history: list,
    old_summary: str = "",
) -> dict:
    """
    config: full row dict from connector_configs — url, http_method,
    headers_template, request_template, response_mapping, auth_type,
    auth_secret_encrypted, auth_field_name, payload_encoding,
    base64_query_param_name.

    context_base: output of build_context_data_base() — cheap fields only.

    Returns {"success": True, "data": {...}} or
            {"success": False, "error": str}
    — never raises to the caller.
    """
    try:
        request_template = config.get("request_template")
        headers_template = config.get("headers_template")

        needed = _find_placeholders(request_template) | _find_placeholders(headers_template)
        expensive_needed = needed & (CONTEXT_DATA_KEYS - context_base.keys())
        expensive_values = resolve_expensive_keys(expensive_needed, body, history, old_summary) if expensive_needed else {}

        full_context = {**context_base, **expensive_values}

        rendered_body = _render_template(request_template, full_context)
        rendered_headers = _render_template(headers_template, full_context) or {}

        url = config["url"]
        if not is_url_allowed(url):
            raise ExecutorAllowlistError(
                f"URL '{url}' failed execution-time allowlist re-check — "
                f"it may have been removed from the allowlist since this config was approved."
            )

        secret = decrypt_secret(config["auth_secret_encrypted"]) if config.get("auth_secret_encrypted") else None

        request_kwargs = {"headers": rendered_headers, "timeout": REQUEST_TIMEOUT_SECONDS}
        if secret:
            _apply_auth(request_kwargs, config["auth_type"], secret, config.get("auth_field_name"))

        payload_encoding = config.get("payload_encoding", "plain")
        http_method = config["http_method"].upper()

        if payload_encoding == "base64_query":
            param_name = config.get("base64_query_param_name")
            if not param_name:
                raise ExecutorError(
                    "payload_encoding='base64_query' but base64_query_param_name is not set — "
                    "this should have been caught at insert time; config is invalid."
                )
            encoded = base64.b64encode(json.dumps(rendered_body or {}).encode()).decode()
            request_kwargs.setdefault("params", {})[param_name] = encoded

            if http_method == "GET":
                response = requests.get(url, **request_kwargs)
            elif http_method == "POST":
                response = requests.post(url, **request_kwargs)  # payload is in query param, no json body
            else:
                raise ExecutorError(f"Unsupported http_method: {http_method}")

        elif payload_encoding == "plain":
            if http_method == "GET":
                request_kwargs.setdefault("params", {}).update(rendered_body or {})
                response = requests.get(url, **request_kwargs)
            elif http_method == "POST":
                response = requests.post(url, json=rendered_body, **request_kwargs)
            else:
                raise ExecutorError(f"Unsupported http_method: {http_method}")
        else:
            raise ExecutorError(f"Unknown payload_encoding: {payload_encoding}")

        response.raise_for_status()
        response_json = response.json()

        mapped = _apply_response_mapping(response_json, config.get("response_mapping"))
        return {"success": True, "data": mapped}

    except ExecutorError as e:
        logger.error(f"❌ Executor error: {e}")
        return {"success": False, "error": str(e)}
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Executor HTTP call failed: {e}")
        return {"success": False, "error": str(e)}
    except Exception as e:
        logger.error(f"❌ Executor unexpected failure: {e}", exc_info=True)
        return {"success": False, "error": str(e)}




REQUIRED_DISPLAY_LABELS = {
    "docket_no": "Ticket ID",
    "ticket_status": "Status",
    "ticket_id": "Ticket ID",
}


def format_mapped_data_for_prompt(mapped_data: dict) -> str:
    """
    Generic formatter for CRM response data going into an LLM prompt.
    Required fields (docket_no/ticket_status/ticket_id) get friendly
    labels if present; every other key present in mapped_data gets
    included generically as 'Key Name: value'. Missing optional fields
    are simply omitted — no 'N/A' padding, since an LLM writing a reply
    doesn't need to see placeholders for data a given CRM never provided.
    """
    lines = []
    for key, value in mapped_data.items():
        if value is None or value == "":
            continue
        label = REQUIRED_DISPLAY_LABELS.get(key, key.replace("_", " ").title())
        lines.append(f"{label}: {value}")
    return "\n".join(lines)
# Decisions - Step 163: Handle Malformed Ticket IDs

- **Pre-flight Regex vs CRM Round-trip**:
  - *Context*: Heterogeneous CRMs expect vastly different ID schemas (Zendesk expects integers, Zoho expects 18-digit dockets, Jira expects alphanumeric project keys).
  - *Choice*: Utilize existing `id_pattern_regex` configured on the connector to run pre-flight validation in `run_ticket_status_lookup`, `run_order_status_lookup`, and `run_payment_status_lookup`. If regex check fails, return immediately with `invalid_format: True, not_found: True` without making an unnecessary failing HTTP call.

- **Reclassification of HTTP 400 / 422 Client Errors**:
  - *Context*: When an ID is malformed, CRM APIs respond with 400 or 422 (not 404). Previously, `connector_executor` only flagged `not_found` on 404, causing 400/422 to trigger `CRM_Status_Lookup_Error` which told the agent an internal server crash occurred.
  - *Choice*: Flag `invalid_format: True` and `not_found: True` when HTTP status is 400 or 422 for single-entity lookups, keeping `upstream_outage` strictly for timeouts and 5xx responses, and preserving 401/403 as auth failures.

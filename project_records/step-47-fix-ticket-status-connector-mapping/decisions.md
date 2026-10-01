# Decisions: Step 47 - Fix Ticket Status Connector Mapping & Notification Budget Column

## Context
When a customer asked for the status of an existing ticket (`275424000000524001`), the agent called `lookup_ticket_status`, which dispatched an HTTP GET to Zoho Desk. The Zoho API responded 200 with the ticket object directly at root (`{'id': ..., 'ticketNumber': ..., 'status': ...}`). However, the client's `response_mapping` in `connector_configs` was configured as `data[0].ticketNumber` and `data[0].status`. Consequently, JMESPath extraction failed to extract any status, which triggered the hard-floor ticket escalation in `evaluator.py`, generating an unnecessary duplicate ticket `#155`.

## Decisions

### 1. Robust JMESPath Mapping in DB
- **Decision**: Update `connector_configs.response_mapping` for client `CLI-4159FFCF` and `ticket_status` to use resilient JMESPath fallback expressions:
  - `ticketNumber || data[0].ticketNumber` for `docket_no`
  - `status || data[0].status` for `ticket_status`
  - `subject || data[0].subject` for `subject`
  - `createdTime || data[0].createdTime` for `created_time`
- **Reasoning**: This handles both flat single-ticket responses (`GET /tickets/{id}`) and array-wrapped responses (`{"data": [...]}`) without failing if Zoho returns either format.

### 2. Fix Notification Budget Column Name in `analytics.py`
- **Decision**: Replace `monthly_budget` with `monthly_budget_usd` in `app/api/analytics.py`.
- **Reasoning**: The column was defined and migrated as `monthly_budget_usd` in `email_accounts`. Querying `monthly_budget` causes MySQL error 1054 on every periodic `/notifications/ALL` poll.

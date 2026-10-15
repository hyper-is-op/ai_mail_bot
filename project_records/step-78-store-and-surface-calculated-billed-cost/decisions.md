# Decisions: Store and Surface Calculated Billed Cost

## 1. Write-Time Snapshot vs Dynamic Recalculation
- **Context**: Billed cost needs to be accessible separately from raw upstream provider cost. The system can either snapshot billed cost at insert time using the tenant's active `cost_multiplier`, or dynamically recompute it on every query.
- **Decision**: Adopt write-time snapshotting into `llm_logs.billed_cost`.
- **Reasoning**: Write-time snapshotting preserves immutable financial and invoice audit trails: changes to `cost_multiplier` going forward will not distort historical billing records. Dynamic recalculation would unpredictably mutate past client spend figures upon setting updates.
- **Mitigation for Legacy Rows**: Backfill existing rows with `ROUND(cost * COALESCE(cost_multiplier, 1.0), 6)` and use `COALESCE(l.billed_cost, l.cost * COALESCE(ea.cost_multiplier, 1.0))` defensively across analytics queries.

## 2. Role-Based Cost Visibility
- **Context**: Non-admin clients should not see underlying provider margins.
- **Decision**: In `/reports` and `/analytics` endpoints, mask `raw_cost` for client roles, displaying only `billed_cost` as their authoritative cost. Expose both `raw_cost` and `billed_cost` (and computed margin) exclusively to `admin` role users.

# Step 78: Store and Surface Calculated Billed Cost

## 2026-10-08T16:12:00+05:30
- **Action**: Initialized step to store write-time snapshot `billed_cost` in `llm_logs`, backfill historical records, expose dual cost (raw vs billed) for admin, and mask raw cost for client accounts.

## 2026-10-08T16:28:00+05:30
- **Action**: Backfilled existing 619 rows in `llm_logs` with `ROUND(l.cost * COALESCE(ea.cost_multiplier, 1.0), 6)`.
- **Action**: Updated `app/llm_pricing.py` (`log_llm_metrics_db`) to look up client `cost_multiplier` snapshot on write and insert `billed_cost = round(cost * multiplier, 6)`.
- **Action**: Updated all SQL cost aggregations in `app/api/analytics.py` and `app/email_credential.py` to use `COALESCE(l.billed_cost, l.cost * COALESCE(ea.cost_multiplier, 1.0))`.
- **Action**: Updated `get_reports` and `export_ticketing_report_endpoint` in `app/api/analytics.py` to select both `raw_thread_cost` and `thread_cost`; role-gated `raw_cost` and `margin` so only admins receive them, while client users receive only `billed_cost` (as authoritative cost).
- **Action**: Updated `_build_report_conditions` to allow filtering/searching by both billed and raw cost thresholds.
- **Action**: Updated `frontend/src/pages/Reports.tsx` and `analytics.ts` interface: admins view dual micro-badges (`billed` vs `raw` with profit margin pill) in the Cost column, while regular client accounts view single clean formatted cost without margin exposure.
- **Action**: Verified live DB insertion with custom multiplier 1.5x in `mail_ai_api`, verified module imports, and verified production frontend compilation with `pnpm run build` (built in 9.89s).

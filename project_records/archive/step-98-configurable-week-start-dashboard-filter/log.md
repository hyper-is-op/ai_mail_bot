# Step 98: Configurable Week Start & This Week / Last Week Dashboard Filter

## Objective
1. Replace "Last 7 Days" with "This Week" and add "Last Week" to the Email Operations Dashboard and Ticketing Reports filter.
2. Add a configurable `week_start_day` setting ('monday' or 'sunday', default 'monday') in `email_accounts`.
3. Provide a configuration UI in General Settings for selecting Week Start Day (Monday vs Sunday).
4. Update analytics backend logic to dynamically calculate week boundaries based on the configured week start day.

## Execution Log
- 2026-10-11T21:02:40+05:30 - Initiated step-98 for configurable week start day and This Week / Last Week filters.
- 2026-10-11T21:03:02+05:30 - Added `week_start_day VARCHAR(10) DEFAULT 'monday'` column migration in `app/email_credential.py`.
- 2026-10-11T21:03:28+05:30 - Extended `POST /client/profile` endpoint in `app/api/settings/clients_admin.py` to validate and persist `week_start_day` ('monday' or 'sunday').
- 2026-10-11T21:08:42+05:30 - Updated `app/api/analytics.py` to resolve `week_start_day` per tenant and calculate `this_week` and `last_week` using dynamic MySQL `YEARWEEK(..., mode)` for `date_filter`, `chart_interval`, and `prior_interval`.
- 2026-10-11T21:10:15+05:30 - Updated `_build_report_conditions` in `app/api/analytics.py` for ticketing reports and CSV export to apply dynamic week boundaries.
- 2026-10-11T21:12:46+05:30 - Added Week Start Day selection cards to `GeneralTab.tsx` in Settings, allowing users to toggle between Monday (ISO) and Sunday (US).
- 2026-10-11T21:13:54+05:30 - Replaced "Last 7 Days" with "This Week" and added "Last Week" to filter bar in `frontend/src/pages/Dashboard.tsx` and dropdown in `frontend/src/pages/Reports.tsx`.
- 2026-10-11T21:14:33+05:30 - Verified frontend production bundle build (`pnpm run build`: 0 TypeScript errors, bundle generated cleanly in 9.57s).
- 2026-10-11T21:21:14+05:30 - Executed backend test suite via `docker exec mail_ai_api python -m unittest discover -s tests`: all 91 tests passed (91/91 OK).
- 2026-10-11T21:21:35+05:30 - Verified live API dynamic behavior: saving `sunday` dynamically shifted `this_week` total emails from 67 to 4, and saving `monday` shifted it back to 67.


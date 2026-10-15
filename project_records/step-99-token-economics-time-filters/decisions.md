# Step 99: Technical Decisions

## 1. Unified Time Range Vocabulary
- Aligned Token Economics (`get_llm_metrics_endpoint` and `LlmAnalytics.tsx`) with the Email Operations Dashboard:
  - `all`: All Time
  - `today` / `24h`: Current day (`DATE(created_at) = CURDATE()`)
  - `yesterday`: Previous day (`DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`)
  - `this_week`: Current calendar week matching configured `week_start_day`
  - `last_week`: Prior calendar week matching configured `week_start_day`
  - `this_month` / `30d`: Current calendar month
  - `last_month`: Prior calendar month
  - `custom`: Date range delimited by `start_date` and `end_date`

## 2. Backward Compatibility
- Preserved existing `time_window` parameter ('24h', '7d', '30d', 'all') so existing API callers and webhooks do not break.
- Fallback logic checks `range_type or time_window or "all"`.
- Legacy values like `24h` map to `today`, `7d` maps to `last_7_days`, and `30d` maps to `this_month`.

## 3. Dynamic Week Start Resolution
- Fetches `week_start_day` from `email_accounts` for the target `client_id` (or fallback global account for 'ALL').
- Sets MySQL `YEARWEEK(created_at, mode)` mode to `0` for Sunday and `1` for Monday, matching `get_dashboard_stats_endpoint`.

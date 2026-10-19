# Decisions: Step 97 - Add Last 7 Days Time Range Filter

## 1. Option Label & Identifier
- **Choice**: Label `"Last 7 Days"` with identifier `last_7_days` (also accepting alias `7_days` or `week` in backend for maximum backwards/URL compatibility).
- **Placement**: Inserted immediately following `"Yesterday"` and before `"Current Month"` in the filter bar:
  `All Time` | `Today` | `Yesterday` | `Last 7 Days` | `Current Month` | `Last Month` | `Custom Range`.
- **Rationale**: Follows standard analytics cadence from narrowest granularity (Today, Yesterday) to medium (7 days, Month) to long (Custom, All).

## 2. Date Boundary Specification
- **Choice**: Rolling 7 days including current day (`DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)`).
- **Timeline Aggregation**: Grouped daily (`%Y-%m-%d` sort key, `%b %d` formatted label).
- **Period-over-Period Delta**: Previous 7-day interval (`DATE(created_at) BETWEEN DATE_SUB(CURDATE(), INTERVAL 13 DAY) AND DATE_SUB(CURDATE(), INTERVAL 7 DAY)`).
- **Ticketing Report Consistency**: Aligned `_build_report_conditions` in reports API to support `last_7_days` (`e.created_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY`) as well.

# Decisions: Step 98 - Configurable Week Start & This Week / Last Week Filter

## 1. Filter Sequence
- **Sequence**:
  `All Time` | `Today` | `Yesterday` | `This Week` | `Last Week` | `Current Month` | `Last Month` | `Custom Range`
- **Replaced**: "Last 7 Days" replaced with "This Week" per user instruction; "Last Week" added alongside it.

## 2. Configurable Week Start Setting
- **Storage**: `email_accounts.week_start_day VARCHAR(10) DEFAULT 'monday'`.
- **Allowed Options**: `'monday'` (ISO standard, MySQL mode 1) and `'sunday'` (US standard, MySQL mode 0).
- **Backend Resolution**:
  - For specific client: `SELECT week_start_day FROM email_accounts WHERE client_id = %s`.
  - For ALL clients (admin view): default to `'monday'`, or primary account setting if configured.
- **SQL Logic**:
  - If `week_start_day == 'sunday'`: MySQL `YEARWEEK(..., 0)` mode.
    - This Week: `YEARWEEK(created_at, 0) = YEARWEEK(CURDATE(), 0)`.
    - Last Week: `YEARWEEK(created_at, 0) = YEARWEEK(DATE_SUB(CURDATE(), INTERVAL 7 DAY), 0)`.
  - If `week_start_day == 'monday'`: MySQL `YEARWEEK(..., 1)` mode.
    - This Week: `YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1)`.
    - Last Week: `YEARWEEK(created_at, 1) = YEARWEEK(DATE_SUB(CURDATE(), INTERVAL 7 DAY), 1)`.
- **Period-over-Period Deltas**:
  - This Week delta compares against Last Week.
  - Last Week delta compares against 2 weeks prior (`YEARWEEK(DATE_SUB(CURDATE(), INTERVAL 14 DAY), mode)`).

## 3. UI Location for Configuration
- Added to **General Settings** (`GeneralTab.tsx`) under System Configuration / Preferences, allowing clients and admins to easily toggle between Monday and Sunday.

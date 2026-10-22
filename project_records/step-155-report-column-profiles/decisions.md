# Decisions: Report Column Profiles

## 1. Profile Storage & Isolation
- **Options Considered:**
  1. Frontend `localStorage`: zero backend code, but no cross-device sync and not shared across users in the client account.
  2. Database `report_column_profiles` table keyed by `client_id`: ensures all users under the client account access the same profiles, persists across sessions, and allows backend-driven CSV export column filtering.
- **Decision:** Option 2. Scoped by `client_id` with a unique constraint on `(client_id, name)`.

## 2. Default Profiles vs Custom Profiles
- **Options Considered:**
  1. Store default profiles in the database per client.
  2. Hardcode default profiles as system constants in the backend API response and mark with `is_default: True`.
- **Decision:** Option 2. System default profiles (`Overview`, `Quality & Sentiment`, `Ops & Billing`) remain code-managed to ensure automatic schema updates without database migrations, while client custom profiles live in the DB.

## 3. Ad-Hoc Column Customization
- **Options Considered:**
  1. Restrict column changes to custom profiles only (block editing defaults).
  2. Allow ad-hoc column toggling at any time, showing a "(modified)" indicator and giving users a one-click option to save as a new custom profile.
- **Decision:** Option 2. Avoids workflow friction and prevents profile clutter when users just want a temporary view.

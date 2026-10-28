# Decisions - Step 164: Modernize Connector Presets

- **Decoupled Presets Registry**:
  - *Context*: Presets were hardcoded inline in `ConnectorEditorModal.tsx` as raw JSON strings inside JSX buttons, causing code bloat, bit rot, and hardcoded private developer tenant IDs.
  - *Choice*: Extract all presets into a dedicated typed registry `frontend/src/components/payload-config/connectorPresets.ts`.

- **Comprehensive CRM Preset Matrix**:
  - *Context*: Previously only 3 one-off presets existed (`Zoho Desk (ticket_create)`, `Freshdesk (ticket_create)`, and `Shopify (order_status)`). Ticket status lookups and Zendesk integrations were absent.
  - *Choice*: Expand presets to 7 standard configurations covering both `ticket_create` and `ticket_status` for Zoho Desk, Freshdesk, and Zendesk, plus modernized Shopify (`2026-10` API).

- **Security & Validation Auto-Configuration**:
  - *Context*: Category 4 and Step 163 introduced `owner_email_path` (for BOLA prevention) and `id_pattern_regex` (for fast pre-flight rejection of malformed IDs).
  - *Choice*: Every preset pre-populates accurate `owner_email_path` and `id_pattern_regex`.

- **Client-Side Unfilled Placeholder Guard**:
  - *Context*: Users often clicked presets and submitted immediately without replacing `YOUR_*` tokens, resulting in broken live endpoints.
  - *Choice*: Implement placeholder detection in `ConnectorEditorModal.tsx` displaying an amber warning and blocking submission until placeholders are resolved.

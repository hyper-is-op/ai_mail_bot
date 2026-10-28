# Step 174: CRM HTML Whitespace Double-Newline Header Formatting

## Objective
Fix CRM portal HTML whitespace collapsing where single newlines (`\n`) after section headers, dividers, and role tags merge onto the same line as body text in Zoho Desk/Freshdesk/Zendesk web interfaces. Enforce double newlines (`\n\n`) across `format_conversation_thread()`, connector presets, UI modal templates, and the live Zoho connector config.

## Execution Log
- 2026-10-28T12:13:00+05:30: Initiated Step 174. Diagnosed single-newline collapsing in CRM ticket description views where HTML renderers merge single `\n` into inline whitespace.
- 2026-10-28T12:15:30+05:30: Updated `app/context_data.py` `format_conversation_thread()`: switched `{role_label}{ts_label}:\n` to `\n\n`, `=== LATEST CUSTOMER INQUIRY ===\n` to `\n\n`, and `{header_text}\n` to `\n\n`.
- 2026-10-28T12:16:15+05:30: Updated `frontend/src/components/payload-config/connectorPresets.ts` and `frontend/src/components/payload-config/ConnectorEditorModal.tsx` templates with double-newlines.
- 2026-10-28T12:17:00+05:30: Updated `tests/test_connector_presets_validity.py` and ran unittest suite (`test_context_data.py` 7/7 passed, `test_connector_presets_validity.py` 11/11 passed).
- 2026-10-28T12:21:25+05:30: Updated live MySQL database `connector_configs` row 11 (`client_id='CLI-4B46C071'`) `request_template` description field to enforce `\n\n` spacing.
- 2026-10-28T12:22:08+05:30: Successfully compiled frontend production bundle with `pnpm --prefix frontend build`.
- 2026-10-28T12:22:26+05:30: Restarted `mail_ai_worker` Docker container to load updated `context_data.py`.

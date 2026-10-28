# Decisions - Step 176: Zoho Desk Pre-Wrap HTML Description Formatting

## 1. CRM Description Whitespace Preservation Strategy
- **Options Considered**:
  1. *Option A: Inline CSS Pre-wrap Container (`<div style="white-space: pre-wrap; font-family: inherit;">...</div>`)*:
     - Keeps backend variables (`conversation_history`, `history_summary`) as portable plain text (`\n\n`).
     - Directly supported by Zoho Desk's rich text renderer without font degradation.
  2. *Option B: Raw HTML `<br>` Ingestion*:
     - Requires replacing all `\n` in backend pipelines with `<br>` tags, which leaks HTML tags into non-HTML consumers (SMS alerts, plain terminal logs).
  3. *Option C: `<pre>` Code Block*:
     - Renders monospace font and risks horizontal overflow scrolling in CRM portals.
- **Decision**: Option A. Confirmed working on live Zoho Desk ticket `275424000000659001`. Applied to Zoho Desk connector presets, UI style switcher, and live database connector row 11.

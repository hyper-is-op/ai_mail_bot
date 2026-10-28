# Decisions - Step 174: CRM HTML Whitespace Double-Newline Header Formatting

## 1. CRM Line Break Strategy
- **Options Considered**:
  1. *HTML `<br>` Tags*: Inject literal `<br>` tags in `conversation_history` and `request_template`.
     - *Drawback*: Many CRMs (or plain text consumers like SMS alerts, webhook listeners, or terminal inspector tools) treat `<br>` as raw unescaped text, producing ugly `=== EXECUTIVE SUMMARY ===<br><br>The customer...`.
  2. *Double Newline (`\n\n`) Enforcing*: Standard Markdown / text-to-HTML convention where double line-breaks guarantee paragraph `<p>` or `<br>` separation across both HTML web portals (Zoho Desk, Freshdesk, Zendesk) and plain-text terminals.
- **Decision**: Option 2 (Double Newline). Preserves universal compatibility across terminal loggers, plain-text email clients, and web CRM interfaces without littering raw HTML tags.

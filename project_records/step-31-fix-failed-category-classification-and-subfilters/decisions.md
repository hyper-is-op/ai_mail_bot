# Step 31: Decisions - Fix Failed Category Classification and Subfilters

### 1. Mapping `ticket_creation_failed` to `ui_status = "Failed"`
- **Options Considered**:
  - *Option A*: Leave `ticket_creation_failed` as `"New"` or unmapped.
  - *Option B*: Map `ticket_creation_failed` directly to `ui_status = "Failed"` in `app/api/emails.py`.
- **Decision**: Option B. When CRM ticket creation fails in `dispatcher.py`, the email has failed its core objective. Mapping it to `"Failed"` ensures it displays in the Mail Monitor "Failed" filter and alerts operators.

### 2. Multi-Signal Subfilter Matching (Summary + Raw Status)
- **Options Considered**:
  - *Option A*: Continue using rigid single-phrase matching on `summary` (`includes('fatal worker error')`).
  - *Option B*: Combine `raw_status` checks (e.g. `ticket_created_send_failed`, `ticket_creation_failed`, `send_failed`) with regex/keyword matching covering all supported LLM providers (Groq, OpenAI, Anthropic, Gemini, DeepSeek, Grok, Ollama, 429 rate limit), auth errors (SMTP/IMAP authentication, credentials, 535), and network/worker timeouts.
- **Decision**: Option B. Emails fail across diverse layers (SMTP, LLM API, CRM, Worker). Relying on a single narrow phrase caused genuine failures to vanish from specific sub-filter tabs.

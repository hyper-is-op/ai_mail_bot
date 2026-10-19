## Technical Decisions: Suppressing Promotional Blasts & Preventing Bounce Loops

### Context
Inbound promotional broadcasts (e.g. `jos@mail.internshala.com` in thread `th_ef1e0f4187c9`) were being classified as generic tickets, triggering CRM ticket creation and dispatching outbound ticket confirmation emails to no-reply/broadcast addresses. This led to repeated delivery failures and mailer-daemon bounce storms.

### Options Considered
- **Option 1: Blanket keyword drop on 'unsubscribe' in body**
  - *Rejected*: Drops paying customers who quote or reply to existing email newsletters with genuine support requests (e.g., "Where is my order? Please unsubscribe me from marketing").
- **Option 2: Multi-layer suppression (Pre-filter broadcast prefix + Intent early-exit + Outbound broadcast delivery suppression)**
  - *Adopted*: 
    1. **Pre-LLM filter**: Drops automated broadcast prefixes (`newsletter@`, `promo@`, `campaign@`, `offers@`, `digests@`, `updates@`, etc.) without LLM token cost.
    2. **Intent early exit**: If LLM classifies intent as `marketing_promotional` or `off_topic_nonsense` with zero ticket IDs, zero troubleshooting turns, and no prior history, safely halts the pipeline as `no_action_needed` (Reports: `Filtered / Dropped`). Prevents ticket creation and agent loops.
    3. **Outbound delivery guard**: In `dispatch_or_draft_reply`, suppresses outbound SMTP attempts to unmonitored broadcast addresses (`*@mail.*`, `*@newsletter.*`, `noreply@`, `donotreply@`) to eliminate mailer-daemon bounce loops.

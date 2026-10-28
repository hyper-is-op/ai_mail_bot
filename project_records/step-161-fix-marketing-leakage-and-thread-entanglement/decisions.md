# Step 161: Fix Marketing Leakage, Thread Entanglement, and History Pollution - Decisions

## Context
Investigation of thread `th_0cb93a9f6077` revealed that marketing emails from `student@mail.internshala.com` (#551, #554, #603, #619) caused false autonomous auto-sends and wasted 46,223 LLM tokens and 21s of latency.

## Decisions Made

1. **Decouple `marketing_promotional` drop gate from `ctx.history` in `worker/tasks.py`**:
   - *Problem*: In `worker/tasks.py`, `if ctx.intent == "marketing_promotional" and not ticket_ids and not ctx.troubleshooting_step and not ctx.history:` bypassed the drop gate whenever any history existed.
   - *Decision*: Remove `and not ctx.history`. A message classified as `marketing_promotional` without an explicit ticket ID (`ticket_ids`) and without an active troubleshooting step (`troubleshooting_step > 0`) must always be dropped as `no_action_needed`. Even if prior history exists, marketing blasts must not trigger automated support replies.
   - *Resolution Mark*: Set `ctx.is_resolved = True` on `ctx.halt("no_action_needed", ...)` so dropped emails write `is_resolved = 1` in `email_logs`.

2. **Exclude dropped and unanswered emails from SQL history in `app/chat_history.py`**:
   - *Problem*: `get_history_from_sql` only excluded `('system_bounce_dropped', 'rate_limited', 'automation_halted')`. It included `no_action_needed` emails without replies, formatting them as customer messages waiting for a response, confusing the LLM into thinking a reply was required.
   - *Decision*: Exclude `no_action_needed` from `get_history_from_sql`, and ensure customer messages are only included in conversational memory if they received a reply or were part of an active interaction.

3. **Filter candidate threads in `check_and_resolve_thread_entanglement`**:
   - *Problem*: `check_and_resolve_thread_entanglement` selected candidate threads purely on `is_resolved = 0`. Because dropped marketing emails were stored with `is_resolved = 0`, they were treated as open support conversations, causing subsequent marketing campaigns from the same sender to re-anchor into the old thread.
   - *Decision*: Exclude dropped statuses (`no_action_needed`, `system_bounce_dropped`, `rate_limited`, `automation_halted`) and promotional/off-topic intents (`marketing_promotional`, `off_topic_nonsense`) from the candidate query in `check_and_resolve_thread_entanglement`.

4. **Expand deterministic broadcast domain detection in `app/pipeline/filters.py`**:
   - *Problem*: `filters.py` only checked prefix strings (`newsletter@`, `promo@`). Senders like `student@mail.internshala.com` with broadcast subdomains bypassed this check, requiring full LLM intent detection only to be suppressed later by SMTP.
   - *Decision*: Detect broadcast and unmonitored subdomains (`@mail.`, `@newsletter.`, `@news.`, `@updates.`, `@campaign.`, `@digest.`) in `apply_deterministic_filters`. Ensure webmail domains like `@mail.com` are not falsely blocked by verifying subdomain dots or matching against known patterns.

5. **Accurate status in `app/pipeline/dispatcher.py`**:
   - *Problem*: When delivery was suppressed for broadcast domains, `dispatcher.py` returned `("sent", False)`, falsely indicating in the UI and database that an email was dispatched.
   - *Decision*: Return `("no_action_needed", False)` with `ctx.log_step("Outbound_Delivery_Suppressed")` so the true lifecycle state is recorded.

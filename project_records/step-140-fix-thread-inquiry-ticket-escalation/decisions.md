# Step 140 Technical Decisions

1. **Extract Clean Scoring Query in Agent Pipeline**:
   - *Problem*: In email threads, the incoming subject often includes `Re: Ticket Update: 275424000000582153`. Passing this raw subject into `llm_score` misled the evaluator into believing the email was an unfulfilled ticket update inquiry rather than a product inquiry, dropping draft scores from 91 down to 63.
   - *Decision*: In `app/pipeline/agent.py`, implement `extract_scoring_query` to strip threading artifacts (`Re:`, `Ticket Update: \d+`, `Ticket #\d+`) from the subject before passing the query to `evaluate_draft_and_decide`.

2. **Evaluator Informational Inquiry Guard**:
   - *Problem*: Under standard decision engine logic, if a draft scored < 80, the evaluator returned `"create_ticket"`. For general informational inquiries (`general_query`, `marketing_promotional`, `greeting`), creating a support ticket in Zoho Desk is invalid and pollutes customer support queues.
   - *Decision*: In `app/pipeline/evaluator.py`, if `intent` is informational and knowledge retrieval succeeded (`context_succeeded == True`), allow `auto_send` for scores >= 60. For lower scores, route strictly to `"draft_mode"`, never `"create_ticket"`.

3. **Dispatcher & Post-Agent Ticket Creation Guard**:
   - *Problem*: In `worker/tasks.py`, if `response_action == "create_ticket"`, it unconditionally called `create_ticket_and_reply`, creating a new ticket even if `ctx.ticket_id` already existed or the intent was informational.
   - *Decision*: Restrict `create_ticket_and_reply` execution to non-informational queries where `ctx.ticket_id` is NOT already present. Existing ticket threads dispatch or draft the reply directly to the customer on the thread.

4. **Add Product Inquiry Workflow to Scoring Prompt**:
   - *Problem*: `app/scoring.py` had explicit workflow rules for direct resolution, ID verification, and troubleshooting, but lacked explicit rules for product explanations answering customer questions on existing threads.
   - *Decision*: Add `General / Product Inquiries` as a valid 85-100 scoring workflow in `llm_score`.

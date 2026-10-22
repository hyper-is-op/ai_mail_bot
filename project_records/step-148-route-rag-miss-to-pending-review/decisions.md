# Step 148: Route RAG Miss to Pending Review - Decisions

## Problem Statement
When a customer sends a general product or informational inquiry (`intent == 'general_query'`) and the knowledge base contains no matching documents (`results_found: False` / `not context_succeeded`), the existing system:
1. Intentionally prohibits CRM ticket creation (`escalation_denied`) to prevent CRM queue pollution.
2. Evaluates the LLM draft reply and returns `response_action = "draft_mode"`.
3. However, `worker/tasks.py` did not have an explicit handler for `ctx.response_action == "draft_mode"`, causing the email to fall into `elif ctx.draft_reply:` and dispatching the reply via SMTP whenever `feature_auto_send` was enabled.

## Options Considered
1. **Option A: Auto-Send generic AI deflection / clarification (Status Quo)**
   - *Pros*: Completely automated; zero operator overhead.
   - *Cons*: Poor user experience; prospective customers asking for uncatalogued products or specs receive vague deflections, and the support/sales team is never alerted to the RAG knowledge gap or sales opportunity.
2. **Option B: Escalate to external CRM Support Ticket**
   - *Pros*: Guarantees human follow-up.
   - *Cons*: Violates existing CRM SLA segregation rules; floods CRM queues with pre-sales and informational inquiries that support engineers are not staffed to handle.
3. **Option C: Route to `Pending Review` (`pending_manual_review` in Inbox & `draft_emails`) [Chosen]**
   - *Pros*:
     - Honors evaluator's `draft_mode` decision.
     - Places the email in the operator's **Pending Review** inbox tab and drafts queue without sending vague AI hallucinated responses.
     - Gives the operator immediate ability to review, edit, approve, and click **"Add to Knowledge Base"** to permanently close the RAG content gap.
     - Leaves CRM queues clean and SLA-compliant.

## Implementation Decisions
- **`app/pipeline/evaluator.py`**: In `evaluate_draft_and_decide`, when `not context_succeeded` and `is_informational` (`intent in ("general_query", "marketing_promotional", "greeting")`), guarantee `draft_mode` routing instead of attempting automated score-based auto-send.
- **`worker/tasks.py`**: Add an explicit `elif ctx.response_action == "draft_mode":` branch in the post-agent dispatch loop. Set `ctx.status = "pending_manual_review"`, log execution step `Routed_To_Pending_Review:RAG_Miss`, which triggers `_finalize_task_and_log` to auto-populate `draft_emails` with the draft for operator review.

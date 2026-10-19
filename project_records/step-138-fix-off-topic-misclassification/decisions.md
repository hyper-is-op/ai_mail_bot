# Step 138: Technical Decisions

## Problem
Inbound product or feature inquiry emails with brief inquiries such as "Tell me about cz callblast" were being misclassified by the LLM as `off_topic_nonsense`. The worker pipeline immediately halted with `ctx.halt("no_action_needed", "Classified as off_topic_nonsense", "Intent_Drop:off_topic_nonsense")` and dropped the message silently without replying or creating a ticket, despite high-confidence matching knowledge base documentation (0.88+ cosine similarity). Additionally:
1. `ctx.history` check at the drop gate was checked before history was loaded.
2. `generate_off_topic_reply()` existed in the codebase but was never called when an email was actually off-topic.

## Technical Choices
1. **Prompt Boundary & Precedence Rule 1 in `app/llm_functions/intent.py`**:
   - Explicitly restricted `off_topic_nonsense` to standalone greetings with no inquiry, gibberish/keyboard mash, or completely non-business topics.
   - Added Precedence Rule 1: inquiries asking about any named product, feature, tool, or service (e.g. "Tell me about X", "What does X do?") are strictly `general_query`, never `off_topic_nonsense`.
   - Result: LLM directly classifies "Tell me about cz callblast" as `general_query`.

2. **Early History Hydration in `worker/tasks.py`**:
   - Moved conversation history loading (`get_history`) prior to intent routing and early exit gates.
   - Ensures `ctx.history` is accurately populated when testing `not ctx.history` on early drop conditions, preventing ongoing customer conversations from being treated as standalone off-topic openers.

3. **High-Confidence RAG Override Gate in `worker/tasks.py`**:
   - Before executing an off-topic halt, perform `retrieve_knowledge(client_id, query, top_k=1, min_score=0.75)`.
   - If a matching document chunk exists with score >= 0.75, override `ctx.intent` to `general_query`, log `Intent_Override_RAG_Match`, and route directly to the agent loop.

4. **Polite Off-Topic Boundary Reply Instead of Silent Drop**:
   - When an email is confirmed off-topic and has no knowledge base match, invoke `generate_off_topic_reply` and dispatch via `send_email`.
   - Sets `ctx.draft_reply`, logs `Off_Topic_Reply_Sent`, and prevents customer abandonment.

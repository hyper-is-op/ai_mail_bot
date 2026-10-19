# Step 132: Technical Decisions

## 1. Two-Stage Sequential RAG vs. Parallel Dual Search
- **Options Considered**:
  1. Parallel dual search: executing both `arguments.get("query")` and `clean_rag_query(ctx.body)` simultaneously on every incoming email.
  2. Sequential short-circuit search: searching with `arguments.get("query")` first; only falling back to `clean_rag_query(ctx.body)` if the primary search returns empty.
- **Decision**: Option 2 (Sequential short-circuit search).
- **Reasoning**: In >90% of requests, the primary LLM keyword query matches cleanly. Executing parallel queries doubles CPU load on `embed_service` and Qdrant. Sequential execution provides 0ms added overhead in the happy path while guaranteeing full recovery in failure cases.

## 2. Conditional Cross-Thread History Gating vs. Complete History Elimination
- **Options Considered**:
  1. Complete removal of prior history carryover on new thread creation.
  2. Unconditional carryover of the last 3 messages for any sender (current implementation).
  3. Continuation-gated carryover: checking for follow-up markers (`Re:`, ticket numbers, or phrases like "earlier", "previous", "update on", "as discussed") before attaching past messages.
- **Decision**: Option 3 (Continuation-gated carryover).
- **Reasoning**: Option 1 gives the bot amnesia when a customer genuinely follows up without RFC headers. Option 2 contaminates unrelated fresh inquiries with stale technical outages. Option 3 preserves conversational continuity while isolating unrelated product inquiries.

## 3. Evaluator Step-1 Softening for General Inquiries
- **Options Considered**:
  1. Retain unconditional hard floor (`context_succeeded == False -> return 0, "create_ticket"`).
  2. Relax hard floor for Step 1 `general_query` inquiries, allowing conversational clarification or safe response.
- **Decision**: Option 2.
- **Reasoning**: Immediate ticket escalation on Step 1 of an informational question creates high CRM ticket volume and poor customer UX. Escalation should only be triggered if diagnostics fail repeatedly or human assistance is requested.

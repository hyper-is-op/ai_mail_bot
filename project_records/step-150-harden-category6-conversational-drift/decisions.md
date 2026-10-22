# Step 150: Harden Category 6 Conversational Drift - Decisions

### Decision 1: Thread Entanglement Handling (Option A Selected)
- **Choice:** Automatic Re-Anchoring with In-Reply Notification Note.
- **Reasoning:** When a customer with multiple parallel active threads replies into Thread A with clear content/entities belonging to Thread B, moving the context to Thread B prevents thread corruption and context hallucination. Prepending a note (`Note: We have linked your response to your ongoing inquiry regarding [Topic/Ticket] to keep your records organized.`) transparently communicates the reassignment to the customer.

### Decision 2: Refusal Handling Within Turn Progression
- **Choice:** Do not abruptly exit on initial customer refusal. Complete the diagnostic turn progression up to the configured ceiling (`DEFAULT_MAX_TROUBLESHOOTING_STEPS = 3`) before triggering CRM ticket escalation.
- **Reasoning:** Prevents premature CRM ticket generation from a single frustrated remark, giving the agent a chance to de-escalate, offer a minimal alternative check, and cleanly transition to a ticket once the turn sequence completes.

### Decision 3: Compound Intent Decomposition Compatibility
- **Choice:** Maintain `ctx.intent: str` as the primary intent while exposing `ctx.intents: List[str]` and `ctx.is_compound_intent: bool`.
- **Reasoning:** Guarantees 100% backward compatibility for existing metrics, DB columns, and routers while enabling the agent system prompt to explicitly address compound customer inquiries.

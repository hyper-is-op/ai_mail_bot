# Step 186 Decisions: Concise Ticket Status Response Layout

## Technical Choices & Rationale

1. **Synthesizing Issue Overview from CRM `subject` vs Dumping CRM `description`**:
   - *Options Considered*:
     a. Map and dump raw CRM `description` directly into the reply.
     b. Extract CRM `subject` into prompt context and instruct the LLM to synthesize a clean 1-sentence issue overview while stripping bracketed test/priority tags (e.g., `[FINAL VERIFICATION...]`).
   - *Choice*: Option B.
   - *Reasoning*: When tickets are created by the bot, the CRM `description` holds large hybrid escalation transcripts with internal metadata and tags (`mail_ai_escalation`). Dumping raw description back into customer status replies risks data leakage and creates noisy walls of text. Mapping `subject` provides the exact topic without leaking internals.

2. **Suppressing Empty / Unassigned Agent Fields in Prompt Formatter**:
   - *Options Considered*:
     a. Pass `assignee: null` or `"Unassigned"` to the LLM and rely on prompt instructions not to mention it.
     b. Suppress null, empty, or unassigned agent keys in `format_mapped_data_for_prompt()`.
   - *Choice*: Option B.
   - *Reasoning*: Defensive filtering at the data layer ensures the LLM never sees unassigned agent placeholders in its prompt context, eliminating hallucinations like *"Assigned Agent: None / Abhi koi agent assign nahi hua hai"*.

3. **Including 1-Sentence Actionable Next Steps in Ticket Status Prompt**:
   - *Options Considered*:
     a. Output strictly a 3-line mechanical table with zero conversational context.
     b. Include a concise 1-sentence explanation of what happens next and how to reply.
   - *Choice*: Option B.
   - *Reasoning*: Evaluator scoring (`llm_score` in `evaluator.py`) penalizes abrupt, robotic drafts that lack helpful guidance. A brief next-step sentence maintains customer clarity and ensures the draft consistently scores $\ge 80$ to trigger autonomous `auto_send`.

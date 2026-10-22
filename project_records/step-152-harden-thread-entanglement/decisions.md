# Decisions - Step 152: Harden Thread Entanglement Resolution

## Decision: RFC Header Protection & Quoted Reply Stripping for Entanglement Resolution

### Context
In multi-thread customer scenarios (e.g., Email #558), an explicit direct reply (`In-Reply-To` / `References`) to thread `th_6adfdb4bd640` was falsely hijacked into thread `th_9fc29e1c0ad2` because:
1. `strip_quoted_reply` was never invoked on the email body, causing quoted disclaimer text (`'tell me about cz omni'`) to enter entanglement matching.
2. The stopword set omitted common English verbs/prepositions (`"tell"`, `"about"`, etc.), matching `th_9fc29e1c0ad2` ("tell me about CZ dialer") on generic words.
3. The detector did not check whether the current thread was resolved via authoritative RFC headers (`In-Reply-To` / `References`).

### Technical Choices
1. **Direct RFC Reply Immunity**:
   - *Option A (Chosen)*: If `resolve_thread_id` matched via `In-Reply-To` or `References` (`is_rfc_reply = True`), topic keyword re-anchoring is strictly bypassed. Re-anchoring on RFC direct replies is ONLY permitted if the customer's *new* text contains an explicit candidate ticket ID or order ID.
   - *Option B*: Lower the keyword matching threshold. Rejected because keyword matching on direct replies is fundamentally unreliable when customers quote prior emails.
2. **Body Pre-Cleaning**:
   - *Choice*: Run `strip_quoted_reply(ctx.body)` to produce `clean_body` and evaluate entanglement strictly on `clean_body`.
3. **Stopword Expansion**:
   - *Choice*: Add conversational verbs (`tell`, `about`, `what`, `give`, `know`, `have`, `need`, `want`, `like`, `also`, `with`, `from`, etc.) and require either $\ge 2$ distinct non-stopword tokens or a specific domain keyword $\ge 7$ characters.

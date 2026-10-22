# Step 149: Harden Category 4 Connectors - Decisions

### Decision 1: BOLA Mismatch Strategy (Option A vs Option B)
- **Choice:** Option A (PII masking with graceful degradation and draft routing).
- **Reasoning:** Hard rejection of order lookups when email does not match damages customer experience for legitimate customers emailing from alternative personal or workplace accounts. Masking sensitive fields (address, phone, recipient name) while disclosing non-sensitive high-level status (e.g., "In Transit") and routing the response to `pending_manual_review` protects data security without causing dead-ends for legitimate users.

### Decision 2: Tenant Regex Isolation & ReDoS Protection
- **Choice:** Store optional `id_pattern_regex` in `connector_configs`, validate syntax at upsert time, and execute under `re.error` fallback to global patterns.
- **Reasoning:** Prevents invalid regular expressions from crashing worker loops while empowering tenants with bespoke order/ticket schemas.

### Decision 3: Entity Classification Disambiguation
- **Choice:** Partition extracted tokens into separate `orders` and `tickets` lists.
- **Reasoning:** Prevents false multi-ticket clarification halts when an email references both an order number and a support ticket number simultaneously.

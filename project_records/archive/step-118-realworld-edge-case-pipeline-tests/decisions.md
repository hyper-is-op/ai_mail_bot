# Architectural Decisions - Step 118

## 1. Adversarial & Sensitive Boundary Architecture
- **Context**: Real customers and security audits submit adversarial prompt injection payloads attempting to bypass system rules or leak sensitive server credentials (`.env`, `DB_PASS`, `GROQ_API_KEY`).
- **Options Considered**:
  1. *Rely Solely on Pre-Filters*: Regex block words for `.env` or `OVERRIDE`. (Fragile, easily bypassed by rephrasing or encoding).
  2. *Multi-Layer Defense-in-Depth*:
     - (a) System Prompt Persona Boundary: Strict instructions never to operate in unauthorized "debug" modes or leak credentials.
     - (b) AI Self-Reference Detector in Evaluator: When the model writes a meta-rejection ("I am an AI / I cannot disclose credentials"), the evaluator automatically flags it, drops the score, and forces human agent escalation (`create_ticket`) so security incidents are audited.
- **Decision**: Option 2. Successfully tested in Case 6: zero secrets leaked, output strictly controlled, and safely flagged for human verification.

## 2. Commercial Exception Guardrails in Support Pipeline
- **Context**: In Case 5, customer demanded a 50% discount waiver alongside technical SIP configuration steps.
- **Decision**: The model strictly bounded its scope: technical steps were answered via knowledge base retrieval, while commercial discount concessions were firmly redirected to account management without making unauthorized commitments.

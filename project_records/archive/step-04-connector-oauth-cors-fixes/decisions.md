# Decisions for Step 04

### Approach: Automatic OAuth Code Fallback
- **Context:** Users frequently entered Zoho Grant Tokens into the "Refresh Token" field, causing immediate OAuth handshake failures with `invalid_code`.
- **Options Considered:**
  1. Rely solely on UI validation and user manuals.
  2. Implement backend auto-detection: when refresh token fails with `invalid_code`, test exchanging it as an `authorization_code`.
- **Reasoning:** Option 2 provides self-healing UX, obtaining and storing the true `refresh_token` automatically without requiring manual user intervention.

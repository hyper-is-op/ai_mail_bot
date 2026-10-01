# Decisions: step-52-real-world-conversation-testing

## Live Integration Tenant Selection
- **Context:** `tests/realworld_scenarios_test.py` originally pointed to an old or non-existent client ID (`CLI-425589BC`), which failed ticket status lookup and ticket creation due to missing connector credentials.
- **Decision:** Aligned real-world integration tests to active client `CLI-4159FFCF`, which has active OAuth2 client credentials and configured endpoints for Zoho Desk (`https://desk.zoho.in/api/v1/tickets`) and Qdrant vector storage.

## Distinction between Diagnostic Troubleshooting and Immediate Escalation
- **Context:** In early testing of Scenario 1, a generic technical crash query caused the agent to deliver Step 1 of the troubleshooting loop because knowledge chunks were matched in Qdrant, rather than immediately opening a ticket.
- **Decision:** Preserved the intended agent behavior. To test immediate first-turn ticket escalation under system policy, the test prompt was updated to an explicit human/outage ticket request ("Please open a high-priority support ticket immediately in Zoho Desk"), ensuring the ReAct agent invokes `escalate_and_create_ticket` without unneeded troubleshooting.

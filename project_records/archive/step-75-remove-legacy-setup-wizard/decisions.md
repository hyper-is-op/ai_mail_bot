# Decisions: Step 75 - Remove Legacy Setup Wizard

## Decision: Decommission and Remove Legacy SetupWizard Component

### Context
Users with the `client` role experienced persistent modal popups ("Step 2: Tracking Webhook (Get Ticket)") upon login and page hard refresh. The root cause was that `Layout.tsx` mounted `<SetupWizard />`, which called `api.getGetPayload(clientId)`. Because `/get-get-payload/{clientId}` was decommissioned in step 56 during legacy connector teardown, the endpoint continuously returned a 404 error. The wizard caught this 404, assumed webhook configuration was missing, and repeatedly opened the step 2 modal without persistent dismissal state.

### Options Considered
1. **Option A (Chosen): Decommission Legacy SetupWizard Entirely**
   - Rationale: Mailbox and connector configurations are already maintained with full CRUD, test suites, and audit trails in dedicated views (`/email-accounts` and `/payload-config`). An un-dismissible legacy modal hitting dead endpoints is redundant technical debt.
2. **Option B: Rewire SetupWizard to Modern Connector Configuration Engine**
   - Rationale: Rejected. Dynamic connectors allow multiple configurations (status lookups, ticketing, OAuth) that do not fit a linear 3-step hardcoded modal. Forcing users into a rigid wizard creates operational friction when self-serve configuration pages already exist.

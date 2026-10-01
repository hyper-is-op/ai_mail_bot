# Decisions - Step 20

## Decision 1: Replace Obscure ID Prefixes with Real Company Names
- **Context**: On Settings & Policies (`Settings.tsx`), the hero card was titled with a bizarre synthetic prefix: `TVT-A-EC-${selectedClientId}` (e.g. `TVT-A-EC-CLI-425589BC`). On Home (`Dashboard.tsx`), the title was `Mail Automation · ${selectedClientId}`.
- **Problem**: Users identify tenants by their business/company name (e.g. "Acme Corp"), not by internal generated strings like `TVT-A-EC-CLI-425589BC`.
- **Choice**:
  1. Resolve `company_name` via `clients.find()` and client profile state.
  2. In `Dashboard.tsx` hero: display the Company Name as primary title, and move `Client ID: ${selectedClientId}` to the subtitle.
  3. In `Settings.tsx` hero: eliminate `TVT-A-EC-` entirely. Display Company Name as primary title and `Client ID: ${targetClientId}` in the subtitle.
  4. Fall back to Client ID if no company name is registered.

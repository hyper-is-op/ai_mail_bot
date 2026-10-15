# Step 80: Decisions - Reference Identification Architecture

## Technical Choices

1. **Dedicated Reusable Component (`ReferenceBadge.tsx`) vs. Inline Template Strings**
   - *Options Considered*:
     - A: Ad-hoc inline string templating and copy handlers in every table/card view.
     - B: Shared `ReferenceBadge` component supporting thread IDs, email log IDs, and ticket references with built-in truncation, 1-click clipboard copy, and visual type hints.
   - *Choice*: Option B. Ensures consistent styling, prevents code duplication, and eliminates clumsy long UUID text wrapping.

2. **Entity vs. Transaction Boundary Enforcement**
   - *Choice*: Thread and message IDs will strictly appear in transactional contexts (Reports, Tickets inspection, Drafts cards, LLM analytics). Entity views (Email Accounts, Customer directory, raw sender fields) will NOT have IDs appended to email strings to avoid visual clutter and conflation of people with transactions.

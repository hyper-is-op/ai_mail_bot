# Step 95 Decisions: Standardize Drafts Workspace Primitives

## Technical Choices

1. **Adoption of Shared Form Primitives in `DraftFilterBar`**:
   - Replaced native inputs and ad-hoc dropdowns with `<Input>` and `<Select>` components.
   - Preserved all filter functionalities (Search Query, Sender, Intent, Sentiment, Min Confidence Score) while unifying the appearance to Windows 11 Fluent design token standards (`rounded-xl`, `border-border`, `focus:border-b-2 focus:border-b-primary`, `shadow-2xs`).

2. **Integration of `StatusBadge` in `DraftsTable`**:
   - Replaced redundant hand-rolled status badges with `<StatusBadge>`:
     - `pending` -> `variant="warning"` (`Pending`, `dot`, `size="xs"`)
     - `sent` -> `variant="success"` (`Dispatched`, `dot`, `size="xs"`)
     - `discarded` -> `variant="danger"` (`Discarded`, `dot`, `size="xs"`)
     - Fallback -> `variant="neutral"` (`draft.status`, `dot`, `size="xs"`)
   - Unifies typography, pill sizing, and semantic colors across Tickets, AiProcessing, and Drafts workspaces.

3. **Adoption of Shared `Pagination` Component**:
   - Replaced custom chevron buttons and page text with the shared `<Pagination>` component passing `pageSize={15}` and total records.
   - Eliminates pagination code duplication across workspace tables.

4. **Purge of Hardcoded Dark Hex `#282828` in `BatchActionBar`**:
   - Replaced `bg-[#282828]` with `win11-card bg-card/95 backdrop-blur-md border border-border shadow-lg text-foreground`.
   - Replaced raw button colors with semantic destructive/success tokens to guarantee flawless rendering in both light and dark modes.

5. **Normalized KPI Cards in `DraftMetricsCards`**:
   - Replaced `rounded-lg` with `rounded-xl shadow-2xs` consistent with all other analytics dashboards.

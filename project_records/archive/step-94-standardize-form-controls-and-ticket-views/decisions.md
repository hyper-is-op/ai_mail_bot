# Step 94 Decisions: Standardize Form Controls and Ticket Views

## Problem Context
While modals, drawers, and pagination components were standardized in earlier steps, form controls and view-specific cards remained fragmented:
1. `Input` and `Select` elements were repeatedly rewritten across `Tickets.tsx`, `Reports.tsx`, and `EmailAccounts.tsx` with ad-hoc styling and hardcoded dark-mode hex overrides (`#202020`).
2. KPI metric cards in `Tickets.tsx` used legacy `rounded-2xl` while `AiProcessing.tsx` and skeletons used `rounded-xl shadow-2xs`.
3. Table status columns and drawer inspection tiles in `Tickets.tsx` and `EmailAccounts.tsx` rendered copy-pasted pill markup instead of the unified `<StatusBadge />` primitive.

## Architectural Choices

1. **Reusable Fluent Input & Select Primitives:**
   - Authored `Input.tsx` and `Select.tsx` under `components/common/` with forwardRef support, icon slots, and Fluent focus underline styling (`focus:border-b-2 focus:border-b-primary`).
   - Integrated semantic tokens (`bg-card`, `border-border`, `text-foreground`, `shadow-2xs`) across all states.

2. **Unified Status and Metric Surfacing:**
   - Converted inline status pills in `Tickets.tsx` and `EmailAccounts.tsx` to `<StatusBadge>` with variant mapping (`success`, `warning`, `purple`) and status dot indicators.
   - Normalized `Tickets.tsx` KPI metric cards to `rounded-xl shadow-2xs`, aligning with `AiProcessing.tsx`.

3. **Purge of Hardcoded Hex Overrides:**
   - Replaced all legacy `bg-white dark:bg-[#202020]` form control classes in `Reports.tsx` and `EmailAccounts.tsx` with the standardized primitives.

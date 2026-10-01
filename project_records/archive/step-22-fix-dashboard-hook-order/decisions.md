# Step 22 Decisions - Fix Dashboard Hook Order

## Context & Rationale
When accessing `/dashboard`, the page crashed into a blank/black screen due to React Hook Rules violation: `useSearchParams` was declared below the `if (loading) return ...` early return guard. When `loading` toggled from `true` to `false`, the number of hooks called increased, causing React to throw a fatal invariant error.

## Key Changes
- Lift `useSearchParams` and `activeTab` to top of `Dashboard` function before any conditional blocks.
- Remove premature early-return for `loading`; instead, display the loader state scoped inside the email tab content so header and tab navigators remain responsive and mounted.

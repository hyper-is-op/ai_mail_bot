# Step 22 Log - Fix Dashboard Hook Order

- 2026-09-28T18:55:00Z - Initialized step-22 to fix Dashboard black screen caused by React hook ordering violation (useSearchParams called after early loading return).
- 2026-09-28T18:55:30Z - Lifted useSearchParams, activeTab, and handleTabChange to top of Dashboard.tsx and scoped loading spinner within the Email tab content.

# Step 160: Make All Pages Text Selectable - Technical Decisions

## Decision: Scope Removal of `select-none` to Page-Level Root Wrappers

### Context
In Windows 11 Fluent style UI, `select-none` was inadvertently applied to the outermost wrapper `<div>` of `Dashboard.tsx`, `KnowledgeBase.tsx`, `Settings.tsx`, and `EmailAccounts.tsx`. Because CSS `user-select` inherits recursively down the DOM tree, this prevented users from highlighting or copying any metrics, table content, logs, articles, or text within those pages.

### Options Considered
1. **Remove `select-none` from page containers while retaining it on small interactive controls (buttons, badges, toggles)**:
   - *Pros*: Restores text selection for all content across all pages while keeping UI controls (like switches and badges) feeling responsive and clean during rapid clicking/toggling.
   - *Cons*: None.
2. **Remove `select-none` globally across the entire repository**:
   - *Pros*: Universal selection.
   - *Cons*: Makes UI toggle switches, reference badges, and topbar navigation icon clicks trigger unintended text highlight rectangles when clicked repeatedly or dragged.

### Choice
Option 1: Remove `select-none` from the root container wrappers in `Dashboard.tsx`, `KnowledgeBase.tsx`, `Settings.tsx`, and `EmailAccounts.tsx`.

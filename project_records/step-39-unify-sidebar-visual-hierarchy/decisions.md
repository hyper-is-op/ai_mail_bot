# Step 39: Decisions - Unify Sidebar Visual Hierarchy

### 1. Removal of Duplicate Profile Card in Sidebar
- **Rationale**: The sidebar contained an un-styled, static gray user card that duplicated the rich user profile dropdown already present in the adjacent Topbar. Removing it frees vertical space, eliminates visual clutter, and unifies navigation focus.

### 2. Design System Alignment
- Standardized navigation tokens: Consistent 12px / `text-xs` typography, unified 8px / `rounded-lg` corner radiuses, and identical active state indicators (`bg-primary/10 text-primary font-semibold` with a 3px vertical pill).
- Unified nested sub-items: Indented child links aligned with subtle border-left guides, smooth chevron rotations, and matching hover/focus states.

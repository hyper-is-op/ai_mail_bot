# Decisions: Step 88 - Unified Skeleton Loading System

## Problem
Currently, core data tables (AI Processing, Tickets, Reports, Drafts) and dashboards unmount their containers and replace them with a centered `<Loader2 className="animate-spin" />` in a blank box. This causes severe layout shifts (CLS), obliterates table headers, and causes flickering during filtering or pagination.

## Approaches Considered
1. **Full-page generic skeleton cards**:
   - Replaces the entire page container with generic wireframe blocks.
   - *Rejected*: Wipes out controls (search bars, filter chips, table headers), causes large visual jumps when real data hydrates, and breaks navigation continuity.

2. **Structural Skeleton Primitives & Table Body Hydration (Chosen)**:
   - Preserves table headers (`<thead>`), filter controls, and pagination footers.
   - Replaces only the `<tbody>` rows with column-matched skeleton placeholders (`TableSkeleton`).
   - Skeletons trigger only on cold initial mount (`data.length === 0 && loading`).
   - Refetching with existing data (`data.length > 0 && loading`) keeps the current rows visible at reduced opacity (`opacity-50`) with an inline hairline progress indicator to prevent seizure-inducing flickering.
   - Skeletons are strictly avoided on transactional write buttons (retaining action spinners).

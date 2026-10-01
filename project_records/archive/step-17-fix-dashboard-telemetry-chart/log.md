# Step 17: Fix Dashboard Telemetry Chart

## Objective
Diagnose and fix the telemetry chart on the Home page (`Dashboard.tsx`):
1. Resolve single-data-point / sparse data rendering failure in Recharts where an `AreaChart` with 1 point rendered zero width/area, appearing completely blank.
2. Fix color collision where `Total Ingested` and `AI Replied` both used identical blue CSS variable hues (`--primary` vs `--accent`).
3. Add visible data node dots (`dot` and `activeDot`) so isolated data points are clearly visible and interactive.
4. Improve custom Windows 11 tooltip formatting with distinct color swatches and values.
5. Provide automatic baseline smoothing/padding for single-point datasets so area fills and spline curves render properly.

## Execution Log
- **2026-09-28T13:20:00+05:30**: Initialized step 17 record and diagnosed root causes of blank chart rendering.
- **2026-09-28T13:20:32+05:30**: Updated `frontend/src/pages/Dashboard.tsx`:
  - Added `useMemo` chart data processor to pad single-point series with adjacent baseline zero nodes, preventing zero-width AreaChart collapse.
  - Replaced ambiguous/colliding CSS variable color tokens with distinct Windows 11 Primary Blue (`#0067C0` / `#60CDFF`) for Total Ingested and Emerald Green (`#10B981` / `#34D399`) for AI Replied.
  - Enabled distinct node dots (`dot` and `activeDot`) on both series.
  - Added Windows 11 style interactive tooltip and color-coded telemetry legend.
- **2026-09-28T13:21:00+05:30**: Verified frontend build (`pnpm run build` -> `tsc && vite build`). Clean compilation with exit code 0.

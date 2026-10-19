# Decisions - Step 71: Operations Dashboard Charts and Visualizations

## 1. Timeline Chart Architecture: Dual-Mode Toggle
- **Options Considered**:
  - Replace the AreaChart entirely with a stacked bar chart.
  - Keep AreaChart as-is and add a second card below it.
  - Implement an in-card view toggle between "Volume Trend" (smooth Area curves) and "Pipeline Outcomes" (stacked state bars).
- **Reasoning**:
  - Replacing the AreaChart outright loses the smooth visual velocity trend operators appreciate for at-a-glance traffic volume.
  - Adding a whole separate card duplicates the time axis and uses excessive vertical screen real estate.
  - An in-card toggle allows seamless inspection of both continuous velocity and discrete operational outcomes (Deflected, Escalated, Pending, Failed) within the same container.

## 2. Donut Chart vs Progress Bars in Resolution Breakdown
- **Options Considered**:
  - Replace progress bars with a donut chart.
  - Keep only progress bars.
  - Hybrid: Display a sleek Donut chart with CRR % callout in the center, followed by the detailed linear metric rows below.
- **Reasoning**:
  - Linear progress bars alone do not communicate relative share of 100% or small percentages well.
  - A Donut chart alone lacks the granular click targets and precise count typography of the rows.
  - The hybrid approach delivers executive visual clarity (proportional pie with center CRR KPI) and operational precision (exact counts and percentages per pipeline stage).

## 3. 24-Hour Peak Load Profile
- **Decision**: Add `hourly_profile` (array of 24 hourly buckets) to `inbound_health` in `app/api/analytics.py` and visualize it as a mini-sparkline/bar cadence in the inbound health telemetry section.

# Decisions - Step 17

## Decision 1: Single-Point Baseline Synthesis in Frontend Chart Data
- **Context**: In MySQL, `email_logs` queries group existing rows by hour or date. If activity only occurred during a single hour (e.g. 11 AM) or single day (e.g. Sep 28), the query returns a single record `[ { name: '11 AM', emails: 9, aiReplied: 5 } ]`.
- **Problem**: Recharts `<AreaChart>` requires at least two X-axis points to compute SVG polygon paths (`d="M... Z"`). With a single point and default `dot={false}`, the rendered area has 0 width and renders completely blank.
- **Decision**: In `Dashboard.tsx`, when `chartData.length === 1`, automatically pad the dataset with adjacent baseline points (zero-value entries before and after the active point).
- **Result**: The area chart renders a clean bell curve around the peak activity point rather than disappearing.

## Decision 2: Distinct Palette for Ingested vs AI Replied
- **Context**: The chart previously used `hsl(var(--primary))` for Total Ingested and `hsl(var(--accent))` for AI Replied.
- **Problem**: In `index.css`, `--primary` and `--accent` are defined with the exact same HSL values (`209 100% 36%` in light mode, `198 100% 68.6%` in dark mode). Both areas appeared in identical blue.
- **Decision**: Differentiate `Total Ingested` (Primary Blue: `#0067C0` / `#60CDFF`) and `AI Replied` (Emerald Green: `#10B981` / `#34D399`, matching the KPI auto-reply pill).
- **Result**: Immediate visual distinction between total ingested volume and automated reply volume.

## Decision 3: Visible Data Node Dots
- **Context**: By default, Recharts `Area` hides dots on data points (`dot={false}`).
- **Decision**: Explicitly configure `dot` with circular markers and `activeDot` on hover for both series.
- **Result**: Users can see and hover over exact data points even when sparse.

# Decisions: UI Standardization Primitives and Tables

## Decision 1: Design Standard Selection (Windows 11 Fluent)
- **Context:** The application previously had conflicting design dialects: Windows 11 Fluent tokens (`win11-card`, `FluentToggle`, `SettingsExpander`, `Segoe UI` fonts) vs ad-hoc dark SaaS glass (`bg-white/5 border-white/10`).
- **Choice:** Standardize on Windows 11 Fluent design principles.
- **Reasoning:** The entire foundation in `index.css` (Mica canvas, Acrylic surfaces, official `#005FB8` and `#60CDFF` blue accents) is structured around Windows 11 Fluent. Standardizing on this design system unifies the UI and eliminates dark-only hacks.

## Decision 2: Extracted Primitives Strategy
- **Context:** `AiProcessing.tsx` and `Tickets.tsx` have duplicate 40-line pagination blocks with hardcoded `bg-zinc-900` controls that break light mode.
- **Choice:** Extract a reusable, accessible `<Pagination />` and `<StatusBadge />` component in `components/common/`.
- **Reasoning:** Keeps pagination, page size changes, and status styling deterministic and unified while fixing light/dark theme contrast.

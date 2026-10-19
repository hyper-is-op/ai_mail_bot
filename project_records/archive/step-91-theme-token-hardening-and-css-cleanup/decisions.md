# Decisions: Theme Token Hardening and CSS Cleanup

## Decision 1: Purging `.bg-white\/5` and `.bg-white\/10` Global Overrides
- **Context:** In `index.css`, lines 240–267 contained monkey-patched overrides for Tailwind classes (`html:not(.dark) .bg-white\/5 { background-color: #ffffff !important; }`), because components originally authored for dark mode (`bg-white/5 border-white/10`) looked broken in light mode without it.
- **Choice:** Audit all remaining occurrences of `bg-white/5` across the frontend pages, replace them with semantic tokens (`bg-card`, `bg-secondary`, `border-border`, `win11-card`), and cleanly remove or refine the blunt `!important` utility overrides.
- **Reasoning:** Standardizing to semantic CSS variables provides predictable theme rendering and prevents global utility clashes.

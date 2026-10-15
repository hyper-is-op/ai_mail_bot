# Decisions: Step 104 - Reference Badge Contrast Overhaul

## Problem
In `ReferenceBadge.tsx`, IDs for Tickets, Mail Logs (`#`), and Threads were rendered using hardcoded tint classes:
```tsx
const typeColorClasses = {
  thread: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 hover:border-indigo-500/40',
  message: 'text-sky-400 bg-sky-500/10 border-sky-500/20 hover:border-sky-500/40',
  ticket: 'text-purple-400 bg-purple-500/10 border-purple-500/20 hover:border-purple-500/40',
  generic: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20 hover:border-zinc-500/40'
};
```
These colors suffered from:
1. **Light Mode failure**: `text-indigo-400`, `text-sky-400`, and `text-purple-400` are pale pastel tones that severely wash out on light/white table backgrounds, failing basic WCAG contrast standards.
2. **Dark Mode failure**: `10%` background fills and `20%` border alphas cause the badge container to blend into dark cards and table rows, leaving thin, low-contrast text floating.
3. Label prefixes had `opacity-70`, causing `#` and other labels to be nearly invisible.
4. Copy button hover was hardcoded to `hover:text-white`, which is unreadable in light mode.

## Technical Solution
Implement dual-mode adaptive tokens in `ReferenceBadge.tsx`:
- `thread`: `text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800/60 hover:border-indigo-400 dark:hover:border-indigo-600`
- `message`: `text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-300 dark:bg-sky-950/40 dark:border-sky-800/60 hover:border-sky-400 dark:hover:border-sky-600`
- `ticket`: `text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-300 dark:bg-purple-950/40 dark:border-purple-800/60 hover:border-purple-400 dark:hover:border-purple-600`
- `generic`: `text-zinc-700 bg-zinc-100 border-zinc-200 dark:text-zinc-300 dark:bg-zinc-850 dark:border-zinc-700/60 hover:border-zinc-400 dark:hover:border-zinc-500`

Refinements:
- Upgraded text weight from `font-medium` to `font-semibold`.
- Removed `opacity-70` from the label prefix so `#` and identifiers are crisp.
- Changed copy button hover to `hover:text-foreground`.

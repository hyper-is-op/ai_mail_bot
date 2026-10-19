# Decisions: Standardize Drawers and Modals

## Decision 1: Shared BaseDrawer Architecture
- **Context:** `AiProcessing.tsx` (lines 420–745) and `Tickets.tsx` (lines 515–703) duplicate ~300 lines of drawer backdrop, sliding spring animations, header icons, and close handlers with differing styling and hardcoded dark themes (`bg-white dark:bg-zinc-950 border-zinc-200 dark:border-white/10`).
- **Choice:** Build a reusable `<BaseDrawer />` primitive supporting ESC-key dismissal, body scroll-lock preservation, standardized Fluent header/close button, and customizable width.
- **Reasoning:** Centralizes slide-over mechanics, accessibility, backdrop blur, and theme tokens while letting page-specific content remain intact.

## Decision 2: Shared BaseModal Architecture
- **Context:** Over 10 dialogs implement their own `fixed inset-0 z-50` backdrop with diverging animations and blur filters.
- **Choice:** Build a reusable `<BaseModal />` primitive with standardized backdrop blur, scale/fade animation, ESC-key handler, and header/footer action layout.

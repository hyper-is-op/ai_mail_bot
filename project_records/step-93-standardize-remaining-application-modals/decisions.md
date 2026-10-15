# Step 93 Decisions: Standardize Remaining Application Modals

## Problem Context
Following step 90's creation of `BaseModal` and migration of `DraftReviewModal`, an audit of modal dialogs revealed widespread visual and behavioral fragmentation across the application:
1. **Settings modals** (`ConfirmGlobalModal`, `ConfirmAutoSendModal`, `ConfirmKillSwitchModal`) used custom backdrop implementations, hardcoded `bg-white dark:bg-zinc-900` classes, non-standard border radiuses (`rounded-2xl` vs `rounded-3xl`), and lacked ESC key dismissals.
2. **LLM Config modal** (`OverrideConfirmModal`) used custom overlays and lacked theme-aware tokens.
3. **Payload Connectors modals** (`DeleteConfirmModal`, `RejectReasonModal`, `AllowlistModal`, `AiTemplateModal`, `ConnectorEditorModal`) featured inconsistent headers, buttons, and animations.
4. **Knowledge Base modals** (Add Knowledge and Inspect Document dialogs) duplicated window layouts and manual close button wiring.

## Architectural Choices

1. **Primitive Flexibility Over Duplication:**
   - Extended `BaseModal` with `iconContainerClassName`, `hideCloseButton`, `closeOnBackdropClick`, `closeOnEscape`, and `bodyClassName`.
   - Enabled critical safety modals (such as `ConfirmKillSwitchModal` and `OverrideConfirmModal`) to lock backdrop and ESC dismissal during active mutation calls (`!loading`, `!overrideUpdating`).

2. **Semantic Theme Token Alignment:**
   - Replaced all remaining hardcoded `bg-zinc-900`, `bg-white`, and dark-mode only classes in modal wrappers with semantic Fluent variables (`bg-card`, `border-border`, `text-foreground`, `bg-secondary`, `text-muted-foreground`).
   - Aligned button styling across modal action footers with standard interactive tokens (`rounded-lg`, `transition-colors`, `cursor-pointer`).

3. **Accessibility and Keyboard Support:**
   - Universal ESC-key dismissal across all application modals without requiring repetitive `useEffect` event listeners in each feature component.

# Decisions: Step 05 - Windows 11 Settings Fluent UI Redesign

## 1. Architectural Scope & Guardrails
- **Choice**: Apply Windows 11 Settings look and feel strictly to the Shell (Topbar, Sidebar, Window controls, Mica Canvas), the Dashboard ("Home"), and Configuration pages (`Settings.tsx`, `FeaturesTab.tsx`, `EmailAccounts.tsx`).
- **Options Considered**:
  1. Blanket reskin of all pages to look like Settings expander cards.
  2. Scoped adoption: Shell + Overview ("Home") + Settings, preserving high-density layouts for Mail Monitor / Inbox.
- **Reasoning**: Converting 3-pane email viewers, live WebSocket logs, and JSON payload editors into low-density Settings cards causes a severe loss of operational visibility. Scoped adoption gives the exact Windows 11 aesthetic while maintaining operational productivity.

## 2. Windows 11 Toggle Switch Implementation
- **Choice**: Build a custom `FluentToggle` React component featuring a 40x20px pill track with smooth sliding thumb and explicit `"Off"` / `"On"` label beside the switch.
- **Reasoning**: Default Tailwind or Lucide icon toggles lack the authentic Windows 11 Fluent 2 interaction feel and adjacent state text seen in the reference screenshots.

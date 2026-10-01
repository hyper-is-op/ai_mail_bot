## Context & Rationale
During UI validation, three issues were identified:
1. Missing navigation to the active AI trace pipeline (`/ai-processing`) in both Sidebar and Topbar.
2. An obsolete native browser `alert()` call in the sidebar's feedback button.
3. Decoupled theme state between the Topbar's sun/moon toggle and the Dashboard's "Color mode" select dropdown.
4. Topbar title was non-interactive text instead of a standard breadcrumb.

## Decisions Made
- **Restored AI Pipeline Navigation**: Added `AI Pipeline Trace` under `Operations` in [Sidebar.tsx](file:///home/hyper_is_op/mail_ai_automation/frontend/src/components/Sidebar.tsx) and mapped `/ai-processing` in [Topbar.tsx](file:///home/hyper_is_op/mail_ai_automation/frontend/src/components/Topbar.tsx).
- **Cleaned Footer Feedback**: Replaced `alert()` with a standardized feedback mailto link (`feedback@c-zentrix.com`) in [Sidebar.tsx](file:///home/hyper_is_op/mail_ai_automation/frontend/src/components/Sidebar.tsx).
- **Unified Theme Synchronization**: Integrated `theme`, `setTheme`, and `toggleTheme` into [AppStateContext.tsx](file:///home/hyper_is_op/mail_ai_automation/frontend/src/context/AppStateContext.tsx). Synchronized both [Dashboard.tsx](file:///home/hyper_is_op/mail_ai_automation/frontend/src/pages/Dashboard.tsx) and [Topbar.tsx](file:///home/hyper_is_op/mail_ai_automation/frontend/src/components/Topbar.tsx) through this single source of truth.
- **Interactive Breadcrumb**: Replaced static title text in [Topbar.tsx](file:///home/hyper_is_op/mail_ai_automation/frontend/src/components/Topbar.tsx) with an interactive `Home / <Current Page>` breadcrumb path.

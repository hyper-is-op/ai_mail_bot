## Context & Rationale
The dashboard and shell had accumulated decorative OS widgets, dead code, and unpersisted dummy controls that provided no functional value for email automation:
1. Topbar had desktop OS window caption buttons (Minimize, Maximize, Close) that did nothing inside a browser.
2. Home dashboard contained fake hardware device info (CPU/RAM/build numbers), fake wallpaper selection cards, and dummy automation toggles / confidence tiles disconnected from backend persistent state.
3. Three orphaned page components (`ApiTesting.tsx`, `OrderTracking.tsx`, and `SystemHealth.tsx`) were unrouted dead code.
4. Topbar user dropdown duplicated top-level navigation instead of focusing on session/profile actions.

## Decisions Made
- **Pruned non-functional window controls**: Removed `.win11-caption-button` elements and classes from [Topbar.tsx](file:///home/hyper_is_op/mail_ai_automation/frontend/src/components/Topbar.tsx) and [index.css](file:///home/hyper_is_op/mail_ai_automation/frontend/src/index.css).
- **Pruned dead pages**: Removed unrouted orphan pages `ApiTesting.tsx`, `OrderTracking.tsx`, and `SystemHealth.tsx`.
- **Streamlined Dashboard**: Removed fake wallpaper cards, fake hardware specifications, and disconnected local-only toggle states from [Dashboard.tsx](file:///home/hyper_is_op/mail_ai_automation/frontend/src/pages/Dashboard.tsx). Kept real telemetry, volume charts, quick links, and appearance controls.
- **Streamlined User Menu**: Refined user menu in [Topbar.tsx](file:///home/hyper_is_op/mail_ai_automation/frontend/src/components/Topbar.tsx) to focus on Settings and Sign Out.

# Step 18: Remove Duplicate Appearance & Theme Card from Home Page

## Objective
Remove the redundant "Appearance & Theme" settings card from the Home dashboard (`Dashboard.tsx`):
- Light/Dark mode toggling is globally available in the persistent Topbar.
- Having a secondary `<select>` card on the dashboard causes clutter and duplicates existing functionality.
- Clean up unused `Paintbrush` import and `setTheme` state hook.

## Execution Log
- **2026-09-28T13:53:40+05:30**: Initialized step 18 record and verified targets in `Dashboard.tsx`.
- **2026-09-28T13:53:50+05:30**: Removed the redundant "Appearance & Theme" SettingsCard, the unused `Paintbrush` icon, and the unused `setTheme` hook from `Dashboard.tsx`.
- **2026-09-28T13:54:14+05:30**: Verified frontend production build (`pnpm run build` -> `tsc && vite build`). Clean compilation with exit code 0.

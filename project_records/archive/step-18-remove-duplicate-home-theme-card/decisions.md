# Decisions - Step 18

## Decision 1: Remove "Appearance & Theme" Card from Dashboard
- **Context**: `Dashboard.tsx` had an "Appearance & Theme" `SettingsCard` in the left column with a dropdown to switch between light and dark mode.
- **Investigation**: The Topbar component (`Topbar.tsx`) already contains a universal, one-click Sun/Moon theme toggle accessible from every single page across the app. The dropdown card on the dashboard was redundant, took up valuable vertical space, and cluttered the layout.
- **Choice**: Remove the entire card, the unused `Paintbrush` icon, and the unused `setTheme` function from the component.

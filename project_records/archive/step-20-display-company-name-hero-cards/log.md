# Step 20: Display Company Name on Hero Banners in Home and Settings

## Objective
1. Remove the arbitrary hardcoded `TVT-A-EC-${selectedClientId}` prefix from `Settings.tsx`.
2. Display the client's actual Company Name (falling back to client ID) in the hero cards of both `Dashboard.tsx` (Home) and `Settings.tsx` (Settings & Policies).
3. Ensure the Client ID is cleanly displayed in the subtitle metadata alongside rate limits and account counters.

## Execution Log
- **2026-09-28T14:35:00+05:30**: Initialized step 20 record and verified target hero components.
- **2026-09-28T14:35:10+05:30**: Updated `Dashboard.tsx` and `Settings.tsx`:
  - Resolved client company name dynamically using `clients` context and company name state.
  - Eliminated the arbitrary `TVT-A-EC-` prefix from `Settings.tsx`.
  - Prominently displayed the Company Name as primary title and cleanly formatted `Client ID: ${id}` in the subtitle.
- **2026-09-28T14:35:25+05:30**: Verified frontend production build (`pnpm run build` -> `tsc && vite build`). Clean compilation with exit code 0.

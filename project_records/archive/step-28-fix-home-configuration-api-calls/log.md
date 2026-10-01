# Step 28 Log - Fix Home Configuration API Calls

- 2026-09-28T19:20:30Z - Initialized step-28 to fix broken API calls in Home.tsx (replace non-existent api.getSettings and api.getFeatures with api.getClientFeatures and api.getEmailAccount).
- 2026-09-28T19:23:20Z - Updated frontend/src/pages/Home.tsx to use api.getEmailAccount, api.getClientFeatures, and api.getAllEmailAccounts, added clients to useEffect dependencies, and properly mapped policy and feature state.

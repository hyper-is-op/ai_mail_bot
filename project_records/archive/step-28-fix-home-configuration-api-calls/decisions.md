# Step 28 Decisions - Fix Home Configuration API Calls

## 1. Context & Problem
`Home.tsx` was querying `api.getSettings(targetCid)` and `api.getFeatures(targetCid)`. Neither function existed on the client API surface. While `Promise.allSettled` shielded the UI from an outright crash, both promises rejected, resulting in fallback default policies instead of real client configurations. Furthermore, `useEffect` lacked `clients` in its dependency array, preventing re-evaluation once client list data loaded.

## 2. Technical Choice
- **Policy Extraction**: Use `api.getEmailAccount(targetCid)` which directly carries `score_threshold`, `response_tone`, and `agent_type`.
- **Feature Extraction**: Use `api.getClientFeatures(targetCid)` (exported via `draftsApi`) to read `feature_auto_send`.
- **Global Scope ("ALL") Handling**: When `selectedClientId === 'ALL'`, leverage `api.getAllEmailAccounts()` (if admin) and allow `getRagDocuments` / `listConnectorConfigs` to fetch global tenant resources without failing.
- **Hook Reactivity**: Added `clients` to `useEffect` dependencies so `loadAllConfigs` updates as soon as the client workspace list finishes hydrating.

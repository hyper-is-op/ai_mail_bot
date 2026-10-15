# Technical Decisions - Step 102: Fix Subpath Base URL and Routing for Nginx Reverse Proxy

## 1. Relative Asset Base (`base: './'`) in Vite
- **Choice**: Configured `base: './'` in `vite.config.ts`.
- **Rationale**: The application is deployed under a subpath `/Smart_Mail_Agent/` behind Nginx instead of root `/`. Without a relative base, HTML emits `/assets/...` which hits `/var/www/html/assets` (non-existent, returning 404), breaking script and stylesheet loading and causing a white screen.

## 2. Restoring `config.js` in `index.html`
- **Choice**: Re-added `<script src="./config.js"></script>` to `index.html`.
- **Rationale**: The build environment needs runtime configurable endpoints (`API_URL`, `WS_URL`, `BASENAME`) without rebuilding code.

## 3. Explicit React Router BASENAME
- **Choice**: Configured `BASENAME: "/Smart_Mail_Agent"` in `/var/www/html/Smart_Mail_Agent/config.js`.
- **Rationale**: `App.tsx` reads `window.__APP_CONFIG__?.BASENAME` to pass to `<Router basename={...}>`. Without this, React Router checks paths against root `/` (e.g., looking for `/login` instead of `/Smart_Mail_Agent/login`), failing to match routes and rendering an empty route view.

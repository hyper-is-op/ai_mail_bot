# Step 142 Decisions: Production Sync & Deployment Strategy

## 1. Preservation of Web Root Subpath Routing (`config.js`)
- **Context**: In Step 102, React Router subpath navigation was resolved by adding `BASENAME: "/Smart_Mail_Agent"` to runtime config in `/var/www/html/Smart_Mail_Agent/config.js`.
- **Options**:
  1. Overwrite web root with standard frontend build files (which default to root `/`).
  2. Selectively deploy build output (`index.html` + `assets/*`) while strictly preserving `/var/www/html/Smart_Mail_Agent/config.js`.
- **Decision**: Option 2. Preserving `config.js` prevents 404 routing crashes and broken assets when accessing the frontend at `http://172.16.3.215/Smart_Mail_Agent/`.

## 2. Stale Asset Purging in `/var/www/html/Smart_Mail_Agent/assets/`
- **Context**: Previous builds left legacy chunks (`index-Co8xsKA7.js`, `index-kJ5uIDLg.css`, `index-CPgZvGmr.js`, `index-DiN-GRIX.css`) accumulating in `assets/`.
- **Decision**: Explicitly deleted obsolete assets upon deploying new hashed bundle (`index--8EETgOw.js`, `index-CceJZypa.css`), ensuring clean git tracking and preventing outdated caching or disk bloat.

## 3. Remote Push Restriction on Secondary Repos
- **Context**: Both `/Czentrix/apps/Smart_Mail_Agent_BE` and `/var/www/html/Smart_Mail_Agent` configure HTTPS remotes pointing to `monish8978/...`.
- **Decision**: Per Step 100/101 protocol, local commits are executed (`715cb1e` and `c212bc2` respectively) but non-interactive pushes are avoided to prevent headless credential hangs. The primary source repo `ai_mail_bot` was pushed cleanly to GitHub via configured SSH authentication (`34e2745`).

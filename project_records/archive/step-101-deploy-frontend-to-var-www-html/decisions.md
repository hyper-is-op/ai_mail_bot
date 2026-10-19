# Technical Decisions - Step 101: Deploy Production Frontend Build to /var/www/html/Smart_Mail_Agent

## 1. Web Document Root Deployment Target
- **Choice**: Deployed the compiled production distribution from `/home/hyper_is_op/Smart_Mail_Agent_FE/dist/` into `/var/www/html/Smart_Mail_Agent/`.
- **Rationale**: `/var/www/html/Smart_Mail_Agent` is the active web server document root serving end users. It was stagnant since September 30 (bundles `index-DZAs_qWP.js` / `index-BeDs26d2.css`).

## 2. Directory Ownership and Obsolete Bundle Cleanup
- **Choice**: Adjusted permissions to user `hyper_is_op:hyper_is_op` and deleted dead bundle hashes (`index-DZAs_qWP.js`, `index-BeDs26d2.css`).
- **Rationale**: Purging orphan assets prevents cache pollution and disk clutter. Retained active bundle pair `index-Co8xsKA7.js` (1.35MB) and `index-kJ5uIDLg.css` (73kB).

## 3. Git Versioning in Web Root
- **Choice**: Tracked deployment changes directly in the local Git repository at `/var/www/html/Smart_Mail_Agent` with commit `3d50ab1`.
- **Rationale**: Provides instant revision tracking and rollback safety directly inside the web document root.

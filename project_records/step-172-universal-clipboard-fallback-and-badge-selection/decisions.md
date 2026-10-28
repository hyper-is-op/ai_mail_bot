# Decisions: Universal Clipboard Fallback and Badge Selection

## Problem
When accessing the web app over plain HTTP via LAN IP (e.g. `http://172.16.3.215:1947/inbox`), `window.isSecureContext` evaluates to `false`. Modern browser security models restrict `navigator.clipboard` to secure origins (HTTPS or localhost). Direct invocation of `navigator.clipboard.writeText()` throws `TypeError: Cannot read properties of undefined (reading 'writeText')`. Additionally, `ReferenceBadge` used `select-none`, preventing users from highlighting or manually copying IDs.

## Alternatives Considered
1. **Require HTTPS or SSH port forwarding exclusively**:
   - *Pros*: Keeps code unchanged.
   - *Cons*: Unrealistic in intranet / development / local network staging environments where developers and operators access internal IPs over HTTP.
2. **Universal Clipboard Fallback with ExecCommand**:
   - *Pros*: Detects if `navigator.clipboard?.writeText` is available and succeeds; gracefully falls back to an offscreen `<textarea>` with `document.execCommand('copy')` on insecure contexts or permission rejections.
   - *Decision*: Adopt Universal Clipboard Fallback in a shared utility `frontend/src/lib/clipboard.ts` and wire it into `ReferenceBadge`, `Tickets`, `AiProcessing`, and `KnowledgeBase`.
3. **Badge Text Selection and Direct Click-to-Copy**:
   - *Pros*: Remove `select-none` from `ReferenceBadge`, make the ID text selectable, and allow clicking the badge body (or its copy icon) to trigger the copy action with visual feedback.

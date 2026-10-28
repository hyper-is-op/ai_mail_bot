# Step 181 Decisions: Fix Login 401 Redirect Loop

## 1. Login Endpoint Exception in Auth Interceptor
- **Problem**: When a user submits bad credentials on `/login`, backend returns 401 Unauthorized. The generic HTTP client interceptor (`handleAuthFailure`) treated all 401s as expired active sessions and forced a redirect.
- **Decision**: Exclude requests to `/login` from automatic session eviction redirects. A 401 on login is an invalid credential error intended to be handled and displayed by the login form.

## 2. Subpath and Basename Awareness
- **Problem**: `handleAuthFailure` compared `window.location.pathname !== '/login'` and redirected to hardcoded `'/login'`. On production (`http://172.16.3.215/Smart_Mail_Agent/login`), the pathname is `/Smart_Mail_Agent/login`, making the condition true and triggering a jump to root `/login`, which Nginx redirected back to `/Smart_Mail_Agent/login` via 301, refreshing the page.
- **Decision**: Read `window.__APP_CONFIG__?.BASENAME` (defaulting to empty string). Verify if current pathname ends with `/login` or equals `${basename}/login`. If redirecting for genuine session expiry on protected pages, navigate to `${basename}/login`.

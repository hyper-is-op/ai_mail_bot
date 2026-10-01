# Step 21 Decisions - Split Home and Dashboard

## Context & Rationale
1. User requested removing the "Settings" text label next to the C-Zentrix logo in the sidebar header while preserving the C-Zentrix logo.
2. User requested separating Home and Dashboard:
   - **Dashboard (`/dashboard`)**: Dedicated unified analytics hub combining Email Traffic Telemetry and LLM Token/Latency/Cost metrics (absorbing `/llm-analytics`). Default post-login landing page.
   - **Home (`/home`)**: Dedicated configuration overview portal (Option A) displaying high-level readiness and health across the 4 core pillars (Mailbox Accounts, Knowledge Base/RAG, Integrations/Webhooks, and Policies/Safety Gates) with deep links to their detail pages.

## Architectural Choices
- **Route Distribution**:
  - `/` redirects to `/dashboard` (Analytics & Operations).
  - `/dashboard` provides segmented tab views: "Email Traffic & Operations" and "LLM & AI Model Telemetry".
  - `/home` hosts the new `Home.tsx` Configuration Overview Portal.
  - `/llm-analytics` is absorbed into `/dashboard` and its standalone link removed from the sidebar.
- **Sidebar Header**:
  - C-Zentrix logo retained; "Settings" span removed; mobile drawer dismiss button intact.

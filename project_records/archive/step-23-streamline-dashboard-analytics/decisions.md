# Step 23 Decisions - Streamline Dashboard Analytics

## Context & Rationale
Now that `Home.tsx` is established as the central Configuration Hub (covering Mailbox Accounts, Knowledge Base, Webhooks, and Policies), having "Recommended settings" and "Configure Policies" on the Dashboard was redundant clutter. Furthermore, key operational numbers (`pending_emails`, `failed_emails`, `tickets_generated` count, and `orders_tracked`) returned by the API were either hidden or crammed into text subtitles.

## Changes Made
1. **Removed**:
   - "Recommended settings" card linking to config pages (already on `Home.tsx`).
   - "Configure Policies" button from the analytics hero.
   - Fake percentage fallbacks (`90%`, `10%`, `88%`).
2. **Added**:
   - 5 dedicated KPI Metric Cards across the top:
     1. Total Ingested
     2. AI Automated Replies (with Auto-Reply %)
     3. Pending Review Queue (with deep link to `/drafts`)
     4. Escalated Tickets (with deep link to `/tickets`)
     5. Failed Ingestion/Sending (with deep link to `/inbox`)
   - Expanded Telemetry Volume Chart spanning a prominent 2/3 width paired with an **Operational Resolution Funnel** showing exact percentage shares for Auto-replied, Escalated, Pending, and Failed.

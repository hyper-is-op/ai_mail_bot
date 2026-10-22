# Decisions: Inbox Threading and Triage Improvements

## 1. Thread Grouping Identifier
- **Options Considered:**
  1. Continue using `${sender}::${normalizeSubject(subject)}` exclusively.
  2. Use `email.thread_id` as primary grouping key, with fallback to `${sender}::${normalizeSubject(subject)}` only when `thread_id` is missing.
- **Decision:** Option 2. The backend already tracks RFC-compliant thread identifiers (`th_...`). Using `thread_id` prevents distinct customer interactions with generic subjects from getting collided into one massive thread.

## 2. Card Preview Content Priority
- **Options Considered:**
  1. Always show raw email body snippet.
  2. Prioritize AI-generated thread summary if available, and if falling back to email body, strip email quotation chains (`On ... wrote:`, `-----Original Message-----`, lines starting with `>`).
- **Decision:** Option 2. Greatly increases signal-to-noise ratio in the sidebar list.

## 3. Fast Triage via Sidebar Hover Quick Actions
- **Options Considered:**
  1. Require operators to open the thread detail view for all actions.
  2. Provide one-click hover actions on sidebar cards (Approve Draft for Pending Review, Toggle Marketing Sender, Toggle Pause Automation).
- **Decision:** Option 2. Enables high-velocity triage directly from the inbox list.

## 4. Polling Cadence and WebSocket Synergy
- **Options Considered:**
  1. Unconditional 3.5-second polling of all tables.
  2. Event-driven WebSocket refreshes with a relaxed 15-second fallback poll when WebSocket is disconnected, combined with `useMemo` for thread grouping.
- **Decision:** Option 2. Drastically reduces frontend CPU usage and backend DB query hammering.

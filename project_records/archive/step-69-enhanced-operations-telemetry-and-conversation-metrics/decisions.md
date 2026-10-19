# Technical Decisions - Step 69: Enhanced Operations Telemetry and Conversation Metrics

## 1. Latency & Execution Time Architecture
- **Distinction between LLM and End-to-End Latency**: The prompt requested Average Latency (Lowest, Highest, Total) and Execution Time per mail. We leveraged `llm_logs.latency_ms` correlated with `email_logs.id` to compute real end-to-end task inference and pipeline runtimes (`total_execution_ms`, `avg_latency_ms`, `min_latency_ms`, `max_latency_ms`).
- **Time to First Action (MTTA)**: We scoped initial action latency by isolating records where `troubleshooting_step <= 1` or `troubleshooting_step IS NULL`, calculating `avg_ms`, `min_ms`, and `max_ms` to reflect prompt response time to incoming customer messages.

## 2. Inbound Health, Velocity, and Classification
- **Explicit Spam Separation**: Disentangled `status = 'spam'` / intent `'spam'` from administrative `'blocked'` addresses, giving operators distinct visibility into promotional, spam, and blocked traffic.
- **Velocity Metrics**: Computed active day cadence across trailing 30 days (`avg_daily_inbound`) and trailing 30-day aggregate volume (`monthly_inbound_volume`).

## 3. Conversation Turnaround: Completed vs Incomplete
- **Completed Threads**: Aggregated multi-turn dialogues where `conversation_closed = 1`, `is_resolved = 1`, or final status is `'sent'` / `'ticket_created_and_sent'`. Provided duration metrics (`avg`, `min`, `max`).
- **Incomplete Threads (Active WIP)**: Aggregated open dialogues where `status = 'pending'`, measuring `total_age_sec`, `avg_age_sec`, `min_age_sec`, and `max_age_sec`.

## 4. Resolution Mechanism Timings & Sentiment Range
- **RAG vs Ticket Timing**: Segmented thread resolution durations into autonomous RAG deflection (no human tickets raised) vs ticket escalation (tickets generated), reporting count, average, min, and max turnaround for both.
- **Sentiment Range**: Computed dialogue-level Net Sentiment Score (NSS = `(positive - negative) / total * 100`) alongside raw trajectory counts.

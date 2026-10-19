# Step 82: Decisions - Processing Time / Latency Column

## Technical Choices

1. **Latency Aggregation Metric: Total Thread Latency vs. Average Call Latency**
   - *Options Considered*:
     - A: Single average LLM call latency (e.g. 800ms).
     - B: Total processing duration (sum of LLM execution latency for the thread/email, e.g. 1.85s) with hover tooltip showing average per turn or raw milliseconds.
   - *Choice*: Option B. Operators and managers care about the total turnaround time required to process and respond to the customer's inquiry. Formatting as human-readable seconds (e.g., `1.8s` or `<1.0s` or `1,820 ms`) gives immediate clarity.

2. **Column Placement in Reports**
   - *Choice*: Place "Latency" immediately adjacent to "Tokens" and "Cost" (e.g. `Tokens | Latency | Est. Cost`). This groups the three operational unit-economic metrics together (computation tokens, compute duration, and monetary billing).

3. **CSV Export & Search Scope Integration**
   - *Choice*: Add "Latency (ms)" / "Processing Time (s)" to both Admin and Client CSV exports. Add `latency` to `_build_report_conditions` column scope and include numeric matching in universal search.

# Decisions: Add Token Consumption Column to Reports

## 1. Column Placement & Metrics
- **Decision**: Position the `Tokens` column immediately adjacent to `Cost` (between `Sentiment Score` and `Cost`).
- **Reasoning**: Grouping `Tokens` with `Cost` pairs resource consumption directly with financial expenditure, presenting cohesive unit economics in the table.
- **Granularity**: Aggregate `total_tokens = SUM(prompt_tokens + completion_tokens)` at the thread level, with secondary breakdown (`prompt_tokens`, `completion_tokens`) exposed in hover tooltip and detailed CSV export.

## 2. Search & Filtering Integration
- **Decision**: Integrate `tokens` into `_build_report_conditions` as both a scoped search target (`search_field="tokens"`) and within the universal multi-column search fallback when numeric queries are supplied.

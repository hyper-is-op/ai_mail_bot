# Decisions - Step 70: Deduplicate Email Operations Dashboard

## 1. Remove Top Header Daemon & Mailbox Badges
- **Options Considered**:
  - Keep badges in both top header and the dedicated Live Ingestion Pipeline strip.
  - Remove from header and rely entirely on the dedicated strip.
- **Reasoning**:
  - Having daemon heartbeat and mailbox sync in the header bar crowded the title and auto-refresh selector on smaller viewports, while presenting incomplete telemetry (no queue depth or ingestion lag).
  - The dedicated Live Ingestion Pipeline strip directly below the filter controls is significantly more informative and visually cohesive.

## 2. Consolidate Turnaround Time Telemetry
- **Options Considered**:
  - Retain the standalone `Avg Turnaround Time` tile alongside `Completed Conversations` breakdown.
  - Remove the standalone tile and convert the subrow to a 2-card grid (`Avg Resolution Turns` and `Active WIP Inquiries with SLA Aging`).
- **Reasoning**:
  - The `Completed Conversations` card immediately above already displays Avg, Min, Max, and Count. Showing `Avg Turnaround Time` again in the next row was an exact duplicate of the same metric.
  - A 2-column grid creates clean vertical balance with the 2-column turnaround and resolution timing cards above it.

## 3. Remove Intent Tag Cloud in CRR Card
- **Options Considered**:
  - Keep pill tags in the CRR card and the full table below it.
  - Remove pill tags from the CRR card and let the Technical Intent Automation & Deflection Matrix serve as the single source of truth for intent attribution.
- **Reasoning**:
  - The pill tags showed raw ticket counts by intent without deflection rates, volume context, or primary escalation triggers.
  - The comprehensive Intent Matrix table is located directly beneath the section, making the pills redundant visual noise.

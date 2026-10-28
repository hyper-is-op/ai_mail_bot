# Decisions - Step 173: Hybrid Ticket Description Formatting and UI Configuration

## 1. Description Formatting Strategy
- **Options Considered**:
  1. *Pure LLM Summary (`{{history_summary}}` or `{{issue_description}}` only)*: Replaces conversation history completely with a synthesized paragraph.
  2. *Raw Uncondensed Log (`{{conversation_history}}` only)*: The baseline behavior where 30-line bot diagnostic prompts create walls of text and consume 85% of character budget.
  3. *Hybrid Model (Executive Summary at top + Condensed Transcript below)*: Combines `{{history_summary}}` for a 5-second human triage with a condensed audit trail below.
- **Decision**: Option 3 (Hybrid Model). Guarantees human agents see an immediate overview of the issue and status while preserving verbatim customer quotes and troubleshooting history for technical auditability.

## 2. LLM Expense and Latency Control
- **Options Considered**:
  1. *Include both `{{history_summary}}` and `{{issue_description}}`*: Executes two sequential LLM calls in `resolve_expensive_keys()`, adding 2.5–3.5s latency to ticket creation.
  2. *Include only `{{history_summary}}` in the default hybrid header*: Executes a single LLM call (+1.2s), providing both the customer inquiry and current diagnostic status without redundancy.
- **Decision**: Option 2. Avoids unnecessary latency doubling while still providing complete executive context.

## 3. UI Format Switcher Design
- **Options Considered**:
  1. *Manual JSON Editing in Textarea*: Requires users to escape `\n` manually. Prone to `JSONDecodeError: Invalid control character`.
  2. *1-Click Preset Format Selector in Connector Editor Modal*: Adds a segmented button selector (`Hybrid`, `Detailed Log`, `Summary Only`) that programmatically parses and updates the `description` key in `formData.request_template` via safe JSON mutation.
- **Decision**: Option 2. Prevents JSON syntax breakages and invalid control character errors.

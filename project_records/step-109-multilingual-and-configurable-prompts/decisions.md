# Decisions: Step 109 — Multilingual Support and Configurable Prompts

## 1. Unified Prompt Registry vs Fragmented Configurations
- **Decision**: Centralized all 11 prompt touchpoints into a unified registry schema (`client_prompt_configs` table in MySQL) with code defaults in `app/prompt_defaults.py`.
- **Reasoning**: Storing prompts in `.env` is brittle for multi-line texts and fails in multi-tenant environments. A database table with fallback to tested Python constants ensures zero downtime, hot-reloading without restarts, and instant rollback via deletion of the override row.

## 2. Route Through LLM (Option A) vs Static Translation
- **Decision**: Replaced all hardcoded English string templates for ticket closures and status pings in `drafter.py` with dynamic LLM generation using prompt templates.
- **Reasoning**: Static English templates leaked English replies to customers writing in non-English languages. Routing through the LLM with the universal multilingual directive enables natural replies in the customer's native language.

## 3. Universal Multilingual Directive Injection
- **Decision**: Embedded the explicit language mirroring instruction into all customer-facing prompt templates and agent instructions.
- **Reasoning**: Directs the LLM to mirror the language of incoming messages while keeping proper nouns, order IDs, and CRM ticket tracking links untouched.

## 4. Prompt Studio UI Integration
- **Decision**: Added a dedicated "Prompts" tab in Settings featuring category navigation, prompt editing, clickable variable chips, and single/all factory reset actions.
- **Reasoning**: Gives non-developer administrators full control over bot personas and instructions without requiring code updates or deployments.

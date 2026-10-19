# Architectural & Technical Decisions - Step 141

## 1. Thread Summarization: Natural Language vs Telegraphic Shorthand
- **Context**: The existing summarizer prompt explicitly mandated "concise, telegraphic phrasing (drop unnecessary articles like 'the'/'a' and use semicolons to separate Problem; Status; Next/Last Step)". When repeated across multi-turn exchanges, this caused the LLM to accumulate tally markers ("(12x, overviews sent)"), passive-aggressive annotations ("customer keeps re-asking"), and choppy robot grammar.
- **Decision**: Overhaul the prompt in `app/llm_functions/summaries.py` to require fluent, professional English (1–2 sentences, 140–220 characters). Explicitly forbid tally counters, repetitive listings, and telegraphic semicolon chains. In `worker/tasks.py`, isolate prior message queries by `thread_id` so unrelated threads from the same sender do not contaminate summaries.

## 2. Customer Sentiment & AI-Inferred CSAT: Client Panel Gating
- **Context**: The user asked what "Customer Sentiment & AI-Inferred CSAT" is and whether it is helpful.
- **Analysis**: The metric is not a real user survey CSAT; it is a synthetic heuristic combining CRR deflection and LLM sentiment classification (`3.2 + 1.3*(CRR/100) + 0.5*(pos/(pos+neg)) - 0.8*(neg/total)`). Presenting a 5-star rating (★ 4.8 / 5.0) to clients creates a misleading illusion of customer survey responses.
- **Decision**: Gate the card behind `isAdmin` in `Dashboard.tsx`. For clients (`!isAdmin`), hide the card and expand the adjacent CRR deflection card to full 12-column width (`lg:col-span-12`).

## 3. LLM Analytics Tab Streamlining
- **Context**: The user requested removing "Guardrail Tax vs Productive Generation" from client view (keep in admin), removing Multi-Provider Breakdown, Model Volume Breakdown, and removing the Provider column from Granular Execution Logs.
- **Decision**:
  1. Gate "Guardrail Tax vs. Productive Generation" and the top Unit Economics guardrail badge behind `isAdmin`.
  2. Remove the "Multi-Provider Token & Cost Breakdown" section (100% of calls run on Groq).
  3. Remove the "Model Volume & Cost Breakdown" section and render "Subsystem Node Volume & Costs" as a clean full-width card.
  4. Remove the `Provider` column from the "Granular Execution Logs & Thread Attribution" table and remove the redundant `Provider` filter dropdown.

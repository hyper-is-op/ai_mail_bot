# Step 187 Technical Decisions

## Decision 1: Defense-in-Depth for Clean Plain Text (Prompting + Code Sanitization)
- **Options Considered:**
  1. *Prompt-Only:* Instruct the model in `agent_system_prompt` not to use pipes or markdown asterisks.
     - *Risk:* LLMs frequently regress to markdown syntax or copy markdown table structures from tools or conversational habits, producing occasional unformatted syntax artifacts.
  2. *Post-Processing Sanitizer in `app/llm_utils.py` + Prompt Guidance:*
     - Update prompt to teach the model clean plain-text conventions.
     - Add a deterministic sanitizer `strip_markdown_decorations` in `app/pipeline/agent.py` before evaluator scoring to guarantee that even if an LLM emits a table or bold tokens, they are converted into clean `- Key: Value` format and stripped of `|` and `**`.
- **Choice:** Option 2. Guarantees deterministic zero-markdown output while steering the model upfront to minimize unnecessary regex alterations.

## Decision 2: Sanitizer Placement Before Evaluator Scoring
- **Options Considered:**
  1. *Sanitize only at mail dispatch (`app/mailer.py`):* Evaluator scores the raw markdown draft, but sent email is stripped.
     - *Risk:* Discrepancy between what the evaluator scored and what was actually sent; logs and frontend review would show uncleaned text.
  2. *Sanitize in `app/pipeline/agent.py` before evaluator:*
     - The sanitized draft is what is evaluated, scored, logged in database (`email_logs`, `draft_emails`), and dispatched.
- **Choice:** Option 2. Maintains single source of truth across scoring, database records, UI inspection, and outbound SMTP delivery.

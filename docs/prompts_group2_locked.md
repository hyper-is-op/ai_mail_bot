# Group 2: Locked Internal Engine Prompts

These are the 6 internal prompts hardcoded directly into the application's Python source code.
They are **locked** and cannot be modified via the UI/API because their outputs are strictly bound to downstream JSON parsers, database column sizes, scoring thresholds, and critical error-handling logic.

---

## 1. Intent Classification System Prompt
- **Source File**: [`app/llm_functions/intent.py`](file:///home/hyper_is_op/mail_ai_automation/app/llm_functions/intent.py#L15)
- **Function**: `detect_intent_llm(query)`
- **Why it is locked**: Forces a rigid JSON schema (`intent`, `ticket_ids`, `sentiment`, `priority`). Any change to keys or formatting breaks the JSON deserializer and halts automated email routing.
- **Prompt Content**:

```text
You are a query classifier. Your only job is to analyze the user query and return structured JSON.

## Task
Classify the query into exactly one intent, extract ALL ticket_ids/order_ids if present, perform sentiment analysis, and assign a priority level.

## Intents
- `issue_resolved`: Customer explicitly indicates that their problem, issue, ticket, or inquiry has been resolved, fixed, sorted out, is working fine now, or they no longer need assistance (with no new questions or pending problems).
- `off_topic_nonsense`: Standalone greetings/casual openers with no issue described (e.g. "hello", "hi there", "hello ladies", "hey guys", "good morning"), unintelligible gibberish, keyboard mash, spam, test text, blank/random characters, or completely off-topic emails unrelated to company support, products, or services.
- `ticket_create`: User is explicitly asking to create, open, raise, or log a new ticket/complaint/case, or asking support to create a ticket for their issue
- `ticket_status`: User is asking about status of an existing ticket, order, complaint, delivery, or support request
- `marketing_promotional`: Marketing email, promotional campaign, newsletter, job alert blast, webinar invite, discount/sale offer, automated digest, or educational course advertisement (requiring no customer support action)
- `general_query`: Genuine customer support query, product question, policy inquiry, technical issue, or problem description requiring an answer (MUST contain an actual question, problem, or inquiry).

## Sentiment Analysis
Classify user sentiment into exactly one of: `Angry`, `Neutral`, `Happy`.

## Priority Tagging
Classify priority level into exactly one of: `Critical`, `High`, `Medium`, `Low`.

## Output Format
{
  "intent": "issue_resolved" | "off_topic_nonsense" | "ticket_create" | "ticket_status" | "marketing_promotional" | "general_query",
  "ticket_ids": ["<id1>", "<id2>"] | [],
  "sentiment": "Angry" | "Neutral" | "Happy",
  "priority": "Critical" | "High" | "Medium" | "Low"
}

## User Query
{query}
```

---

## 2. Issue Description Extraction Prompt
- **Source File**: [`app/llm_functions/summaries.py`](file:///home/hyper_is_op/mail_ai_automation/app/llm_functions/summaries.py#L25)
- **Function**: `extract_issue_description(body, history)`
- **Why it is locked**: Strips email boilerplate and extracts a concise 2–3 sentence problem statement used directly as the `problem_description` payload for external ticketing connectors (Zoho Desk).
- **Prompt Content**:

```text
You are a support ticket assistant. Extract a clean, concise problem description
from the customer email below.

## Rules
- Return 2–3 sentences maximum.
- Use only information present in the email body.
- Strip greetings, sign-offs, pleasantries, and email-thread boilerplate.
- Strip any prior quoted/forwarded content.
- Do NOT invent or infer details not stated by the customer.
- Return ONLY the plain description text. No labels, no JSON, no markdown.

{history_block}

## Customer Email Body
{body}
```

---

## 3. Issue Summary Generator (250-Character Limit)
- **Source File**: [`app/llm_functions/summaries.py`](file:///home/hyper_is_op/mail_ai_automation/app/llm_functions/summaries.py#L103)
- **Function**: `generate_summary_llm(context, customer_body, history, old_summary)`
- **Why it is locked**: Must strictly fit into MySQL `VARCHAR(255)` columns in `email_logs.summary`. Also updates existing summaries dynamically across multi-turn email threads.
- **Prompt Content**:

```text
You are a support ticket summariser.
Generate a concise summary of the customer's issue in 250 characters or less.

## Rules
- Maximum 250 characters — hard limit, no exceptions.
- Plain text only. No bullet points, no labels, no JSON, no markdown.
- Capture: what the problem is, current status if known, any resolution steps taken.
- If an existing summary is provided, update it with new information — do not repeat it verbatim.
- Do NOT include customer name, ticket ID, or email address.
- Do NOT invent details not present in the sources below.

{old_summary_block}

## Conversation History
{history_block}

## Ticket / API Context
{context}

## Current Customer Email
{customer_body}

Return ONLY the plain summary text. Nothing else.
```

---

## 4. Quality & Safety Evaluator Scoring Prompt
- **Source File**: [`app/scoring.py`](file:///home/hyper_is_op/mail_ai_automation/app/scoring.py#L14)
- **Function**: `llm_score(reply, query)`
- **Why it is locked**: Primary safety gateway. Enforces a single integer score (0–100) determining whether an AI draft is automatically delivered to the customer (score >= threshold) or held in `draft_emails` for human review.
- **Prompt Content**:

```text
You are a STRICT evaluator for customer support email replies.

Evaluate the reply based on the query.

Scoring Rules:
- 90-100 → Perfect, accurate, complete, very helpful
- 70-89 → Good but slightly incomplete
- 50-69 → Average, vague or partially helpful
- 30-49 → Poor, unclear or missing key info
- 0-29 → Wrong, irrelevant, or hallucinated

STRICT PENALTIES:
- If reply does NOT answer the query → score MUST be below 50
- If reply is generic → max 70
- If wrong info → below 40
- If order query but no order details → max 60
- If tone is bad → subtract heavily

Checklist:
1. Does it answer the query?
2. Is it specific (not generic)?
3. Is it correct?
4. Is it helpful?
5. Is tone professional?

Query:
{query}

Reply:
{reply}

Return ONLY a number between 0 and 100.
```

---

## 5. Closed/Resolved Ticket Responder Prompt
- **Source File**: [`app/pipeline/drafter.py`](file:///home/hyper_is_op/mail_ai_automation/app/pipeline/drafter.py#L93)
- **Function**: `handle_ticket_status_inquiry(...)` (Closed/Resolved path)
- **Why it is locked**: Generates localized replies when an inbound customer inquires about a ticket that is already closed in the CRM.
- **Prompt Content**:

```text
Write a polite email reply to {customer_name} regarding support ticket #{display_ticket_id}.
CRITICAL MULTILINGUAL INSTRUCTION:
- Detect the customer's language from their incoming message and reply in that EXACT SAME language.
- The ticket currently has status: '{raw_status}' (Closed / Resolved).
- Inform them that ticket #{display_ticket_id} is already marked as '{raw_status}'. If they still need help, they can reply directly.
- Conclude with:
{signoff_text}

Write ONLY the final plain text email.
```

---

## 6. Active Ticket Status Update Prompt
- **Source File**: [`app/pipeline/drafter.py`](file:///home/hyper_is_op/mail_ai_automation/app/pipeline/drafter.py#L136)
- **Function**: `handle_ticket_status_inquiry(...)` (Active path)
- **Why it is locked**: Handles recurring status checks for tickets under active investigation. Injects live connector tracking links if available.
- **Prompt Content**:

```text
Write a prompt, courteous status update email to {customer_name}.
CRITICAL MULTILINGUAL INSTRUCTION:
- Detect the customer's language from their incoming message and reply in that EXACT SAME language.
- Ticket Reference: #{display_ticket_id}
- Current Status: '{raw_status}'
{tracking_block}
- Inform them their ticket is currently in '{raw_status}' status and actively under review.
- Conclude with:
{signoff_text}

Write ONLY the final plain text email.
```

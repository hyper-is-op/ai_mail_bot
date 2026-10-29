# Step 188 Technical Decisions

## Decision 1: Exclusion of "Next Steps" and Inclusion of Ticket ID Alongside Docket No
- **Context:**
  The user explicitly asked to omit the line:
  `- Next Steps: Your ticket is open and awaiting review. Please reply to the existing ticket with any additional details or error messages to help speed up resolution.`
  Earlier tests showed that if the reply only contains `- Docket No: #212` without the customer's queried Ticket ID `#275424000000661001`, the quality evaluator (`llm_score`) penalizes the draft heavily (dropping the score to 33-59) under the penalty rule for failing to answer the customer's referenced inquiry.
- **Choice:**
  1. Mandate that Docket No is paired directly with the Ticket ID: `- Docket No: #<docket_no> (Ticket ID: <ticket_id>)`.
  2. Display Status: `- Status: <status>`.
  3. Display Issue Overview: `- Issue Overview: <issue_summary>`.
  4. Explicitly ban the "Next Steps" bullet point and any speculative boilerplate process commentary.
- **Outcome:**
  Live evaluation with Zoho ticket `#275424000000661001` scored 92 with decision `auto_send`, satisfying both the user's requirement (no Next Steps line) and the quality evaluator threshold (score >= 80).

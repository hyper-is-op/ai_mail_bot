# Step 01: Remove Markdown from LLM Replies
- **Timestamp:** 2026-09-16 16:11 IST
- **Action:** Updated prompts in `app/llm_functions/replies.py`
- **Details:** Added explicit requirements/instructions to generate plain text only and avoid markdown formatting in `generate_reply_llm`, `generate_issue_resolved_reply`, and `generate_off_topic_reply` functions to prevent rendering issues in plain text email clients like Gmail.

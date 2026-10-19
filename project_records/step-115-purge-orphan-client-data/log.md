# Step 115: Purge Orphan Client Data

## 2026-10-15T17:49:20+05:30
- User explicitly confirmed preserving Admin (`mdyazdani0143@gmail.com` / `CLI-EE3A2268`) and primary Client (`md.yazdani@c-zentrix.com` / `CLI-4159FFCF`).
- Purging all orphan client data (`CLI-7CEC9154`, `CLI-425589BC`, `CLI-EEF97F08`, `CLI-DFD9974C`) across MySQL tables:
  - `email_accounts`
  - `email_logs`
  - `chat_history`
  - `llm_logs`
  - `draft_emails`
  - `client_prompt_configs`
  - `general_settings`
- Purging orphan client points from Qdrant vector collection `mail_ai_knowledge`.

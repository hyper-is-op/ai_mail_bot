# Technical Decisions - Step 115

## Purge of Orphan Client Data and Consolidation

- **Context**: The system was generating duplicate outbound email replies because the mailbox `2202103_cse@gita.edu.in` was registered across multiple client tenants (`CLI-4159FFCF` and orphan tenant `CLI-7CEC9154`). Additionally, obsolete demo tenants had fragmented records.
- **Action Taken**:
  - Confirmed and preserved Admin (`mdyazdani0143@gmail.com` / `CLI-EE3A2268`) and Primary Client (`md.yazdani@c-zentrix.com` / `CLI-4159FFCF`).
  - Purged 112 orphan rows from `email_logs`, 376 orphan rows from `llm_logs`, 6 rows from `draft_emails`, and orphan entries from `email_accounts`.
  - Purged 37 orphan vector points from Qdrant collection `mail_ai_knowledge`, leaving exactly the 36 authentic C-Zentrix knowledge base chunks for `CLI-4159FFCF`.
  - Restarted `mail_ai_worker`, `mail_ai_listener`, and `mail_ai_api` containers to re-initialize IMAP listener loops.

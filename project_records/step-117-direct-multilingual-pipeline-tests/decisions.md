# Architectural Decisions - Step 117

## 1. Direct Script Injection vs Live IMAP Testing
- **Context**: The user requested testing across 5 categories in 3 languages (English, Hinglish, Devanagari Hindi). Running 15-20 live email cycles over IMAP would take ~30-45 minutes and spam the user's real mailbox.
- **Decision**: Created `tests/run_multilingual_tests.py` using direct pipeline execution against real Groq LLM inference, live Qdrant vector retrieval, and live Zoho Desk connector APIs while suppressing physical SMTP transmission. Completed all 15 scenarios in 125 seconds.

## 2. Multilingual Resolution Detection Patterns
- **Context**: Stress-testing revealed that `check_customer_resolution` in `app/pipeline/agent.py` only recognized English phrases (`it worked`, `issue fixed`, `working fine`). When a customer replied in Hinglish ("ab audio theek chal raha hai, thank you issue solve ho gaya hai") or Hindi ("बहुत धन्यवाद, अब समस्या हल हो गई है"), resolution was not detected (`is_resolved=False`). Because RAG was not re-queried on a resolution turn, the evaluator triggered the zero-context hard floor and created an unwanted CRM ticket.
- **Decision**: Added bilingual regex patterns to `RESOLUTION_PATTERNS`:
  - Hinglish: `\b((issue|problem|samasya)\s+(solve|theek|fixed)\s+ho\s+(gaya|gayi)|(kaam|audio|call|phone|system|login)\s+(theek|chal|kaam\s+kar)\s+raha\s+hai|theek\s+ho\s+gaya|chal\s+gaya|kaam\s+ho\s+gaya|kaam\s+kar\s+raha\s+hai|sab\s+theek\s+hai|solve\s+ho\s+gaya|solve\s+ho\s+gayi)\b`
  - Devanagari: `(समस्या\s+(हल|ठीक)\s+हो\s+गई|समाधान\s+हो\s+गया|ठीक\s+(हो\s+गया|चल\s+रहा\s+है|काम\s+कर\s+रहा\s+है)|हल\s+हो\s+गई|काम\s+हो\s+गया|आवाज़\s+आ\s+रही\s+है|काम\s+कर\s+रहा\s+है)`
  Eliminates false ticket escalations on customer confirmation across all supported languages.

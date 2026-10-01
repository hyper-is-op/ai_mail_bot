---
trigger: always_on
---

USING PROJECT RECORDS: Before starting any new discrete task, and before 
making any technical decision, you must check `project_records/` for 
relevant history. Do not skip this to save time.

WHEN TO CHECK
- Before starting a new task: read `project_records/index.md` to see 
  what's already been done, in case it's related or overlaps.
- Before making a technical choice (framework, approach, library, pattern): 
  search past `decisions.md` files for similar decisions already made. 
  If one exists, follow it for consistency unless there's a clear reason 
  not to — and if you deviate, say why in the new decisions.md.
- Before debugging or fixing something: check if a related past step's 
  `log.md` shows this was already attempted or reverted, to avoid 
  repeating a failed approach.
- If the user asks "why did you do X" or "what have you done so far": 
  answer from `project_records/`, not from memory of the conversation.

HOW TO CHECK
1. Scan `index.md` first — it's the fastest way to see if anything 
   relevant exists before opening individual step folders.
2. Only open specific step folders (log.md / decisions.md / source.md) 
   if index.md suggests relevance. Don't read every folder for every task.

WHAT NOT TO DO
- Do not treat project_records/ as optional context — it is the source 
  of truth for what's already happened in this project, above your own 
  recollection of the conversation.
- Do not edit past records while "using" them — read-only per the 
  IMMUTABILITY RULE in Policy.
---
trigger: always_on
---

FILE OPERATIONS FOR PROJECT RECORDS:

Use your file tools directly — never describe what you would write, 
always write it.

1. CHECK STATE FIRST
   - Read `project_records/index.md`. If it doesn't exist, create it 
     empty and start at step-01.
   - Parse the last `<NN>` entry to determine the next sequential number.

2. FILE CREATION ORDER
   a. Create `project_records/step-<NN>-<slug>/` first.
   b. Write `log.md` with a timestamped entry for each action as it happens 
      — append in real time, don't batch-write at the end of the task.
   c. If a technical choice occurred, write/append to `decisions.md`.
   d. If external references were used, write/append to `source.md`.
   e. Append the one-line summary to `project_records/index.md`. Per the 
      STEP CLOSURE rule in Policy, this write closes the step — no further 
      writes to this folder after it.

3. APPEND, DON'T OVERWRITE
   - Before closure, use append operations on log.md/decisions.md/source.md, 
     not full-file rewrites.
   - After closure (index.md updated), the folder is read-only per the 
     IMMUTABILITY RULE.

4. SLUG GENERATION
   - Derive <slug> from the task objective, 2-4 words, kebab-case, 
     lowercase, no special characters (e.g. "add-auth-middleware").
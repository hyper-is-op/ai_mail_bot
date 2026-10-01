---
trigger: always_on
---

MAINTENANCE & EDGE CASES FOR PROJECT RECORDS:

1. LIFECYCLE / PRUNING
   - When `index.md` exceeds 50 entries, create `project_records/archive/` 
     if it doesn't exist, and move the oldest 30 step folders into it 
     unchanged (do not summarize or alter their contents — immutability 
     still applies).
   - In `index.md`, replace archived entries with a single line: 
     "steps 01-30 archived — see archive/index.md" and maintain a 
     separate `archive/index.md` listing the moved entries.
   - When scanning history per Prompt 3, check `index.md` first; only 
     search `archive/` if the active index has no relevant match and 
     the task explicitly requires older context (e.g. user asks about 
     early project history).

2. CONFLICT RESOLUTION
   - If a past `decisions.md` conflicts with a new user instruction, 
     the user's current instruction always wins — but you must still 
     log the conflict: note in the new step's `decisions.md` that this 
     overrides a prior decision, cite which step it overrides, and why.
   - If two past decisions conflict with each other (e.g. inconsistent 
     history from earlier drift), do not silently pick one. Flag it to 
     the user before proceeding and ask which stands.
   - Never delete or edit the outdated decision — the override is a new 
     entry, the old one stays as historical record.

3. ERROR HANDLING

   PRECONDITION: The STOP/halt behavior below requires the IDE's Review 
   Policy to NOT be set to "Always Proceed" — that mode structurally 
   prevents the agent from pausing for anything. If you are currently 
   running under Always Proceed and a write failure occurs, you cannot 
   silently continue per the old default — instead, halt in the only 
   way available to you: stop all further actions in the current task 
   and output a clearly flagged message to the user in your response 
   text ("⚠ RECORD-KEEPING FAILURE — WORK PAUSED") even if no approval 
   prompt is possible. Do not treat inability to formally pause as 
   permission to proceed silently.

   - If `index.md` is missing, malformed, or unparseable: do not guess 
     the next `<NN>`. Instead, list existing `step-*` folders directly, 
     determine the highest number from folder names, rebuild `index.md` 
     from folder contents (one line per folder, best-effort description), 
     then proceed.
   - If a referenced step folder in `index.md` doesn't exist on disk 
     (deleted externally): mark that line in `index.md` as 
     "[missing: step-NN]" rather than removing the line or halting work.
   - If you cannot write to `project_records/` at all (permissions, 
     disk, etc.): STOP. Do not proceed with the requested task. Tell 
     the user immediately that record-keeping has failed, why, and 
     that work is paused until it's resolved.
   - Record-keeping integrity takes priority over task completion. 
     Do not complete work that would go undocumented.
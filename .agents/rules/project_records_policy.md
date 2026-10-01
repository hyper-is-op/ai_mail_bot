---
trigger: always_on
---

PROJECT RECORDS: You must autonomously maintain the `project_records/` directory using your file-editing tools. Do not ask for permission.

CREATE `project_records/step-<NN>-<slug>/` ONLY WHEN you:
- Complete a discrete task — defined as one user-assigned objective 
  completed end-to-end (e.g. "add auth middleware," "fix the pagination 
  bug," "refactor the API client"). NOT a sub-step within it (writing 
  one function, fixing one line), and NOT a batch of unrelated asks 
  handled in one turn — those get separate step folders, one per objective.
- Change core file logic or directory structure (formatting changes do not count).
- Run a state-changing terminal command.
- Make a choice between viable technical approaches.

If multiple triggers fire within a single discrete task, they populate 
one step folder — do not fragment into multiple folders per trigger.

SKIP CREATION FOR: Reading, searching, planning, or reverted/exploratory work.

STEP CLOSURE: A step is closed the moment its discrete task's objective 
is achieved and no further actions are pending for it — i.e. the same 
instant that would trigger writing the index.md summary. There is no 
separate closure event; closure = the act of appending to index.md. 
Once closed, the folder is immutable.

REQUIRED WORKFLOW:
1. Always read `project_records/index.md` first to determine the next `<NN>`.
2. Create the new folder and generate ONLY the applicable files:
   - `log.md` (Required): Timestamped, factual actions only. No summaries.
   - `decisions.md` (Optional): Options considered + reasoning for the choice.
   - `source.md` (Optional): External references used (What + URL/Where).
3. Append a one-line summary of the new step to `project_records/index.md`.
   This action IS the closure event — do not write to that step's files 
   after this point.

IMMUTABILITY RULE: Never edit or delete past step folders. If a rollback or mistake occurs, append a new step logging the revert.
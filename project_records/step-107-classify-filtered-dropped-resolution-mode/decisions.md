## Technical Decisions: Classifying Filtered / Dropped Outcomes

### Context
Inbound emails halted by pipeline early-exit filters (such as `system_bounce_dropped`, `rate_limited`, `automation_halted`, `blocked_keyword`, `no_action_needed`, `paused`) were falling through SQL query evaluation to `res_mode = 'Processing'` and `status = 'Open'`. For example, thread `th_0d63b490cc65` (a mailer-daemon bounce) was reported as active processing in reports instead of a completed drop.

### Options Considered
- **Option 1: Merge into 'Failed'**
  - *Pros*: Doesn't create an additional mode.
  - *Cons*: Misleading. Filtered drops are intentional and successful suppressions, not errors or worker execution failures.
- **Option 2: Create a distinct 'Filtered / Dropped' resolution mode and 'Dropped' status**
  - *Pros*: Clear, accurate operational telemetry. Distinguishes genuine processing failures from intentional drop rules. Allows dedicated filtering in Reports audit and CSV exports.

### Decision
Adopted **Option 2**.
- SQL `res_mode` classifies these statuses as `'Filtered / Dropped'`.
- SQL `status_label` classifies them as `'Dropped'`.
- Reports dropdown includes `Filtered / Dropped` filter option.
- UI renders neutral zinc badges instead of red failure/error badges.

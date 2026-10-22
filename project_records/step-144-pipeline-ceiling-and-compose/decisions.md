# Step 144: Architectural Decisions

## 1. Optional Compose Profile for MySQL vs Unconditional Service Definition

- **Context**: The completeness audit noted that `mysql` was absent from `docker-compose.yml`, while `db_init.py` runs DDL against an assumed existing database. However, the active production/staging deployment connects to an external host at `172.16.3.215` with database `ai_mail_bot_v2`.
- **Options Considered**:
  1. *Unconditional service definition*: Adding `mysql:8.0` directly to `docker-compose.yml` under standard services.
     - *Tradeoff*: Would cause port 3306 collisions on hosts running native MySQL, or risk silently overwriting `DB_HOST` networking and disconnecting the application from the real database with existing tenant accounts, email logs, and connector credentials.
  2. *Compose profile isolation (`profiles: ["local"]`)*: Defining the service with `profiles: ["local"]`.
     - *Tradeoff*: Standard `docker compose up` continues to use the configured external host database without interference, while developers needing an isolated, self-contained local stack can run `docker compose --profile local up -d`.
- **Decision**: Adopted Option 2 (`profiles: ["local"]`).

## 2. Binding ReAct `max_tool_turns` to `DEFAULT_MAX_TROUBLESHOOTING_STEPS`

- **Context**: `app/pipeline/agent.py` hardcoded `max_tool_turns = 3` in the ReAct loop, while `DEFAULT_MAX_TROUBLESHOOTING_STEPS = 3` was centralized in `app/pipeline/evaluator.py` (and previously adjusted across steps 123, 125, 126).
- **Options Considered**:
  1. *Keep separate configuration constants*: Maintaining independent limits for tool invocations per email turn vs multi-turn troubleshooting steps.
     - *Tradeoff*: Risky divergence where the diagnostic evaluator expects N turns of diagnostic tools but the agent loop truncates at 3, leading to premature synthesis without tool escalation.
  2. *Single source of truth*: Import `DEFAULT_MAX_TROUBLESHOOTING_STEPS` in `agent.py` and bind `max_tool_turns` directly to it.
     - *Tradeoff*: Locks tool turns to the diagnostic ceiling, guaranteeing synchronized execution and evaluation.
- **Decision**: Adopted Option 2.

# Technical Decisions: Step 119 - ReAct Multi-Turn Tool Loop

## Decision: Multi-Turn ReAct Loop (Max 3 Turns) with Turn 1 Parallelism Prompting

### Options Considered:
1. **Prompt-Only Forcing (Turn 1 Parallelism)**:
   - *Pros*: Simple, no loop structure changes.
   - *Cons*: Highly brittle. LLMs frequently reason sequentially (e.g. checking if a ticket is related before querying KB, or deciding subsequent steps based on intermediate tool results). If the model only emits one tool call in Turn 1, the second inquiry is permanently orphaned because the legacy runner disabled tools in Turn 2.

2. **Unbounded ReAct Loop**:
   - *Pros*: Maximum flexibility.
   - *Cons*: High latency and runaway token cost risk if the model enters an infinite tool-calling loop on ambiguous queries.

3. **Hybrid: Bounded 3-Turn ReAct Loop with Prompt Parallelism Encouragement (Selected)**:
   - *Pros*:
     - Up to 3 tool turns (`max_tool_turns = 3`).
     - In each turn, if `tool_calls` exist, execute them (concurrently via `ThreadPoolExecutor` if `len > 1`, or singly).
     - Tool results are appended to `messages` with role `tool` and conversation state continues.
     - In the subsequent turn, `tools=SUPPORT_TOOLS` remains available if `turn < max_tool_turns`.
     - Once the model returns pure content without tool calls, or when `turn >= max_tool_turns`, final response is finalized and returned.
     - Prompt directive explicitly encourages emitting multiple independent tool calls in a single turn for compound inquiries.
   - *Cons*: Potential for additional LLM inference round (1-2s) if serialized, but guarantees complete execution and full context retrieval.

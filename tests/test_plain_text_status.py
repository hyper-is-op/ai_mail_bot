import os
import sys

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app.llm_utils import strip_markdown_decorations
from app.pipeline.context import PipelineContext
from app.pipeline.agent import run_support_agent

def main():
    sample = """Hi Md Yazdani,

Thanks for reaching out! Here is the status:

| Detail | Info |
|---|---|
| **Docket No** | #212 *(System ID: 275424000000661001)* |
| **Status** | Open |
| **Issue Overview** | You reported a problem with **CZ Dialer**. |
| **Next Steps** | In queue for *review*. |

Thanks & Regards,
Support Team"""

    cleaned = strip_markdown_decorations(sample)
    print("=== STRIPPED SAMPLE ===")
    print(cleaned)

    ctx = PipelineContext.from_task_data("test-plain-text", {
        "client_id": "CLI-4B46C071",
        "from_email": "md.yazdani@c-zentrix.com",
        "subject": "ticket status check",
        "body": "can you check the status of ticket #275424000000661001?",
        "thread_id": "th_test_plain_text_verify"
    })
    ctx.intent = "ticket_status"
    ctx = run_support_agent(ctx)
    print("=== LIVE GENERATED DRAFT ===")
    print(ctx.draft_reply)
    print("=== SCORE & DECISION ===")
    print(f"Score: {ctx.score} | Decision: {ctx.response_action}")
    assert "|" not in ctx.draft_reply, "Draft contains pipe '|' characters!"
    assert "**" not in ctx.draft_reply, "Draft contains bold '**' markers!"
    print("✅ Verification passed: Zero pipes, zero markdown bold markers!")

if __name__ == "__main__":
    main()

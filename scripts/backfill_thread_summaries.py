#!/usr/bin/env python3
"""
Backfill thread summaries for recent active threads in email_logs
using the updated, natural language generate_summary_llm function.
"""

import os
import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("backfill_summaries")

# Add repo root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db import get_db_ctx
from app.llm_functions.summaries import generate_summary_llm

def backfill():
    # 1. Fetch latest email ID per thread for recent threads
    with get_db_ctx() as db:
        with db.cursor() as cur:
            cur.execute("""
                SELECT MAX(id), thread_id, from_email, subject 
                FROM email_logs 
                WHERE thread_id IS NOT NULL
                GROUP BY thread_id, from_email, subject 
                ORDER BY MAX(id) DESC 
                LIMIT 20
            """)
            thread_heads = cur.fetchall()

    logger.info(f"Found {len(thread_heads)} thread heads to inspect and re-summarize")

    for head in thread_heads:
        latest_id, thread_id, from_email, subject = head
        
        # Fetch thread emails in chronological order
        with get_db_ctx() as db:
            with db.cursor() as cur:
                cur.execute("""
                    SELECT id, body, reply, summary, client_id 
                    FROM email_logs 
                    WHERE thread_id = %s 
                    ORDER BY id ASC
                """, (thread_id,))
                emails = cur.fetchall()

        if not emails:
            continue

        # Build clean chronological history
        history = []
        for em in emails[:-1]:
            b = em[1] or ""
            r = em[2] or ""
            if b:
                history.append({"role": "customer", "body": b})
            if r:
                history.append({"role": "support", "body": r})

        latest_email = emails[-1]
        latest_body = latest_email[1] or ""
        old_summary = latest_email[3] or ""

        # Only regenerate if existing summary has robotic markers or is empty/generic
        needs_update = (
            not old_summary or
            "x," in old_summary or
            "Repeated" in old_summary or
            "No support issue" in old_summary or
            ";" in old_summary or
            len(old_summary) < 20
        )

        if not needs_update:
            logger.info(f"Skipping thread {thread_id} (#{latest_id}) - summary already clean")
            continue

        logger.info(f"Re-summarizing thread {thread_id} (#{latest_id}) | Subject: {subject}")
        try:
            new_summary = generate_summary_llm(
                context="",
                customer_body=latest_body,
                history=history,
                old_summary=""  # Pass clean empty old_summary to avoid carrying over telegraphic text
            )

            with get_db_ctx() as db:
                with db.cursor() as cur:
                    cur.execute("""
                        UPDATE email_logs 
                        SET summary = %s 
                        WHERE id = %s
                    """, (new_summary, latest_id))
                    db.commit()

            logger.info(f"✅ Updated #{latest_id}: {new_summary}")
        except Exception as e:
            logger.error(f"❌ Failed to re-summarize #{latest_id}: {e}")

if __name__ == "__main__":
    backfill()

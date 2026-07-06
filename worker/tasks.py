from worker.celery_worker import celery
from app.rag import query_rag, get_rag_id, query_knowledge
from app.llm import generate_reply_llm, detect_intent_llm, scan_history_for_ticket, extract_issue_description, generate_summary_llm
from app.scoring import llm_score
from app.decision import decision_engine
from app.mailer import send_email
from app.db import get_db
from app.chat_history import push_message, get_history, get_pending_state, upsert_ticket_history, get_ticket_history
import random
from datetime import datetime
from app.request_handler import call_create_ticket, get_order_status
from app.keyword_filter import get_blocked_keywords, is_blocked, insert_blocked_email

import logging
import re
import json

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def extract_order_id(text):
    matches = re.findall(r'ORD\d+', text)
    return matches if matches else []

def generate_ticket_id():
    date_part = datetime.now().strftime("%y%m%d")
    random_part = str(random.randint(0, 99999)).zfill(5)
    return f"T-{date_part}-{random_part}"



def get_client_features(cursor, client_id):
    defaults = {
        "feature_ticket_creation": True, "feature_auto_send": True,
        "feature_rag": True, "feature_order_tracking": True, "feature_manual_reply": True,
    }
    try:
        cursor.execute("""
            SELECT feature_ticket_creation, feature_auto_send, feature_rag,
                   feature_order_tracking, feature_manual_reply
            FROM email_accounts WHERE client_id = %s
        """, (client_id,))
        row = cursor.fetchone()
        if row:
            return {
                "feature_ticket_creation": bool(row[0]), "feature_auto_send": bool(row[1]),
                "feature_rag": bool(row[2]), "feature_order_tracking": bool(row[3]),
                "feature_manual_reply": bool(row[4]),
            }
    except Exception as e:
        logger.warning(f"⚠️ Failed to fetch feature flags for {client_id}, using defaults: {e}")
    return defaults


# ==============================
# Templated verification emails
# (deterministic, no LLM cost)
# ==============================
def _tpl_please_verify(ticket_id: str, customer_name: str = "Customer") -> str:
    return (
        f"Hi {customer_name},\n\n"
        f"Thank you for reaching out. We received your query regarding ticket "
        f"**{ticket_id}**, but we were unable to locate this ID in our system.\n\n"
        f"Could you please double-check the ticket ID and confirm it in your reply? "
        f"If you have a reference email or screenshot, feel free to attach it.\n\n"
        f"Thanks & Regards,\n"
        f"Support Team"
    )

def _tpl_verification_failed(customer_name: str = "Customer") -> str:
    return (
        f"Hi {customer_name},\n\n"
        f"We were still unable to locate the ticket ID in our system after verification.\n\n"
        f"No worries — please describe your issue in your next reply and we will raise a "
        f"fresh support ticket on your behalf right away.\n\n"
        f"Thanks & Regards,\n"
        f"Support Team"
    )


def generate_and_save_summary(db, cursor, log_id, data, chroma_context):
    try:
        client_id = data.get("client_id")
        from_email = data.get("from_email")
        subject = data.get("subject")
        body = data.get("body")
        
        import re
        # Subject normalizer helper
        norm_subject = re.sub(r'^(Re|RE|Fwd|FWD|fwd|re):\s*', '', subject).strip()
        
        # Fetch up to 5 prior emails from same sender
        cursor.execute("""
            SELECT body, reply, summary 
            FROM email_logs 
            WHERE client_id = %s 
              AND from_email = %s 
              AND id < %s
            ORDER BY id DESC LIMIT 5
        """, (client_id, from_email, log_id))
        prior_rows = cursor.fetchall()
        
        old_summary = ""
        history_list = []
        for r in prior_rows:
            if r[2] and not old_summary:
                old_summary = r[2]
            history_list.insert(0, {"role": "customer", "body": r[0]})
            if r[1]:
                history_list.insert(1, {"role": "support", "body": r[1]})
                
        from app.llm import generate_summary_llm
        summary = generate_summary_llm(
            context=chroma_context,
            customer_body=body,
            history=history_list,
            old_summary=old_summary
        )
        
        cursor.execute("UPDATE email_logs SET summary = %s WHERE id = %s", (summary, log_id))
        logger.info(f"📊 Summary generated & updated for ID {log_id}: {summary}")
    except Exception as e:
        logger.warning(f"⚠️ Failed to generate/save summary: {e}")


@celery.task(bind=True, max_retries=3)
def process_email_task(self, data):
    logger.info(f"📥 Received email task: from={data.get('from_email')} subject={data.get('subject')}")

    from app.llm import current_client_id
    client_id = data.get("client_id", "SYSTEM")
    ctx_token = current_client_id.set(client_id)

    db = None
    try:
        db = get_db()
        cursor = db.cursor()
        # ==============================
# Idempotency Check
# ==============================
        task_id = self.request.id

        cursor.execute("""
    CREATE TABLE IF NOT EXISTS celery_task_log (
        task_id     VARCHAR(255) NOT NULL PRIMARY KEY,
        client_id   VARCHAR(50)  NOT NULL,
        from_email  VARCHAR(255) NOT NULL,
        status      VARCHAR(50)  NOT NULL DEFAULT 'processing',
        created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
""")

        cursor.execute(
    "SELECT status FROM celery_task_log WHERE task_id = %s",
    (task_id,)
)
        existing = cursor.fetchone()

        if existing:
            existing_status = existing[0]
            if existing_status == "completed":
                logger.info(f"⏭ Task {task_id} already completed — skipping to prevent duplicate")
                db.close()
                return
            elif existing_status == "processing":
                logger.warning(f"🔄 Task {task_id} is a retry — continuing carefully")
        else:
            cursor.execute(
        "INSERT INTO celery_task_log (task_id, client_id, from_email, status) VALUES (%s, %s, %s, 'processing')",
        (task_id, data.get("client_id", "SYSTEM"), data.get("from_email", ""))
    )
            db.commit()

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS email_customers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            client_id VARCHAR(255) UNIQUE,
            rag_id VARCHAR(255),
            customer_name VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS email_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            client_id VARCHAR(50) NULL,
            from_email VARCHAR(255),
            subject TEXT,
            body TEXT,
            reply TEXT,
            score INT,
            status VARCHAR(50),
            rag_id VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        try:
            cursor.execute("ALTER TABLE email_logs ADD COLUMN client_id VARCHAR(50) NULL AFTER id")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE email_logs ADD COLUMN sentiment VARCHAR(50) DEFAULT 'Neutral'")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE email_logs ADD COLUMN priority VARCHAR(50) DEFAULT 'Medium'")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE email_logs ADD COLUMN execution_steps TEXT NULL")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE email_logs ADD COLUMN summary VARCHAR(255) NULL")
        except Exception:
            pass

        # ==============================
        # Check if Email is Paused
        # ==============================
        cursor.execute("SELECT id FROM paused_emails WHERE client_id = %s AND paused_email = %s", (client_id, data.get('from_email')))
        if cursor.fetchone():
            logger.info(f"⏸️ Email from {data.get('from_email')} is paused. Skipping auto-reply.")
            cursor.execute("""
                INSERT INTO email_logs (client_id, from_email, subject, body, status, priority, sentiment, execution_steps)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (client_id, data.get('from_email'), data.get('subject'), data.get('body'), 'paused', 'Medium', 'Neutral', json.dumps(["Start", "Paused"])))
            db.commit()
            
            try:
                import os
                import redis
                redis_url = os.getenv("REDIS_URL", "redis://mail_ai_redis:6379/0")
                if not redis_url:
                    redis_url = "redis://localhost:6379/0"
                r = redis.from_url(redis_url)
                r.publish("email_updates", json.dumps({"type": "NEW_EMAIL", "client_id": client_id}))
            except Exception as e:
                pass
                
            return
        
        blocked_keywords = get_blocked_keywords(cursor, client_id)
        email_text = f"{data.get('subject','')} {data.get('body','')}"
        matched_kw = is_blocked(email_text, blocked_keywords) if blocked_keywords else None

        if matched_kw:
            from app.keyword_filter import get_block_policy
            policy = get_block_policy(cursor, client_id)
            status = 'ignored' if policy == 'ignore' else 'pending_review'
            logger.info(f"🚫 Email matched blocked keyword '{matched_kw}' — policy={policy}, routing to {status}")
            insert_blocked_email(
                cursor, client_id,
                data["from_email"], data["subject"], data["body"],
                matched_kw, status=status
            )
            cursor.execute("""
                INSERT INTO email_logs (client_id, from_email, subject, body, status, priority, sentiment, execution_steps)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (client_id, data.get('from_email'), data.get('subject'), data.get('body'),
                'blocked_keyword', 'High', 'Neutral',
                json.dumps(["Start", f"Blocked_Keyword:{matched_kw}"])))
            cursor.execute("UPDATE celery_task_log SET status = 'completed' WHERE task_id = %s", (task_id,))
            db.commit()
            db.close()
            return

        # ==============================
        # Get RAG ID / ChromaDB context
        # ==============================
        client_id = data.get("client_id")
        features = get_client_features(cursor, client_id)
        rag_id = get_rag_id(client_id)
        logger.info(f"🔎 RAG ID: {rag_id} Client ID: {client_id}")

        email_query = f"Subject: {data['subject']}\n\n{data['body']}"

        chroma_context = ""
        if client_id:
            try:
                chroma_context = query_knowledge(client_id, email_query)
            except Exception as e:
                logger.error(f"❌ ChromaDB Query failed: {e}")

        # ==============================
        # STEP 1: Intent Detection
        # ==============================
        execution_steps = ["Start", "Intent_Detection"]
        
        intent_data = detect_intent_llm(email_query)
        intent     = intent_data.get("intent")
        ticket_ids = intent_data.get("ticket_ids", [])
        sentiment  = intent_data.get("sentiment", "Neutral")
        priority   = intent_data.get("priority", "Medium")

        # Ensure priority is elevated if urgent words are detected
        q_lower = email_query.lower()
        if any(w in q_lower for w in ["sue", "legal", "lawyer", "court", "scam"]):
            priority = "Critical"
            sentiment = "Angry"
        elif any(w in q_lower for w in ["refund", "cancel", "urgent", "wrong", "fake", "bad", "worst"]):
            if priority not in ["Critical", "High"]:
                priority = "High"
            if sentiment == "Neutral":
                sentiment = "Angry"

        if not ticket_ids:
            fallback = extract_order_id(email_query)
            if fallback:
                ticket_ids = fallback

        # Deduplicate — same ID in subject + body causes false multi-ticket
        ticket_ids = list(dict.fromkeys(ticket_ids))

        logger.info(f"🎯 Intent: {intent} Ticket IDs: {ticket_ids} Sentiment: {sentiment} Priority: {priority}")

        # ==============================
        # MULTI-TICKET CLARIFICATION
        # ==============================
        if len(ticket_ids) > 1:
            logger.warning(f"⚠️ Multiple ticket IDs in email: {ticket_ids}")
            execution_steps.append("Clarification_Request")

            id_list = "\n".join(f"  - {tid}" for tid in ticket_ids)
            clarification_reply = (
                f"Dear Customer,\n\n"
                f"Thank you for reaching out. We noticed your email mentions multiple ticket/order IDs:\n\n"
                f"{id_list}\n\n"
                f"Could you please clarify which ticket you would like us to look into? "
                f"Replying with a single ticket ID will help us assist you faster.\n\n"
                f"Thanks & Regards,\n"
                f"Support Team"
            )

            send_email(
                data.get("client_id"),
                data["from_email"],
                "Re: " + data["subject"],
                clarification_reply
            )

            cursor.execute("""
                INSERT INTO email_logs (client_id, from_email, subject, body, reply, score, status, rag_id, sentiment, priority, execution_steps)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (
                data.get("client_id"),
                data["from_email"],
                data["subject"],
                data["body"],
                clarification_reply,
                0,
                "clarification_sent",
                rag_id,
                sentiment,
                priority,
                json.dumps(execution_steps)
            ))
            db_log_id = cursor.lastrowid
            generate_and_save_summary(db, cursor, db_log_id, data, chroma_context)
            db.commit()
            db.close()
            logger.info("✅ Clarification sent, task done")
            return

        ticket_id = ticket_ids[0] if ticket_ids else None

        # ==============================
        # Load conversation history
        # ==============================
        history = get_history(client_id, data["from_email"], last_n=15)
        logger.info(f"📜 Loaded {len(history)} history messages")

        # ==============================
        # STEP 2: Routing
        # ==============================
        save_to_history = False
        outgoing_ticket_id = None
        reply = None
        score = 0
        status = "pending"

        # Pre-load verification state once — reused by all paths to avoid
        # hitting Redis multiple times per task.
        active_state = get_pending_state(client_id, data["from_email"])
        active_state_name = active_state.get("state") if active_state else None
        _VERIFICATION_STATES = ("pending_verification", "verification_failed")

        if active_state_name:
            logger.info(f"🔒 Active verification state detected: {active_state_name} — PATHs A and B will be skipped")

        if not features["feature_order_tracking"] and (intent == "ticket_status" or ticket_id):
            logger.info("🚫 feature_order_tracking disabled — forcing general_query path")
            intent = "general_query"    
        # ──────────────────────────────
        # PATH A: ticket_status intent OR ticket_id present in email.
        # Skipped when a verification flow is already active — the quoted
        # ticket ID in the reply thread must not re-trigger PATH A.
        # ──────────────────────────────
        if (intent == "ticket_status" or ticket_id) and active_state_name not in _VERIFICATION_STATES:
            logger.info("🚀 PATH A — ticket/order status from email")
            execution_steps.append("Order_Check")

            api_res = get_order_status(client_id, ticket_id)

            if api_res.get("success"):
                ticket_data = api_res.get("data", {})
                ticket_info = next(iter(ticket_data.values()), {})

                context = f"""
Ticket ID:           {ticket_info.get('docket_no', 'N/A')}
Status:              {ticket_info.get('ticket_status', 'N/A')}
Priority:            {ticket_info.get('priority_name', 'N/A')}
Ticket Type:         {ticket_info.get('ticket_type', 'N/A')}
Issue Reported:      {ticket_info.get('problem_reported', 'N/A')}
Agent Remarks:       {ticket_info.get('agent_remarks', 'N/A')}
Disposition:         {ticket_info.get('disposition_name', 'N/A')}
Sub Disposition:     {ticket_info.get('sub_disposition_name', 'N/A')}
Assigned Department: {ticket_info.get('assigned_to_dept_name', 'N/A')}
Assigned User:       {ticket_info.get('assigned_to_user_name', 'N/A')}
Customer Name:       {ticket_info.get('person', {}).get('person_name', 'N/A')}
Customer Email:      {ticket_info.get('person', {}).get('person_mail', 'N/A')}
Customer Mobile:     {ticket_info.get('person', {}).get('mobile_no', 'N/A')}
"""
                logger.info("📄 Ticket context ready from API")

                reply = generate_reply_llm(
                    context, data["body"], "crm_support_agent",
                    data["from_email"], history=history
                )
                score = llm_score(reply, data["body"])

                send_email(
                    client_id,
                    data["from_email"],
                    "Re: " + data["subject"],
                    reply
                )
                status = "sent"
                execution_steps.append("SMTP_Send")
                save_to_history = True

                # Upsert MySQL chat_history with latest API status/priority + updated summary
                old_row = get_ticket_history(ticket_id)
                old_summary = old_row.get("summary", "") if old_row else ""
                summary = generate_summary_llm(
                    context=context,
                    customer_body=data["body"],
                    history=history,
                    old_summary=old_summary
                )
                upsert_ticket_history(
                    client_id=client_id,
                    ticket_id=ticket_id,
                    customer_email=data["from_email"],
                    summary=summary,
                    priority=ticket_info.get("priority_name", "Normal"),
                    status=ticket_info.get("ticket_status", "NEW")
                )

            else:
                # ──────────────────────────────────────────────────────────────────
                # FIX: The customer gave us a specific ticket ID and the API 404'd.
                # The old behaviour silently fell through to RAG/PATH C and created
                # a new ticket, which answers a question the customer never asked.
                #
                # Correct behaviour: enter the verification state machine here,
                # exactly as PATH C does for history-found IDs that 404.
                #
                # If no ticket_id was actually extracted (intent fired but ID absent),
                # fall through to RAG as before — that's a genuine general query.
                # ──────────────────────────────────────────────────────────────────
                if ticket_id:
                    logger.warning(
                        f"⚠️ PATH A — API 404 for customer-supplied ticket {ticket_id}"
                        f" — starting pending_verification flow"
                    )
                    from app.llm import extract_name_from_email
                    customer_name = extract_name_from_email(data["from_email"])

                    reply = _tpl_please_verify(ticket_id, customer_name)
                    send_email(
                        client_id,
                        data["from_email"],
                        "Re: " + data["subject"],
                        reply
                    )
                    status = "pending_verification"
                    execution_steps.append("Ticket_Escalation")

                    push_message(
                        client_id=client_id,
                        from_email=data["from_email"],
                        role="customer",
                        subject=data["subject"],
                        body=data["body"],
                        ticket_id=""
                    )
                    push_message(
                        client_id=client_id,
                        from_email=data["from_email"],
                        role="support",
                        subject="Re: " + data["subject"],
                        body=reply,
                        ticket_id="",
                        meta={"state": "pending_verification", "ticket_id": ticket_id}
                    )
                    save_to_history = False  # already pushed above

                else:
                    # No extractable ticket ID — genuinely a general query
                    logger.warning("⚠️ PATH A — API failed with no ticket_id, falling to RAG path")
                    intent = "general_query"

        # ──────────────────────────────
        # PATH B: general_query — try RAG first.
        # Skipped when a verification flow is active — a high RAG score on the
        # customer's issue description must not bypass the verification_failed
        # → create ticket branch.
        # ──────────────────────────────
        if reply is None and active_state_name in _VERIFICATION_STATES:
            logger.info(f"⏭ PATH B skipped — active verification state: {active_state_name}")

        if reply is None and active_state_name not in _VERIFICATION_STATES and features["feature_rag"]:
            logger.info("📚 PATH B — trying RAG/ChromaDB")
            execution_steps.append("RAG_Search")

            if chroma_context:
                context = chroma_context
            elif rag_id:
                rag_res = query_rag(rag_id, email_query)
                context = rag_res.get("answer", "")
            else:
                context = ""

            rag_succeeded = bool(context and "No context found" not in context)

            if rag_succeeded:
                logger.info("✅ RAG succeeded — generating reply")

                reply = generate_reply_llm(
                    context, data["body"], "crm_support_agent",
                    data["from_email"], history=history
                )
                score = llm_score(reply, data["body"])

                from worker.credential_service import get_email_score_threshold
                threshold = get_email_score_threshold(client_id)
                logger.info(f"📊 Score={score} Threshold={threshold}")
                execution_steps.append("Confidence_Evaluation")

                if score >= threshold:
                    if features["feature_auto_send"]:
                        logger.info("✅ RAG reply quality good — auto_send, skip history")
                        send_email(client_id, data["from_email"], "Re: " + data["subject"], reply)
                        status = "sent"
                        execution_steps.append("SMTP_Send")
                        save_to_history = False
                    else:
                        logger.info("⏸ auto_send disabled — holding reply for manual approval")
                        status = "pending_manual_review"
                        execution_steps.append("Held_For_Manual_Review")
                        save_to_history = False
                        # `reply` stays populated — it's saved into email_logs.reply below as normal,
                        # so the held text is visible and ready to approve, not regenerated from scratch.
                else:
                    logger.warning("⚠️ RAG score below threshold — falling to history scan")
                    execution_steps.append("Ticket_Escalation")
                    reply = None
                    score = 0

        # ──────────────────────────────
        # PATH C: RAG failed or low score.
        #
        # Verification state machine:
        #   [no state]             → scan history for ticket_id
        #                            → API 404 → "please verify" → pending_verification
        #   [pending_verification] → re-try API → still 404 → verification_failed
        #   [verification_failed]  → extract description → create ticket directly
        #
        # Note: PATH A now handles the case where the customer supplies a ticket_id
        # directly and the API 404s, so PATH C only sees pending_verification /
        # verification_failed on follow-up replies from that flow.
        # ──────────────────────────────
        if reply is None:
            logger.info("🔍 PATH C — checking conversation state")

            pending_state = active_state
            state_name = active_state_name
            logger.info(f"🔍 Pending state: {state_name}")

            if state_name == "verification_failed":
                if not features["feature_ticket_creation"]:
                    logger.info("⏸ feature_ticket_creation disabled — holding for manual review")
                    execution_steps.append("Held_For_Manual_Review_No_Ticket")
                    status = "pending_manual_review"
                    reply = None
                    push_message(client_id=client_id, from_email=data["from_email"], role="customer",
                                 subject=data["subject"], body=data["body"], ticket_id="")
                    push_message(client_id=client_id, from_email=data["from_email"], role="support",
                                 subject="Re: " + data["subject"],
                                 body="[Held for manual review — no automated reply sent]",
                                 ticket_id="", meta="")
                    save_to_history = False
                else:
                    logger.info("🎫 PATH C / verification_failed — extracting issue and creating ticket")
                    execution_steps.append("Ticket_Escalation")

                    clean_description = extract_issue_description(data["body"], history)
                    enriched_data = {**data, "body": clean_description, "subject": clean_description[:80]}
                    reply, outgoing_ticket_id, status = _create_ticket_and_reply(
                        enriched_data, client_id, context="", history=history,
                        cursor=cursor, sentiment=sentiment, priority=priority
                    )

                    if status == "ticket_creation_failed":
                        logger.error("❌ Ticket creation failed — holding for manual review")
                        execution_steps.append("Ticket_Creation_Failed")
                        status = "pending_manual_review"
                        push_message(client_id=client_id, from_email=data["from_email"], role="customer",
                                     subject=data["subject"], body=data["body"], ticket_id="")
                        push_message(client_id=client_id, from_email=data["from_email"], role="support",
                                     subject="Re: " + data["subject"],
                                     body="[Ticket creation failed — held for manual review]",
                                     ticket_id="", meta="")
                        save_to_history = False
                    else:
                        push_message(client_id=client_id, from_email=data["from_email"], role="customer",
                                     subject=data["subject"], body=data["body"], ticket_id="")
                        push_message(client_id=client_id, from_email=data["from_email"], role="support",
                                     subject="Re: " + data["subject"], body=reply,
                                     ticket_id=outgoing_ticket_id or "", meta="")
                        save_to_history = False

                        if outgoing_ticket_id:
                            summary = generate_summary_llm(context="", customer_body=data["body"],
                                                            history=history, old_summary="")
                            upsert_ticket_history(client_id=client_id, ticket_id=outgoing_ticket_id,
                                                   customer_email=data["from_email"], summary=summary,
                                                   priority="Normal", status="NEW")

            elif state_name == "pending_verification":
                stored_ticket_id = pending_state.get("ticket_id", "")
                logger.info(f"🔄 PATH C / pending_verification — re-trying API for {stored_ticket_id}")
                execution_steps.append("Order_Check")

                api_res = get_order_status(client_id, stored_ticket_id)

                if api_res.get("success"):
                    ticket_data = api_res.get("data", {})
                    ticket_info = next(iter(ticket_data.values()), {})

                    context = f"""
Ticket ID:           {ticket_info.get('docket_no', 'N/A')}
Status:              {ticket_info.get('ticket_status', 'N/A')}
Priority:            {ticket_info.get('priority_name', 'N/A')}
Issue Reported:      {ticket_info.get('problem_reported', 'N/A')}
Agent Remarks:       {ticket_info.get('agent_remarks', 'N/A')}
Assigned Department: {ticket_info.get('assigned_to_dept_name', 'N/A')}
Customer Name:       {ticket_info.get('person', {}).get('person_name', 'N/A')}
"""
                    reply = generate_reply_llm(
                        context, data["body"], "crm_support_agent",
                        data["from_email"], history=history
                    )
                    score = llm_score(reply, data["body"])
                    send_email(client_id, data["from_email"], "Re: " + data["subject"], reply)
                    status = "sent"
                    execution_steps.append("SMTP_Send")

                    push_message(client_id=client_id, from_email=data["from_email"], role="customer",
                                 subject=data["subject"], body=data["body"], ticket_id="")
                    push_message(client_id=client_id, from_email=data["from_email"], role="support",
                                 subject="Re: " + data["subject"], body=reply, ticket_id="", meta="")
                    save_to_history = False

                    old_row = get_ticket_history(stored_ticket_id)
                    old_summary = old_row.get("summary", "") if old_row else ""
                    summary = generate_summary_llm(
                        context=context, customer_body=data["body"],
                        history=history, old_summary=old_summary
                    )
                    upsert_ticket_history(
                        client_id=client_id, ticket_id=stored_ticket_id,
                        customer_email=data["from_email"], summary=summary,
                        priority=ticket_info.get("priority_name", "Normal"),
                        status=ticket_info.get("ticket_status", "NEW")
                    )
                else:
                    logger.warning(
                        f"⚠️ PATH C / pending_verification — API still 404 for {stored_ticket_id}"
                        f" — escalating to verification_failed"
                    )
                    from app.llm import extract_name_from_email
                    customer_name = extract_name_from_email(data["from_email"])

                    reply = _tpl_verification_failed(customer_name)
                    send_email(client_id, data["from_email"], "Re: " + data["subject"], reply)
                    status = "verification_failed"
                    execution_steps.append("Ticket_Escalation")

                    push_message(client_id=client_id, from_email=data["from_email"], role="customer",
                                 subject=data["subject"], body=data["body"], ticket_id="")
                    push_message(client_id=client_id, from_email=data["from_email"], role="support",
                                 subject="Re: " + data["subject"], body=reply,
                                 ticket_id="", meta={"state": "verification_failed"})
                    save_to_history = False

            else:
                logger.info("🔍 PATH C — no prior state, scanning history for ticket ID")

                scan_result = scan_history_for_ticket(email_query, history)
                logger.info(f"🔍 History scan result: {scan_result}")

                if scan_result.get("ambiguous"):
                    ambiguous_ids = scan_result.get("ticket_ids", [])
                    logger.warning(f"⚠️ Ambiguous history IDs: {ambiguous_ids}")
                    execution_steps.append("Clarification_Request")

                    id_list = "\n".join(f"  - {tid}" for tid in ambiguous_ids)
                    reply = (
                        f"Dear Customer,\n\n"
                        f"We found multiple previous tickets in your history:\n\n"
                        f"{id_list}\n\n"
                        f"Could you please let us know which one you are referring to?\n\n"
                        f"Thanks & Regards,\nSupport Team"
                    )
                    send_email(client_id, data["from_email"], "Re: " + data["subject"], reply)
                    status = "clarification_sent"
                    save_to_history = True

                elif scan_result.get("found"):
                    history_ticket_id = scan_result.get("ticket_id")
                    logger.info(f"✅ Found ticket ID in history: {history_ticket_id}")
                    execution_steps.append("Order_Check")

                    api_res = get_order_status(client_id, history_ticket_id)

                    if api_res.get("success"):
                        ticket_data = api_res.get("data", {})
                        ticket_info = next(iter(ticket_data.values()), {})

                        context = f"""
Ticket ID:           {ticket_info.get('docket_no', 'N/A')}
Status:              {ticket_info.get('ticket_status', 'N/A')}
Priority:            {ticket_info.get('priority_name', 'N/A')}
Issue Reported:      {ticket_info.get('problem_reported', 'N/A')}
Agent Remarks:       {ticket_info.get('agent_remarks', 'N/A')}
Assigned Department: {ticket_info.get('assigned_to_dept_name', 'N/A')}
Customer Name:       {ticket_info.get('person', {}).get('person_name', 'N/A')}
"""
                        reply = generate_reply_llm(
                            context, data["body"], "crm_support_agent",
                            data["from_email"], history=history
                        )
                        score = llm_score(reply, data["body"])
                        send_email(client_id, data["from_email"], "Re: " + data["subject"], reply)
                        status = "sent"
                        execution_steps.append("SMTP_Send")
                        save_to_history = True

                        old_row = get_ticket_history(history_ticket_id)
                        old_summary = old_row.get("summary", "") if old_row else ""
                        summary = generate_summary_llm(
                            context=context, customer_body=data["body"],
                            history=history, old_summary=old_summary
                        )
                        upsert_ticket_history(
                            client_id=client_id, ticket_id=history_ticket_id,
                            customer_email=data["from_email"], summary=summary,
                            priority=ticket_info.get("priority_name", "Normal"),
                            status=ticket_info.get("ticket_status", "NEW")
                        )
                    else:
                        logger.warning(
                            f"⚠️ API 404 for history ticket {history_ticket_id}"
                            f" — starting pending_verification flow"
                        )
                        from app.llm import extract_name_from_email
                        customer_name = extract_name_from_email(data["from_email"])

                        reply = _tpl_please_verify(history_ticket_id, customer_name)
                        send_email(client_id, data["from_email"], "Re: " + data["subject"], reply)
                        status = "pending_verification"
                        execution_steps.append("Ticket_Escalation")

                        push_message(client_id=client_id, from_email=data["from_email"], role="customer",
                                     subject=data["subject"], body=data["body"], ticket_id="")
                        push_message(client_id=client_id, from_email=data["from_email"], role="support",
                                     subject="Re: " + data["subject"], body=reply, ticket_id="",
                                     meta={"state": "pending_verification", "ticket_id": history_ticket_id})
                        save_to_history = False

                else:
                    if not features["feature_ticket_creation"]:
                        logger.info("⏸ feature_ticket_creation disabled — holding in manual queue")
                        execution_steps.append("Held_For_Manual_Review_No_Ticket")
                        status = "pending_manual_review"
                        reply = None
                        save_to_history = False
                    else:
                        logger.info("🎫 PATH C — no history ID found, creating ticket")
                        execution_steps.append("Ticket_Escalation")
                        reply, outgoing_ticket_id, status = _create_ticket_and_reply(
                            data, client_id, context="", history=history,
                            cursor=cursor, sentiment=sentiment, priority=priority
                        )

                        if status == "ticket_creation_failed":
                            logger.error("❌ Ticket creation failed — holding for manual review")
                            execution_steps.append("Ticket_Creation_Failed")
                            status = "pending_manual_review"
                            save_to_history = False
                        else:
                            save_to_history = True
                            if outgoing_ticket_id:
                                summary = generate_summary_llm(context="", customer_body=data["body"],
                                                                history=history, old_summary="")
                                upsert_ticket_history(client_id=client_id, ticket_id=outgoing_ticket_id,
                                                       customer_email=data["from_email"], summary=summary,
                                                       priority=priority, status="NEW")
        # ==============================
        # Save to history if needed
        # ==============================
        if save_to_history:
            push_message(
                client_id=client_id,
                from_email=data["from_email"],
                role="customer",
                subject=data["subject"],
                body=data["body"],
                ticket_id=""
            )
            push_message(
                client_id=client_id,
                from_email=data["from_email"],
                role="support",
                subject="Re: " + data["subject"],
                body=reply,
                ticket_id=outgoing_ticket_id or ""
            )
            logger.info("💬 Conversation saved to history")
        else:
            logger.info("⏭ History save skipped (RAG success or already pushed)")

        # ==============================
        # Save Logs
        # ==============================
        cursor.execute("""
            INSERT INTO email_logs (client_id, from_email, subject, body, reply, score, status, rag_id, sentiment, priority, execution_steps)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            client_id,
            data["from_email"],
            data["subject"],
            data["body"],
            reply,
            score,
            status,
            rag_id,
            sentiment,
            priority,
            json.dumps(execution_steps)
        ))
        db_log_id = cursor.lastrowid
        generate_and_save_summary(db, cursor, db_log_id, data, chroma_context)

        cursor.execute("UPDATE celery_task_log SET status = 'completed' WHERE task_id = %s",(task_id,))
        db.commit()
        db.close()
        db = None
        logger.info("✅ Task completed successfully")

        # Publish real-time notification to Redis
        # try:
        #     import os
        #     import redis
        #     redis_url = os.getenv("REDIS_URL", "redis://mail_ai_redis:6379/0")
        #     if not redis_url:
        #         redis_url = "redis://localhost:6379/0"
        #     r = redis.from_url(redis_url)
        #     try:
        #         r.publish("email_updates", json.dumps({"type": "NEW_EMAIL", "client_id": client_id}))
        #         logger.info("📡 Published real-time update to 'email_updates' channel")
        #     finally:
        #         r.close()
        # except Exception as pub_err:
        #     logger.warning(f"⚠️ Failed to publish real-time notification: {pub_err}")

    except Exception as e:
        logger.error(f"❌ Task failed: {e}", exc_info=True)
        raise self.retry(exc=e, countdown=10)
    finally:
        if db:
            try:
                db.close()
            except Exception:
                pass
    try:
        import os
        import redis
        redis_url = os.getenv("REDIS_URL", "redis://mail_ai_redis:6379/0") or "redis://localhost:6379/0"
        r = redis.from_url(redis_url)
        try:
            r.publish("email_updates", json.dumps({"type": "NEW_EMAIL", "client_id": client_id}))
            logger.info("📡 Published real-time update to 'email_updates' channel")
        finally:
            r.close()
    except Exception as pub_err:
        logger.warning(f"⚠️ Failed to publish real-time notification: {pub_err}")


# ==============================
# Helper: create ticket + reply
# ==============================
def _create_ticket_and_reply(data, client_id, context, history, cursor, sentiment="Neutral", priority="Medium"):
    """
    Creates a ticket via API, generates formatted reply, sends email.
    Returns (reply, ticket_id, status)
    """
    from app.llm import extract_name_from_email
    personal_details = {"name": extract_name_from_email(data["from_email"])}

    resp = call_create_ticket(
        client_id,
        data["from_email"],
        data["subject"],
        data["body"],
        "Ticket_Generated",
        personal_details=personal_details
    )
    logger.info(f"🎫 Ticket response: {resp}")

    outgoing_ticket_id = resp.get("ticket_id") if resp else None

    if not outgoing_ticket_id:
        logger.error(f"❌ ticket_creation_failed — CRM returned no ticket_id. resp={resp}")
        return None, None, "ticket_creation_failed"

    ticket_status   = resp.get("status",   "NEW")
    ticket_priority = resp.get("priority", priority)
    ticket_issue    = data.get("subject",  "N/A")
    ticket_remarks  = resp.get("remarks",  "")

    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ticket_record (
                ticket_id  VARCHAR(50)  NOT NULL PRIMARY KEY,
                client_id  VARCHAR(50)  NOT NULL,
                mail_id    VARCHAR(100) NOT NULL,
                subject    TEXT         NOT NULL,
                body       TEXT         NOT NULL,
                status     VARCHAR(50)  NOT NULL,
                created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
            )
        """)
        try:
            cursor.execute("ALTER TABLE ticket_record CHANGE user_id client_id VARCHAR(50) NOT NULL")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE ticket_record ADD COLUMN sentiment VARCHAR(50) DEFAULT 'Neutral'")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE ticket_record ADD COLUMN priority VARCHAR(50) DEFAULT 'Medium'")
        except Exception:
            pass

        cursor.execute("SELECT COUNT(*) FROM ticket_record WHERE ticket_id = %s", (outgoing_ticket_id,))
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                INSERT INTO ticket_record (ticket_id, client_id, mail_id, subject, body, status, sentiment, priority)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                outgoing_ticket_id,
                client_id,
                data.get("mail_id", f"msg-{outgoing_ticket_id}"),
                data["subject"],
                data["body"],
                "Ticket_Generated",
                sentiment,
                priority
            ))
            logger.info(f"✅ Ticket saved to ticket_record: {outgoing_ticket_id}")
    except Exception as t_err:
        logger.warning(f"⚠️ Failed to save ticket_record: {t_err}")

    ticket_context = (
        f"Ticket ID: {outgoing_ticket_id}\n"
        f"Status: {ticket_status}\n"
        f"Priority: {ticket_priority}\n"
        f"Issue: {ticket_issue}\n"
        f"Remarks: {ticket_remarks}"
    )

    reply = generate_reply_llm(
        context=ticket_context,
        query=data["body"],
        agent_type="ecommerce_support_agent",
        from_email=data["from_email"],
        is_ticket=True,
        ticket_id=outgoing_ticket_id,
        history=history
    )

    send_status = send_email(
        client_id,
        data["from_email"],
        f"Ticket Update: {outgoing_ticket_id}",
        reply
    )

    status = "ticket_created_and_sent" if send_status else "ticket_created_send_failed"
    return reply, outgoing_ticket_id, status



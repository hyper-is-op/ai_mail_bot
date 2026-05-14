from worker.celery_worker import celery
from app.rag import query_rag, get_rag_id
from app.llm import generate_reply_llm, detect_intent_llm
from app.scoring import llm_score
from app.decision import decision_engine
from app.mailer import send_email
from app.db import get_db
import random
from datetime import datetime
from app.request_handler import call_create_ticket, get_order_status

import logging
import re

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# 🔁 Backup: extract order_id via regex (LLM fail case)
def extract_order_id(text):
    match = re.search(r'ORD\d+', text)
    return match.group(0) if match else None

def generate_ticket_id():
    date_part = datetime.now().strftime("%y%m%d")  # YYMMDD
    random_part = str(random.randint(0, 99999)).zfill(5)  # 5 digit
    return f"T-{date_part}-{random_part}"


@celery.task(bind=True, max_retries=3)
def process_email_task(self, data):
    logger.info(f"📥 Received email task: from={data.get('from_email')} subject={data.get('subject')}")

    try:
        db = get_db()
        cursor = db.cursor()

        # ==============================
        # 🛠 Ensure Tables
        # ==============================
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS email_customers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) UNIQUE,
            rag_id VARCHAR(255),
            customer_name VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS email_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
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

        # ==============================
        # 🔎 Get RAG ID
        # ==============================
        rag_id = get_rag_id(data["from_email"])
        logger.info(f"🔎 RAG ID lookup result: {rag_id}")

        email_query = f"Subject: {data['subject']}\n\n{data['body']}"

        # ==============================
        # 🧠 STEP 1: Intent Detection
        # ==============================
        intent_data = detect_intent_llm(email_query)

        intent = intent_data.get("intent")
        ticket_id = intent_data.get("ticket_id")

        # fallback regex if LLM fails
        if not ticket_id:
            ticket_id = extract_order_id(email_query)

        logger.info(f"🎯 Intent: {intent}, Ticket ID: {ticket_id}")

        # ==============================
        # 🔀 STEP 2: Routing
        # ==============================
        if intent == "track_order" or ticket_id:

            logger.info("🚀 Calling Order Status API")
            api_res = get_order_status(ticket_id)

            if api_res.get("success") == True:
                ticket_data = api_res.get("data", {})

                # Extract first ticket object
                ticket_info = next(iter(ticket_data.values()), {})

                context = f"""
                Ticket ID: {ticket_info.get('docket_no', 'N/A')}
                Status: {ticket_info.get('ticket_status', 'N/A')}
                Priority: {ticket_info.get('priority_name', 'N/A')}
                Ticket Type: {ticket_info.get('ticket_type', 'N/A')}
                Issue Reported: {ticket_info.get('problem_reported', 'N/A')}
                Agent Remarks: {ticket_info.get('agent_remarks', 'N/A')}
                Disposition: {ticket_info.get('disposition_name', 'N/A')}
                Sub Disposition: {ticket_info.get('sub_disposition_name', 'N/A')}
                Assigned Department: {ticket_info.get('assigned_to_dept_name', 'N/A')}
                Assigned User: {ticket_info.get('assigned_to_user_name', 'N/A')}
                Customer Name: {ticket_info.get('person', {}).get('person_name', 'N/A')}
                Customer Email: {ticket_info.get('person', {}).get('person_mail', 'N/A')}
                Customer Mobile: {ticket_info.get('person', {}).get('mobile_no', 'N/A')}
                """

                logger.info(f"📄 Ticket Context:\n{context}")

            else:
                logger.warning("⚠️ API failed, fallback to RAG")
                rag_res = query_rag(rag_id, email_query)
                context = rag_res.get("answer", "")

        else:
            logger.info("📚 Using RAG")
            rag_res = query_rag(rag_id, email_query)
            context = rag_res.get("answer", "")

        logger.info(f"📝 Context ready: {context[:200]}...")

        # ==============================
        # ✨ STEP 3: Generate Reply
        # ==============================
        reply = generate_reply_llm(context, data["body"], data["from_email"])
        logger.info(f"✅ Reply generated: {reply[:200]}...")

        # ==============================
        # 📊 STEP 4: Score + Decision
        # ==============================
        score = llm_score(reply, data["body"])
        logger.info(f"📊 Reply score: {score}")

        action = decision_engine(score)
        logger.info(f"🤖 Decision result: {action}")

        # ==============================
        # 📤 STEP 5: Action Handling
        # ==============================
        if action == "auto_send":
            # Score >= 80: Send simple reply
            logger.info("✉️ Sending simple email automatically (score >= 80)")
            send_status = send_email(
                data["from_email"],
                "Re: " + data["subject"],
                reply
            )
            status = "sent" if send_status else "send_failed"

        elif action == "create_ticket":
            # Score < 80: Create ticket AND send formatted email
            logger.info("🎫 Creating ticket...")
            resp = call_create_ticket(
                111,
                data["from_email"],
                data["subject"],
                data["body"],
                "Ticket_Generated"
            )
            logger.info(f"🎫 Ticket response: {resp}")
            
            # Extract ticket info from response
            # ticket_id = resp.get("ticket_id", "N/A") if resp else "N/A"
            ticket_id = resp.get("ticket_id") if resp else None
            if not ticket_id:
                ticket_id = generate_ticket_id()
            ticket_status = resp.get("status", "NEW") if resp else "NEW"
            ticket_priority = resp.get("priority", "Normal") if resp else "Normal"
            ticket_issue = data.get("subject", "N/A")
            ticket_remarks = resp.get("remarks", "") if resp else ""
            
            # Generate formatted ticket email using LLM
            formatted_reply = generate_reply_llm(
                context=f"Ticket ID: {ticket_id}\nStatus: {ticket_status}\nPriority: {ticket_priority}\nIssue: {ticket_issue}\nRemarks: {ticket_remarks}",
                query=data["body"],
                from_email=data["from_email"],
                is_ticket=True,
                ticket_id=ticket_id
            )
            
            # Send formatted ticket email
            logger.info("✉️ Sending formatted ticket email")
            send_status = send_email(
                data["from_email"],
                f"Ticket Update: {ticket_id}",
                formatted_reply
            )
            
            reply = formatted_reply  # Update reply for logging
            status = "ticket_created_and_sent" if send_status else "ticket_created_send_failed"

        # ==============================
        # 💾 STEP 6: Save Logs
        # ==============================
        cursor.execute("""
            INSERT INTO email_logs (from_email, subject, body, reply, score, status, rag_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
        """, (
            data["from_email"],
            data["subject"],
            data["body"],
            reply,
            score,
            status,
            rag_id
        ))

        db.commit()
        db.close()

        logger.info("✅ Task completed successfully")

    except Exception as e:
        logger.error(f"❌ Task failed: {e}", exc_info=True)
        raise self.retry(exc=e, countdown=10)

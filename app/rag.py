import os
import requests
import logging
from fastapi import FastAPI
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

class EmailRequest(BaseModel):
    from_email: str
    subject: str
    body: str

@app.get("/")
def home():
    return {"status": "mail_ai_automation running"}

@app.post("/process-email")
def process_email(data: EmailRequest):
    from worker.tasks import process_email_task
    process_email_task.delay(data.dict())
    return {"status": "queued"}

def get_rag_id(from_email: str) -> str:
    """
    Get RAG ID for a specific email sender from database.
    Fetches the rag_id mapped to the from_email from email_customers table.
    Example: "bfcd1ef8-3ae9-41cd-a0e9-678fe1439899"
    """
    try:
        from app.db import get_db
        db = get_db()
        cursor = db.cursor()
        
        cursor.execute("SELECT rag_id FROM email_customers WHERE email = %s LIMIT 1", (from_email,))
        result = cursor.fetchone()
        cursor.close()
        db.close()
        
        if result:
            logger.info(f"✅ RAG ID found for {from_email}: {result[0]}")
            return result[0]  # Return rag_id from database
        else:
            # If email not found, return None
            logger.warning(f"⚠️  No RAG ID found for {from_email}")
            return None
    except Exception as e:
        # Log error and return None
        logger.error(f"❌ Error fetching rag_id for {from_email}: {str(e)}")
        return None

def query_rag(rag_id: str, query: str) -> dict:
    """
    Query RAG API to get context for the email query.
    Calls https://aai.c-zentrixcloud.com/utils/query endpoint
    """
    try:
        rag_url = os.getenv("RAG_QUERY_URL", "https://aai.c-zentrixcloud.com/utils/query")
        
        logger.info(f"🔍 RAG Query - ID: {rag_id}")
        logger.info(f"📝 Query Text: {query[:200]}...")  # Log first 200 chars
        
        payload = {
            "rag_id": rag_id,
            "query": query,
            "top_k": 5
        }
        
        headers = {
            "accept": "application/json",
            "Content-Type": "application/json"
        }
        
        logger.info(f"🌐 Calling RAG API: {rag_url}")
        response = requests.post(rag_url, json=payload, headers=headers, timeout=10)
        response.raise_for_status()
        
        result = response.json()
        answer = result.get("answer", "No context found")
        logger.info(f"✅ RAG Response: {answer[:200]}...")  # Log first 200 chars
        return {"answer": answer}
    
    except requests.exceptions.RequestException as e:
        # Fallback if RAG API fails
        logger.error(f"❌ RAG API Error: {str(e)}")
        return {"answer": f"Could not retrieve context: {str(e)}"}
    except Exception as e:
        logger.error(f"❌ RAG Query Error: {str(e)}")
        return {"answer": f"Error querying RAG: {str(e)}"}


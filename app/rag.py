import os
import json
import logging
import uuid
import requests
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Any


logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Persistent path for ChromaDB/Fallback inside workspace
CHROMA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "chroma_db")
os.makedirs(CHROMA_PATH, exist_ok=True)
logger.info(f"📂 CHROMA_PATH={CHROMA_PATH}")  # ← add here (temp)

CHROMA_AVAILABLE = False
try:
    import chromadb
    CHROMA_AVAILABLE = True
except Exception as e:
    logger.warning(f"⚠️ ChromaDB import failed: {str(e)}. Fallback JSON database will be used automatically.")



_chroma_client = None

CHROMA_HOST = os.getenv("CHROMA_HOST", "mail_ai_chroma")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", "8000"))

def get_chroma_client():
    global _chroma_client
    if not CHROMA_AVAILABLE:
        return None
    if _chroma_client is None:
        try:
            import chromadb
            _chroma_client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
            _chroma_client.heartbeat()
            logger.info(f"✅ Connected to ChromaDB HTTP server at {CHROMA_HOST}:{CHROMA_PORT}")
        except Exception as e:
            logger.error(f"❌ Failed to connect to ChromaDB HTTP server: {e}")
            return None
    return _chroma_client

# ==========================================
# 🛠️ FALLBACK JSON DATABASE SERVICES
# ==========================================
FALLBACK_DB_PATH = os.path.join(CHROMA_PATH, "fallback_db.json")

def load_fallback_db() -> dict:
    if os.path.exists(FALLBACK_DB_PATH):
        try:
            with open(FALLBACK_DB_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"❌ Failed to load fallback DB: {e}")
            return {}
    return {}

def save_fallback_db(data: dict):
    try:
        with open(FALLBACK_DB_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"❌ Failed to save fallback DB: {e}")

def jaccard_similarity(text1: str, text2: str) -> float:
    words1 = set(text1.lower().split())
    words2 = set(text2.lower().split())
    if not words1 or not words2:
        return 0.0
    return len(words1.intersection(words2)) / len(words1.union(words2))

# ==========================================
# 🚀 CORE RAG API INTERFACES (USER-ISOLATED)
# ==========================================

def split_text(text: str, chunk_size: int = 1500, overlap: int = 200) -> list[str]:
    """
    Splits text content into overlapping chunks to optimize vector database retrieval
    accuracy and stay within token/embedding constraints.
    """
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        if end == len(text):
            break
        start += chunk_size - overlap
    return chunks


def add_knowledge(client_id: str, title: str, content: str) -> str:
    existing_rag_id = None
    try:
        from app.db import get_db_ctx
        with get_db_ctx() as db:
            cursor = db.cursor()
            cursor.execute("SELECT collect_name FROM email_customers WHERE client_id = %s LIMIT 1", (client_id,))
            res = cursor.fetchone()
            if res and res[0]:
                existing_collect_name = res[0]
                logger.info(f"🔎 Found existing collect_name={existing_collect_name} in database for client_id={client_id}")
    except Exception as e:
        logger.warning(f"⚠️ Failed to check for existing collect_name: {e}")

    rag_id = existing_rag_id if existing_rag_id else str(uuid.uuid4())
    doc_id = str(uuid.uuid4())
    logger.info(f"Adding knowledge for client_id={client_id}, rag_id={rag_id}, doc_id={doc_id}, title={title}")

    collection_name = f"client_{client_id.replace('-', '_').lower()}"
    saved_successfully = False
    try:
        chroma_client = get_chroma_client()
    except Exception as e:
        logger.error(f"❌ Failed to initialize ChromaDB: {e}")
        chroma_client = None
        
    if chroma_client:
        try:
            collection = chroma_client.get_or_create_collection(name=collection_name)

            # Clean corrupted documents
            try:
                existing = collection.get()
                bad_ids = [
                    existing["ids"][i]
                    for i, doc in enumerate(existing.get("documents", []))
                    if doc is None
                ]
                if bad_ids:
                    collection.delete(ids=bad_ids)
                    logger.info(f"🧹 Cleaned {len(bad_ids)} corrupted documents from collection")
            except Exception as e:
                logger.warning(f"⚠️ Failed to clean corrupted documents: {e}")

            # Split document into overlapping chunks
            chunks = split_text(content)
            if not chunks:
                chunks = [content]

            chunk_ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
            chunk_metadatas = [
                {
                    "title": title, 
                    "client_id": client_id, 
                    "doc_id": doc_id, 
                    "chunk_index": i,
                    "total_chunks": len(chunks)
                } 
                for i in range(len(chunks))
            ]

            collection.add(
                documents=chunks,
                metadatas=chunk_metadatas,
                ids=chunk_ids
            )
            logger.info(f"✅ Chunked and saved to ChromaDB collection: {collection_name} ({len(chunks)} chunks)")
            saved_successfully = True
        except Exception as e:
            logger.error(f"❌ ChromaDB add failed, falling back to JSON: {e}")

    if not saved_successfully:
        db = load_fallback_db()
        if client_id not in db:
            db[client_id] = []
        db[client_id].append({
            "id": doc_id,
            "title": title,
            "content": content
        })
        save_fallback_db(db)
        logger.info("✅ Saved to Fallback JSON Database")


    try:
        from app.db import get_db_ctx
        with get_db_ctx() as db:
            cursor = db.cursor()
            customer_name = client_id
            try:
                cursor.execute("SHOW COLUMNS FROM users")
                columns = [col[0] for col in cursor.fetchall()]
                name_col = None
                for candidate in ["customer_name", "name", "username", "email"]:
                    if candidate in columns:
                        name_col = candidate
                        break
                if name_col:
                    cursor.execute(f"SELECT {name_col} FROM users WHERE client_id = %s LIMIT 1", (client_id,))
                    user_res = cursor.fetchone()
                    if user_res and user_res[0]:
                        val = user_res[0]
                        if name_col == "email":
                            customer_name = val.split('@')[0].capitalize()
                        else:
                            customer_name = str(val).capitalize()
                logger.info(f"👤 Retrieved customer name from users table: {customer_name}")
            except Exception as ue:
                logger.warning(f"⚠️ Could not fetch customer name from users table: {ue}")

            cursor.execute("""
                INSERT INTO email_customers (client_id, collect_name, customer_name)
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE collect_name = VALUES(collect_name), customer_name = VALUES(customer_name)
            """, (client_id, collection_name, customer_name))
            db.commit()
            logger.info(f"✅ Saved RAG ID link in database: client_id={client_id} -> rag_id={collection_name}, customer_name={customer_name}")
    except Exception as e:
        logger.error(f"❌ Failed to save RAG ID to email_customers database: {e}")

    return doc_id


def get_knowledge_base(client_id: str) -> list[dict]:
    """
    Retrieves all knowledge entries for a specific client_id (or ALL clients).
    """
    logger.info(f"Fetching knowledge base for client_id={client_id}")
    
    if client_id == "ALL":
        # Fetch all collections/clients
        all_clients = []
        try:
            from app.db import get_db_ctx
            with get_db_ctx() as db:
                cursor = db.cursor()
                cursor.execute("SELECT client_id, collect_name FROM email_customers")
                all_clients = cursor.fetchall()
        except Exception as e:
            logger.warning(f"⚠️ Failed to fetch all clients for list: {e}")
            
        chroma_client = get_chroma_client()
        all_docs = []
        if chroma_client:
            try:
                collections = [col.name for col in chroma_client.list_collections()]
                for cid, collect_name in all_clients:
                    collection_name = collect_name or f"client_{cid.replace('-', '_').lower()}"
                    if collection_name in collections:
                        collection = chroma_client.get_collection(name=collection_name)
                        results = collection.get()
                        
                        unique_docs = {}
                        for i in range(len(results.get("ids", []))):
                            metadata = results["metadatas"][i]
                            p_doc_id = metadata.get("doc_id", results["ids"][i].split("_chunk_")[0])
                            title = metadata.get("title", "Untitled Document")
                            content = results["documents"][i]
                            
                            if p_doc_id not in unique_docs:
                                unique_docs[p_doc_id] = {
                                    "id": p_doc_id,
                                    "title": f"[{cid}] {title}",
                                    "chunks_count": 1,
                                    "content": content,
                                    "client_id": cid
                                }
                            else:
                                unique_docs[p_doc_id]["chunks_count"] += 1
                                if len(unique_docs[p_doc_id]["content"]) < 300:
                                    unique_docs[p_doc_id]["content"] += "\n" + content
                                    
                        all_docs.extend(list(unique_docs.values()))
                return all_docs
            except Exception as e:
                logger.error(f"❌ ChromaDB get failed for ALL, falling back to JSON: {e}")
                
        # Fallback JSON
        db = load_fallback_db()
        fallback_docs = []
        for cid, docs in db.items():
            for doc in docs:
                fallback_docs.append({
                    "id": doc["id"],
                    "title": f"[{cid}] {doc['title']}",
                    "content": doc["content"],
                    "client_id": cid
                })
        return fallback_docs

    # Fetch rag_id from database
    # rag_id = client_id
    collect_name = f"client_{client_id.replace('-', '_').lower()}"  # default fallback
    try:
        from app.db import get_db_ctx
        with get_db_ctx() as db:
            cursor = db.cursor()
            cursor.execute("SELECT collect_name FROM email_customers WHERE client_id = %s LIMIT 1", (client_id,))
            res = cursor.fetchone()
            if res and res[0]:
                collect_name = res[0]
    except Exception as e:
        logger.warning(f"⚠️ Failed to fetch collect_name from database for list: {e}")

    chroma_client = get_chroma_client()
    if chroma_client:
        try:
            collection_name = collect_name
            # Check if collection exists
            collections = [col.name for col in chroma_client.list_collections()]
            if collection_name in collections:
                collection = chroma_client.get_collection(name=collection_name)
                results = collection.get()
                
                # Group chunks by doc_id to represent each uploaded document cleanly in the UI
                unique_docs = {}
                for i in range(len(results.get("ids", []))):
                    metadata = results["metadatas"][i]
                    # Determine parent doc_id (fall back to splitting chunk ID if missing)
                    p_doc_id = metadata.get("doc_id", results["ids"][i].split("_chunk_")[0])
                    title = metadata.get("title", "Untitled Document")
                    content = results["documents"][i]
                    
                    if p_doc_id not in unique_docs:
                        unique_docs[p_doc_id] = {
                            "id": p_doc_id,
                            "title": title,
                            "chunks_count": 1,
                            "content": content
                        }
                    else:
                        unique_docs[p_doc_id]["chunks_count"] += 1
                        # Build document preview content up to a threshold
                        if len(unique_docs[p_doc_id]["content"]) < 300:
                            unique_docs[p_doc_id]["content"] += "\n" + content
                            
                return list(unique_docs.values())
            return []
        except Exception as e:
            logger.error(f"❌ ChromaDB get failed, falling back to JSON: {e}")

            
    # Fallback JSON
    db = load_fallback_db()
    return db.get(client_id, [])


def delete_knowledge(client_id: str, doc_id: str) -> bool:
    """
    Deletes a knowledge document by ID.
    """
    logger.info(f"Deleting knowledge for client_id={client_id}, doc_id={doc_id}")
    
    # Fetch rag_id from database
    rag_id = client_id
    collect_name = f"client_{client_id.replace('-', '_').lower()}"  # default fallback
    try:
        from app.db import get_db_ctx
        with get_db_ctx() as db:
            cursor = db.cursor()
            cursor.execute("SELECT collect_name FROM email_customers WHERE client_id = %s LIMIT 1", (client_id,))
            res = cursor.fetchone()
            if res and res[0]:
                collect_name = res[0]
    except Exception as e:
        logger.warning(f"⚠️ Failed to fetch collect_name from database for delete: {e}")

    chroma_client = get_chroma_client()
    if chroma_client:
        try:
            collection_name = collect_name
            collection = chroma_client.get_collection(name=collection_name)
            
            # Clean delete matching doc_id in metadata filter (covers all chunks securely)
            try:
                collection.delete(where={"doc_id": doc_id})
                logger.info(f"✅ Deleted all vector store chunks matching doc_id={doc_id}")
            except Exception as delete_err:
                logger.warning(f"⚠️ Metadatas search deletion failed, trying direct ID lookup: {delete_err}")
                collection.delete(ids=[doc_id])
                
            return True
        except Exception as e:
            logger.error(f"❌ ChromaDB delete failed, falling back to JSON: {e}")

            
    # Fallback JSON
    db = load_fallback_db()
    if client_id in db:
        initial_len = len(db[client_id])
        db[client_id] = [doc for doc in db[client_id] if doc["id"] != doc_id]
        save_fallback_db(db)
        logger.info("✅ Deleted from Fallback JSON successfully")
        return len(db[client_id]) < initial_len
    return False


def query_knowledge(client_id: str, query: str, top_k: int = 3) -> str:
    """
    Queries ChromaDB (or Fallback Jaccard similarity) for isolated client_id RAG context.
    """
    logger.info(f"Querying knowledge for client_id={client_id}, query={query[:100]}...")
    
    collect_name = f"client_{client_id.replace('-', '_').lower()}"  # default fallback
    try:
        from app.db import get_db_ctx
        with get_db_ctx() as db:
            cursor = db.cursor()
            cursor.execute("SELECT collect_name FROM email_customers WHERE client_id = %s LIMIT 1", (client_id,))
            res = cursor.fetchone()
            if res and res[0]:
                collect_name = res[0]
                logger.info(f"🔎 Found collect_name={collect_name} in database for client_id={client_id}")
    except Exception as e:
        logger.warning(f"⚠️ Failed to fetch collect_name from database: {e}")

    chroma_client = None
    try:
        chroma_client = get_chroma_client()
    except Exception as e:
        logger.error(f"❌ Failed to initialize ChromaDB: {e}")
        chroma_client = None

    if chroma_client:
        try:
            collection_name = collect_name
            collections = [col.name for col in chroma_client.list_collections()]
            if collection_name in collections:
                collection = chroma_client.get_collection(name=collection_name)
                logger.info(f"📊 Collection count: {collection.count()}")
                results = collection.query(
                    query_texts=[query],
                    # n_results=top_k
                    n_results=min(top_k, collection.count())  # ← temp fix this
                )
                logger.info(f"🔍 Raw ChromaDB results: {results.get('documents', [])}")
                
                documents = results.get("documents", [[]])[0]
                documents = [doc for doc in documents if doc is not None]
                if documents:
                    context = "\n---\n".join(documents)
                    logger.info(f"✅ ChromaDB RAG retrieved context length: {len(context)}")
                    logger.info(f"🔍🔍🔍🔍 RAG context: {context[:1000]}")
                    logger.info(f"🔍🔍🔍🔍 Ending")
                    return context
            names = [col.name for col in chroma_client.list_collections()]
            logger.warning(f"⚠️ ChromaDB collections available: {names}")
            logger.warning(f"⚠️ ChromaDB Collection {collection_name} not found or empty")
        except Exception as e:
            logger.error(f"❌ ChromaDB query failed, falling back to JSON: {e}")

    # Fallback Jaccard / Keyword matching
    db = load_fallback_db()
    docs = db.get(client_id, [])
    if not docs:
        return ""
        
    ranked = []
    for doc in docs:
        score = jaccard_similarity(query, doc["content"])
        ranked.append((score, doc["content"]))
        
    ranked.sort(key=lambda x: x[0], reverse=True)
    top_matches = [doc[1] for doc in ranked[:top_k] if doc[0] > 0.0]
    
    if top_matches:
        context = "\n---\n".join(top_matches)
        logger.info(f"✅ Fallback RAG retrieved context length: {len(context)}")
        logger.info(f"🔍🔍🔍 RAG context: {context[:1000]}")
        logger.info(f"🔍🔍🔍 Ending")
        return context
        
    context = "\n---\n".join([doc["content"] for doc in docs[:2]])
    logger.info(f"✅ Fallback Default RAG context length: {len(context)}")
    return context

# ==========================================
# 📦 LEGACY COMPATIBILITY API
# ==========================================
def get_rag_id(client_id: str) -> str:
    if not client_id:
        return None
    try:
        from app.db import get_db_ctx
        with get_db_ctx() as db:
            cursor = db.cursor()
            cursor.execute("SELECT collect_name FROM email_customers WHERE client_id = %s LIMIT 1", (client_id,))
            result = cursor.fetchone()
            if result:
                return result[0]
            return None
    except Exception as e:
        logger.error(f"❌ Error fetching collect_name: {str(e)}")
        return None

def query_rag(collect_name: str, query: str) -> dict:
    if not collect_name:
        return {"answer": ""}
    try:
        real_client_id = collect_name
        # If the passed collect_name is a UUID, look up the corresponding client_id in email_customers table
        try:
            from app.db import get_db_ctx
            with get_db_ctx() as db:
                cursor = db.cursor()
                cursor.execute("SELECT client_id FROM email_customers WHERE collect_name = %s OR client_id = %s LIMIT 1", (collect_name, collect_name))
                res = cursor.fetchone()
                if res:
                    real_client_id = res[0]
                    logger.info(f"🔎 Resolved collect_name={collect_name} to real_client_id={real_client_id}")
        except Exception as e:
            logger.warning(f"⚠️ Failed to look up client_id for collect_name={collect_name} in email_customers: {e}")

        # Search our own local client-isolated ChromaDB / Fallback JSON RAG database!
        context = query_knowledge(real_client_id, query)
        # logger.info(f"🔍 RAG context returned: {context[:1000] if context else 'EMPTY'}")
        # print("p-----------------================------==============-=")
        return {"answer": context if context else "No context found in local RAG database."}
    except Exception as e:
        logger.error(f"❌ Local Custom RAG API error: {str(e)}")
        return {"answer": f"Could not retrieve context from local RAG: {str(e)}"}


# ==========================================
# 📂 ADVANCED DOCUMENT PARSERS
# ==========================================

def parse_docx(file_content: bytes) -> str:
    import zipfile
    import xml.etree.ElementTree as ET
    from io import BytesIO
    
    try:
        f = BytesIO(file_content)
        with zipfile.ZipFile(f) as docx:
            xml_content = docx.read('word/document.xml')
            root = ET.fromstring(xml_content)
            
            # Namespace for word processing ML
            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            
            paragraphs = []
            for para in root.findall('.//w:p', ns):
                text_parts = []
                for run in para.findall('.//w:t', ns):
                    if run.text:
                        text_parts.append(run.text)
                if text_parts:
                    paragraphs.append("".join(text_parts))
            return "\n".join(paragraphs)
    except Exception as e:
        logger.error(f"Failed to parse docx: {e}")
        return file_content.decode('utf-8', errors='ignore')

def parse_uploaded_file(file_name: str, file_content: bytes) -> tuple[str, str]:
    """
    Parses a PDF, DOCX, DOC, or TXT file and returns a tuple (title, content).
    Only allows these specific formats.
    """
    ext = file_name.split('.')[-1].lower()
    logger.info(f"Parsing uploaded file: name={file_name}, ext={ext}")

    if ext == 'txt':
        content = file_content.decode('utf-8', errors='ignore')
        return file_name, content.strip()

    elif ext == 'docx':
        content = parse_docx(file_content)
        return file_name, content.strip()

    elif ext == 'doc':
        try:
            decoded = file_content.decode('utf-16', errors='ignore')
            content = "".join([c for c in decoded if c.isprintable() or c in '\n\r\t'])
            if len(content.strip()) < 50:
                decoded = file_content.decode('utf-8', errors='ignore')
                content = "".join([c for c in decoded if c.isprintable() or c in '\n\r\t'])
        except Exception:
            content = file_content.decode('utf-8', errors='ignore')
        return file_name, content.strip()

    elif ext == 'pdf':
        import io
        from pypdf import PdfReader
        f = io.BytesIO(file_content)
        reader = PdfReader(f)
        text = ""
        for i, page in enumerate(reader.pages):
            t = page.extract_text()
            if t:
                text += f"--- Page {i+1} ---\n" + t + "\n"
        return file_name, text.strip()

    else:
        raise ValueError(f"Unsupported file format: .{ext}. Only .pdf, .doc, .docx, and .txt files are allowed.")


def retrieve_knowledge(client_id: str, query: str, top_k: int = 3) -> list[dict]:
    """
    Structured semantic retriever service for client-isolated vector index.
    Returns a list of matching chunks with details (metadata, content, similarity score).
    """
    logger.info(f"Retrieving structured knowledge for client_id={client_id}, query={query[:50]}")
    
    if client_id == "ALL":
        # Fetch all collections/clients
        all_clients = []
        try:
            from app.db import get_db_ctx
            with get_db_ctx() as db:
                cursor = db.cursor()
                cursor.execute("SELECT client_id, collect_name FROM email_customers")
                all_clients = cursor.fetchall()
        except Exception as e:
            logger.warning(f"⚠️ Failed to fetch all clients for retrieve: {e}")
            
        chroma_client = get_chroma_client()
        all_results = []
        if chroma_client:
            try:
                collections = [col.name for col in chroma_client.list_collections()]
                for cid, collect_name in all_clients:
                    collection_name = collect_name or f"client_{cid.replace('-', '_').lower()}"
                    if collection_name in collections:
                        collection = chroma_client.get_collection(name=collection_name)
                        results = collection.query(
                            query_texts=[query],
                            n_results=min(top_k, collection.count())
                        )
                        
                        documents = results.get("documents", [[]])[0]
                        metadatas = results.get("metadatas", [[]])[0]
                        distances = results.get("distances", [[]])[0] if results.get("distances") else [0.0] * len(documents)
                        ids = results.get("ids", [[]])[0]
                        
                        for i in range(len(documents)):
                            if documents[i] is not None:
                                score = round(1.0 - min(1.0, distances[i] / 2.0), 3) if results.get("distances") else 1.0
                                all_results.append({
                                    "id": ids[i],
                                    "title": f"[{cid}] {metadatas[i].get('title', 'Untitled Document')}",
                                    "doc_id": metadatas[i].get("doc_id", ids[i].split("_chunk_")[0]),
                                    "content": documents[i],
                                    "score": score,
                                    "client_id": cid
                                })
                all_results.sort(key=lambda x: x["score"], reverse=True)
                return all_results[:top_k]
            except Exception as e:
                logger.error(f"❌ ChromaDB retrieval failed for ALL, falling back to JSON: {e}")
                
        # Fallback JSON
        db = load_fallback_db()
        fallback_results = []
        for cid, docs in db.items():
            for doc in docs:
                score = jaccard_similarity(query, doc["content"])
                fallback_results.append({
                    "id": doc["id"],
                    "title": f"[{cid}] {doc['title']}",
                    "doc_id": doc["id"],
                    "content": doc["content"],
                    "score": round(score, 3),
                    "client_id": cid
                })
        fallback_results.sort(key=lambda x: x["score"], reverse=True)
        return [r for r in fallback_results[:top_k] if r["score"] > 0.0]

    collect_name = f"client_{client_id.replace('-', '_').lower()}"
    try:
        from app.db import get_db_ctx
        with get_db_ctx() as db:
            cursor = db.cursor()
            cursor.execute("SELECT collect_name FROM email_customers WHERE client_id = %s LIMIT 1", (client_id,))
            res = cursor.fetchone()
            if res and res[0]:
                collect_name = res[0]
    except Exception as e:
        logger.warning(f"⚠️ Failed to fetch collect_name: {e}")

    chroma_client = None
    try:
        chroma_client = get_chroma_client()
    except Exception as e:
        logger.error(f"❌ Failed to initialize ChromaDB: {e}")

    if chroma_client:
        try:
            collection_name = collect_name
            collections = [col.name for col in chroma_client.list_collections()]
            if collection_name in collections:
                collection = chroma_client.get_collection(name=collection_name)
                results = collection.query(
                    query_texts=[query],
                    n_results=min(top_k, collection.count())
                )
                
                retrieved = []
                documents = results.get("documents", [[]])[0]
                metadatas = results.get("metadatas", [[]])[0]
                distances = results.get("distances", [[]])[0] if results.get("distances") else [0.0] * len(documents)
                ids = results.get("ids", [[]])[0]
                
                for i in range(len(documents)):
                    if documents[i] is not None:
                        # Convert distance to simple score
                        score = round(1.0 - min(1.0, distances[i] / 2.0), 3) if results.get("distances") else 1.0
                        retrieved.append({
                            "id": ids[i],
                            "title": metadatas[i].get("title", "Untitled Document"),
                            "doc_id": metadatas[i].get("doc_id", ids[i].split("_chunk_")[0]),
                            "content": documents[i],
                            "score": score
                        })
                return retrieved
        except Exception as e:
            logger.error(f"❌ ChromaDB retrieval failed, falling back to JSON: {e}")

    # Fallback JSON Jaccard Search
    db = load_fallback_db()
    docs = db.get(client_id, [])
    if not docs:
        return []
        
    ranked = []
    for doc in docs:
        score = jaccard_similarity(query, doc["content"])
        ranked.append({
            "id": doc["id"],
            "title": doc["title"],
            "doc_id": doc["id"],
            "content": doc["content"],
            "score": round(score, 3)
        })
        
    ranked.sort(key=lambda x: x["score"], reverse=True)
    return [r for r in ranked[:top_k] if r["score"] > 0.0]



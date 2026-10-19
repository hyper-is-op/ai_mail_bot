#!/usr/bin/env python3
"""
Diagnostic RAG & Knowledge Base Inspector CLI.
Allows operators and engineers to test semantic retrieval queries against
both Qdrant vector store and the local JSON fallback store.
Reveals similarity scores, chunk matches, embedding latencies, and explains
why queries succeed or trigger 'Knowledge_Search_Empty'.
"""

import sys
import os
import time

# Early environment and interpreter bootstrap before custom/third-party imports
_VENV_PYTHON = "/home/hyper_is_op/.venv/bin/python"
if os.path.exists(_VENV_PYTHON) and sys.executable != _VENV_PYTHON:
    try:
        import requests
        import pymysql
    except ImportError:
        if sys.argv and not sys.argv[0].startswith("-"):
            os.execv(_VENV_PYTHON, [_VENV_PYTHON] + sys.argv)

import argparse
import requests
from typing import List, Dict, Any, Optional, Tuple

# Ensure project root is in sys.path
_HERE = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.abspath(os.path.join(_HERE, ".."))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from diagnostic_tools.diag_common import (
    ensure_venv,
    get_db_cursor,
    Color,
    header,
    subheader,
    badge,
    truncate
)

def get_embed_service_url() -> str:
    # Check localhost first (if on host), else container name
    for url in ["http://localhost:8500", "http://mail_ai_embed_service:8500", os.getenv("EMBED_SERVICE_URL", "")]:
        if not url:
            continue
        try:
            r = requests.get(f"{url}/health", timeout=1.0)
            if r.status_code == 200:
                return url
        except Exception:
            pass
    return "http://localhost:8500"


def get_qdrant_url() -> str:
    for url in ["http://localhost:6333", "http://mail_ai_qdrant:6333", f"http://{os.getenv('QDRANT_HOST', 'localhost')}:{os.getenv('QDRANT_PORT', '6333')}"]:
        try:
            r = requests.get(f"{url}/healthz", timeout=1.0)
            if r.status_code == 200:
                return url
        except Exception:
            pass
    return "http://localhost:6333"


def compute_embedding(text: str, embed_url: str) -> Tuple[Optional[List[float]], float]:
    start = time.perf_counter()
    try:
        res = requests.post(
            f"{embed_url}/embed",
            json={"texts": [f"query: {text.strip()}"]},
            timeout=5.0
        )
        latency_ms = (time.perf_counter() - start) * 1000
        if res.status_code == 200:
            data = res.json()
            vecs = data.get("vectors") or data.get("embeddings", [])
            if vecs:
                return vecs[0], latency_ms
    except Exception as e:
        latency_ms = (time.perf_counter() - start) * 1000
        print(f"  {Color.RED}Embed service error: {e}{Color.RESET}")
    return None, (time.perf_counter() - start) * 1000


COLLECTION_NAME = os.getenv("QDRANT_COLLECTION", "mail_ai_knowledge")

def search_qdrant(qdrant_url: str, client_id: str, vector: List[float], limit: int = 5) -> List[Dict[str, Any]]:
    try:
        res = requests.post(
            f"{qdrant_url}/collections/{COLLECTION_NAME}/points/search",
            json={
                "vector": vector,
                "limit": limit,
                "filter": {
                    "should": [
                        {"key": "client_id", "match": {"value": client_id}},
                        {"key": "client_id", "match": {"value": client_id.lower()}}
                    ]
                },
                "with_payload": True
            },
            timeout=3.0
        )
        if res.status_code == 200:
            return res.json().get("result", [])
    except Exception as e:
        print(f"  {Color.RED}Qdrant search error ({COLLECTION_NAME}): {e}{Color.RESET}")
    return []


def search_fallback_json(client_id: str, query: str, limit: int = 5) -> List[Dict[str, Any]]:
    clean_cid = client_id.strip().lower()
    fb_path = os.path.join(_PROJECT_ROOT, "knowledge_fallback", f"fallback_{clean_cid}.json")
    if not os.path.exists(fb_path):
        fb_path = os.path.join(_PROJECT_ROOT, "knowledge_fallback", f"fallback_{clean_cid.replace('-', '_')}.json")
    if not os.path.exists(fb_path):
        return []
    try:
        import json
        with open(fb_path, "r", encoding="utf-8") as f:
            docs = json.load(f)
        try:
            from app.rag import calculate_fallback_score
        except Exception:
            def calculate_fallback_score(q, c):
                q_words = set(q.lower().split())
                c_words = set(c.lower().split())
                matches = sum(1 for w in q_words if w in c_words)
                return min(1.0, 0.4 + (matches * 0.15)) if matches else 0.0

        scored = []
        for d in docs:
            c = d.get("content") or ""
            t = d.get("title") or ""
            full_text = f"{t}\n{c}"
            s = calculate_fallback_score(query, full_text)
            if s > 0:
                scored.append({
                    "id": d.get("id"),
                    "title": t,
                    "content": c,
                    "score": s
                })
        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:limit]
    except Exception as e:
        print(f"  {Color.RED}Fallback search error: {e}{Color.RESET}")
        return []


def main():
    ensure_venv()
    parser = argparse.ArgumentParser(description="Inspect RAG retrieval performance across Qdrant and Fallback JSON.")
    parser.add_argument("query", help="Knowledge base search query string (e.g. 'cz callblast setup')")
    parser.add_argument("-c", "--client-id", dest="client_id", default="CLI-4159FFCF", help="Client ID (default: CLI-4159FFCF)")
    parser.add_argument("-k", "--limit", type=int, default=5, help="Number of chunks to return (default: 5)")
    parser.add_argument("-t", "--threshold", type=float, default=0.52, help="Minimum similarity threshold floor (default: 0.52)")

    args = parser.parse_args()

    client_id = args.client_id
    clean_cid = client_id.strip().lower().replace("-", "_")
    coll_name = f"client_{clean_cid}"

    print(header("RAG & KNOWLEDGE BASE RETRIEVAL INSPECTOR"))
    print(f" {Color.BOLD}Search Query:{Color.RESET}  {Color.BRIGHT_WHITE}\"{args.query}\"{Color.RESET}")
    print(f" {Color.BOLD}Target Client:{Color.RESET} {Color.BRIGHT_MAGENTA}{client_id}{Color.RESET}  (Collection: {coll_name})")
    print(f" {Color.BOLD}Score Floor:{Color.RESET}   {Color.BOLD}{args.threshold}{Color.RESET}")

    embed_url = get_embed_service_url()
    qdrant_url = get_qdrant_url()

    print(f" {Color.BOLD}Embed Service:{Color.RESET} {Color.CYAN}{embed_url}{Color.RESET}    "
          f"{Color.BOLD}Qdrant:{Color.RESET} {Color.CYAN}{qdrant_url}{Color.RESET}")

    # 1. Compute embedding
    vector, embed_ms = compute_embedding(args.query, embed_url)
    if vector:
        print(f"\n  {Color.GREEN}✔ Embedding generated successfully{Color.RESET} ({len(vector)} dims, {embed_ms:.1f}ms)")
    else:
        print(f"\n  {Color.RED}✖ Failed to generate embedding from {embed_url}{Color.RESET}")

    # 2. Search Qdrant
    q_results = []
    if vector:
        q_results = search_qdrant(qdrant_url, client_id, vector, limit=args.limit)

    print(subheader(f"QDRANT VECTOR SEARCH RESULTS ({len(q_results)} returned)"))
    if q_results:
        for idx, pt in enumerate(q_results, 1):
            score = pt.get("score", 0.0)
            payload = pt.get("payload", {})
            title = payload.get("title") or "-"
            chunk_id = payload.get("chunk_id") or pt.get("id")
            content = payload.get("content") or ""
            doc_id = payload.get("doc_id") or "-"

            score_styled = f"{score:.4f}"
            if score >= 0.70:
                score_badge = badge(f"HIGH {score_styled}", Color.BRIGHT_GREEN)
            elif score >= args.threshold:
                score_badge = badge(f"PASS {score_styled}", Color.GREEN)
            else:
                score_badge = badge(f"BELOW_FLOOR {score_styled}", Color.RED)

            print(f"\n  #{idx} {score_badge} Chunk ID: {chunk_id} | Doc ID: {doc_id}")
            print(f"     {Color.BOLD}Document Title:{Color.RESET} {title}")
            print(f"     {Color.DIM}Preview: {truncate(content, 180)}{Color.RESET}")
    else:
        print(f"  {Color.YELLOW}No Qdrant points returned. (Collection may be empty or score is below Qdrant filter){Color.RESET}")

    # 3. Search Fallback JSON Store
    fb_results = search_fallback_json(client_id, args.query, limit=args.limit)
    print(subheader(f"LOCAL FALLBACK JSON STORE RESULTS ({len(fb_results)} returned)"))
    if fb_results:
        for idx, doc in enumerate(fb_results, 1):
            sc = doc.get("score", 0.0)
            title = doc.get("title") or "-"
            did = doc.get("id") or doc.get("doc_id") or "-"
            content = doc.get("content") or ""
            print(f"\n  #{idx} {badge(f'{sc:.2f}', Color.BRIGHT_BLUE)} Doc ID: {did}")
            print(f"     {Color.BOLD}Title:{Color.RESET} {title}")
            print(f"     {Color.DIM}Preview: {truncate(content, 180)}{Color.RESET}")
    else:
        print(f"  {Color.DIM}No matching documents found in knowledge_fallback/client_{clean_cid}.json{Color.RESET}")

    # 4. Evaluation Summary
    print(subheader("RETRIEVAL DIAGNOSTIC ASSESSMENT"))
    valid_matches = [pt for pt in q_results if pt.get("score", 0.0) >= args.threshold]
    if valid_matches:
        top_s = valid_matches[0].get("score", 0.0)
        print(f"  {Color.GREEN}✔ RETRIEVAL SUCCESSFUL{Color.RESET}: Top cosine score is {top_s:.4f} (>= threshold {args.threshold}).")
        print(f"    Support agent will receive {len(valid_matches)} knowledge chunks for LLM context.")
    else:
        print(f"  {Color.RED}✖ KNOWLEDGE_SEARCH_EMPTY DETECTED{Color.RESET}: No chunks satisfied score threshold >= {args.threshold}.")
        print(f"    In production, this query triggers: {Color.BOLD}Knowledge_Search_Empty{Color.RESET} and may force CRM ticket escalation.")
        print(f"    Recommendation: Verify keywords in document titles/content or review threshold configuration.")

    print("\n" + "=" * 80 + "\n")


if __name__ == "__main__":
    main()

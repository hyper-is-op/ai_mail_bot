import unittest
from unittest.mock import patch, MagicMock
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag import (
    split_text,
    jaccard_similarity,
    calculate_fallback_score,
    query_knowledge,
    retrieve_knowledge,
)
from app.pipeline.tools import clean_rag_query, execute_tool_call
from app.pipeline.context import PipelineContext
from app.pipeline.evaluator import evaluate_draft_and_decide
import app.vector_store as vs



class TestRAGPipeline(unittest.TestCase):
    def test_01_recursive_chunking_preserves_boundaries(self):
        """split_text should split on paragraph/sentence boundaries and not cut words."""
        sample_doc = (
            "Section 1: Return Policy.\n\n"
            "Customers may return items within 30 days of purchase for a full refund. "
            "Items must be in original condition with all tags attached.\n\n"
            "Section 2: Shipping Policy.\n\n"
            "Orders are dispatched within 2 business days. Express shipping takes 1-2 days."
        )
        chunks = split_text(sample_doc, chunk_size=120, overlap=20)
        self.assertTrue(len(chunks) >= 2)
        for chunk in chunks:
            self.assertLessEqual(len(chunk), 140)  # within margin with overlap
            words = chunk.split()
            self.assertTrue(len(words) > 0)
            self.assertTrue(any(marker in chunk for marker in ["Section", "Customers", "Orders", "Items"]))

    def test_02_recursive_chunking_stays_under_safe_limit(self):
        """Long text must chunk cleanly into blocks < 700 chars, ensuring <= 512 tokens."""
        long_paragraph = "This is a detailed technical instruction about server maintenance. " * 30
        chunks = split_text(long_paragraph, chunk_size=700, overlap=100)
        self.assertTrue(len(chunks) >= 2)
        for chunk in chunks:
            self.assertLessEqual(len(chunk), 700)

    def test_03_clean_rag_query_strips_email_noise(self):
        """clean_rag_query must remove greetings, signoffs, and quoted history."""
        dirty_email = (
            "Hi Support Team,\n\n"
            "I am having trouble resetting my password on the portal. "
            "It gives me error code ERR_AUTH_502 every time I try to submit.\n\n"
            "Thanks & Regards,\n"
            "Alice Smith\n"
            "Sent from my iPhone\n\n"
            "On Mon, Sep 14, 2026 at 10:00 AM Support wrote:\n"
            "> Previous ticket content here"
        )
        cleaned = clean_rag_query(dirty_email)
        self.assertNotIn("Hi Support Team", cleaned)
        self.assertNotIn("Alice Smith", cleaned)
        self.assertNotIn("Sent from my iPhone", cleaned)
        self.assertNotIn("Previous ticket content", cleaned)
        self.assertIn("ERR_AUTH_502", cleaned)
        self.assertIn("resetting my password", cleaned)

    def test_04_fallback_hybrid_scoring(self):
        """calculate_fallback_score gives high score to exact phrases and error codes."""
        doc = "To resolve error ERR_AUTH_502, clear your browser cookies and reload the session."
        
        # Exact code match
        score_code = calculate_fallback_score("ERR_AUTH_502", doc)
        self.assertGreater(score_code, 0.40)
        
        # Exact phrase match
        score_phrase = calculate_fallback_score("clear your browser cookies", doc)
        self.assertEqual(score_phrase, 1.0)
        
        # Irrelevant query
        score_unrelated = calculate_fallback_score("international flight booking baggage", doc)
        self.assertEqual(score_unrelated, 0.0)

    @patch("app.rag.embed_query")
    @patch("app.rag.qdrant_search")
    def test_05_query_knowledge_enforces_min_score(self, mock_search, mock_embed):
        """Results with score below min_score must be rejected, preventing prompt poisoning."""
        mock_embed.return_value = [0.1] * 384
        
        # When Qdrant returns nothing above threshold
        mock_search.return_value = []
        with patch("app.rag.load_fallback_db", return_value=[]):
            ctx = query_knowledge("CLI-TEST", "some unrelated query", min_score=0.68)
            self.assertEqual(ctx, "")
            
        # When Qdrant returns valid matching point
        mock_search.return_value = [
            {"content": "Relevant policy passage.", "score": 0.82, "title": "Policy", "doc_id": "1"}
        ]
        ctx_found = query_knowledge("CLI-TEST", "valid policy question", min_score=0.68)
        self.assertIn("Relevant policy passage", ctx_found)

    def test_06_vector_store_search_filters_low_scores(self):
        """vs.search must discard points whose score is less than min_score."""
        mock_client = MagicMock()
        mock_resp = MagicMock()
        
        point_high = MagicMock()
        point_high.id = "p1"
        point_high.score = 0.78
        point_high.payload = {"content": "Good chunk", "title": "Doc 1", "doc_id": "d1"}
        
        point_low = MagicMock()
        point_low.id = "p2"
        point_low.score = 0.45
        point_low.payload = {"content": "Bad chunk", "title": "Doc 2", "doc_id": "d2"}
        
        mock_resp.points = [point_high, point_low]
        mock_client.query_points.return_value = mock_resp
        
        with patch.object(vs, "get_qdrant_client", return_value=mock_client):
            results = vs.search("CLI-123", [0.1]*384, top_k=3, min_score=0.68)
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0]["id"], "p1")
            self.assertEqual(results[0]["content"], "Good chunk")

    @patch("app.rag.embed_query")
    @patch("app.rag.qdrant_search")
    def test_07_cross_lingual_relaxation_floor(self, mock_search, mock_embed):
        """When initial search with strict threshold returns empty, relaxed cross-lingual floor should retrieve valid docs."""
        mock_embed.return_value = [0.1] * 384
        # First call with strict min_score (0.68) returns []
        # Second call with relaxed floor (0.52) returns matching chunk
        mock_search.side_effect = [
            [],
            [{"content": "CZ Dialer user guide.", "score": 0.59, "title": "Manual", "doc_id": "cz1"}]
        ]
        ctx = query_knowledge("CLI-TEST", "mai dialer ke bare me janna chahata hu", min_score=0.68)
        self.assertIn("CZ Dialer user guide", ctx)
        self.assertEqual(mock_search.call_count, 2)

    @patch("app.pipeline.tools.fetch_rag_context")
    def test_08_two_stage_rag_fallback(self, mock_fetch):
        """When LLM over-stuffing causes Stage 1 to fail, Stage 2 fallback uses cleaned body and succeeds."""
        ctx = PipelineContext(
            task_id="test-fallback",
            client_id="CLI-TEST",
            from_email="user@example.com",
            subject="Inquiry",
            body="tell me about CZ Dialer"
        )

        # Stage 1 fails on over-stuffed query, Stage 2 succeeds on "CZ Dialer"
        def side_effect(client_id, query):
            if "overview features" in query:
                return "", False, None
            elif "CZ Dialer" in query:
                return "CZ Dialer is a high-performance outbound dialing solution.", True, "rag-cz-01"
            return "", False, None

        mock_fetch.side_effect = side_effect

        result = execute_tool_call(
            tool_name="search_knowledge_base",
            arguments={"query": "CZ Dialer overview features dialing modes capabilities"},
            ctx=ctx
        )

        self.assertEqual(result["status"], "success")
        self.assertTrue(result["results_found"])
        self.assertIn("CZ Dialer is a high-performance", result["content"])
        self.assertEqual(ctx.rag_id, "rag-cz-01")
        self.assertIn("Knowledge_Search_Success", ctx.execution_steps)

    def test_09_continuation_history_gating(self):
        """Continuation gating isolates fresh threads while preserving context for explicit follow-ups."""
        followup_cues = (
            "previous", "earlier", "yesterday", "last email", "update on", "update regarding",
            "still not", "as discussed", "ticket", "following up", "status of", "any update",
            "same issue", "not working yet"
        )

        def is_continuation(subject, body, ticket_id=None):
            combined_text = f"{subject} {body}".lower()
            return (
                subject.lower().startswith("re:")
                or bool(ticket_id)
                or any(cue in combined_text for cue in followup_cues)
            )

        # Fresh topic inquiry -> must NOT trigger continuation
        self.assertFalse(is_continuation("Question", "tell me about CZ Dialer"))
        self.assertFalse(is_continuation("Product info", "Can you explain your dialer modes?"))

        # Explicit follow-ups -> MUST trigger continuation
        self.assertTrue(is_continuation("Re: Question", "thank you"))
        self.assertTrue(is_continuation("Status", "following up on our earlier email"))
        self.assertTrue(is_continuation("Help", "any update on this?"))
        self.assertTrue(is_continuation("Help", "still not working", ticket_id="TICK-101"))

    @patch("app.pipeline.evaluator.llm_score")
    @patch("app.pipeline.evaluator.get_email_score_threshold", return_value=80)
    @patch("app.pipeline.evaluator.decision_engine", return_value="auto_send")
    def test_10_evaluator_step1_decoupling(self, mock_engine, mock_thresh, mock_score):
        """Turn-1 general inquiry with viable draft does not trigger unconditional 0-score ticket escalation."""
        mock_score.return_value = 85

        # Step 0 (first turn), context retrieval empty, but high quality draft
        score, decision = evaluate_draft_and_decide(
            client_id="CLI-TEST",
            reply="CZ Dialer supports predictive, progressive, and preview dialing modes.",
            query="tell me about CZ Dialer",
            context_succeeded=False,
            troubleshooting_step=0,
            is_resolved=False
        )

        self.assertEqual(score, 85)
        self.assertEqual(decision, "auto_send")

        # Step 3 with context failed -> must trigger hard floor ticket creation
        score_step3, decision_step3 = evaluate_draft_and_decide(
            client_id="CLI-TEST",
            reply="Some troubleshooting step",
            query="server is down",
            context_succeeded=False,
            troubleshooting_step=3,
            is_resolved=False
        )
        self.assertEqual(score_step3, 0)
        self.assertEqual(decision_step3, "create_ticket")

    @patch("app.pipeline.evaluator.llm_score", return_value=75)
    def test_11_evaluator_rag_miss_general_query_routes_to_draft_mode(self, mock_score):
        """General informational query with empty RAG context must route to draft_mode."""
        score, decision = evaluate_draft_and_decide(
            client_id="CLI-TEST",
            reply="CZ Dialer is an enterprise telephony platform.",
            query="tell me about CZ Dialer specs",
            context_succeeded=False,
            troubleshooting_step=0,
            is_resolved=False,
            intent="general_query"
        )
        self.assertEqual(decision, "draft_mode")
        self.assertEqual(score, 75)


if __name__ == "__main__":
    unittest.main()



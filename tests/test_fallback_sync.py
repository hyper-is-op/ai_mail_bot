import unittest
from unittest.mock import patch, MagicMock
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag import (
    calculate_fallback_score,
    get_fallback_path,
    save_fallback_db,
    load_fallback_db,
    delete_knowledge,
    get_knowledge_base,
    retrieve_knowledge,
    purge_client_fallback,
    _group_fallback_chunks_into_documents,
    reconcile_and_sync_knowledge,
)


class TestFallbackSync(unittest.TestCase):
    def setUp(self):
        self.test_clients = [
            "CLI-TEST-FALLBACK",
            "CLI-TEST-RETRIEVE",
            "CLI-PURGE-ME",
            "CLI-RECON-PROMOTE",
            "CLI-RECON-PAGE",
        ]

    def tearDown(self):
        for cid in self.test_clients:
            purge_client_fallback(cid)

    def test_01_compound_chunk_deletion(self):
        """After delete_knowledge(), all chunks matching doc_id, chunk prefixes, or exact id are purged."""
        cid = "CLI-TEST-FALLBACK"
        initial_data = [
            {"id": "doc123_0", "doc_id": "doc123", "title": "Doc 1", "content": "Chunk 0", "chunk_index": 0},
            {"id": "doc123_1", "doc_id": "doc123", "title": "Doc 1", "content": "Chunk 1", "chunk_index": 1},
            {"id": "doc456_0", "doc_id": "doc456", "title": "Doc 2", "content": "Chunk 0", "chunk_index": 0},
            {"id": "doc789", "title": "Legacy Doc", "content": "Legacy content"},
        ]
        save_fallback_db(cid, initial_data)

        with patch("app.rag.qdrant_delete_document", return_value=True):
            deleted = delete_knowledge(cid, "doc123")

        self.assertTrue(deleted)
        remaining = load_fallback_db(cid)
        self.assertEqual(len(remaining), 2)
        surviving_ids = [d.get("id") for d in remaining]
        self.assertIn("doc456_0", surviving_ids)
        self.assertIn("doc789", surviving_ids)
        self.assertNotIn("doc123_0", surviving_ids)
        self.assertNotIn("doc123_1", surviving_ids)

    def test_02_fallback_grouping_matches_qdrant_schema(self):
        """_group_fallback_chunks_into_documents groups chunks by doc_id and produces Qdrant-identical schema."""
        raw_chunks = [
            {"id": "kb_1_0", "doc_id": "kb_1", "title": "KB Article 1", "chunk_index": 0, "content": "Paragraph 1"},
            {"id": "kb_1_1", "doc_id": "kb_1", "title": "KB Article 1", "chunk_index": 1, "content": "Paragraph 2"},
            {"id": "kb_1_2", "doc_id": "kb_1", "title": "KB Article 1", "chunk_index": 2, "content": "Paragraph 3"},
        ]
        grouped = _group_fallback_chunks_into_documents(raw_chunks)
        self.assertEqual(len(grouped), 1)
        doc = grouped[0]
        self.assertEqual(doc["id"], "kb_1")
        self.assertEqual(doc["title"], "KB Article 1")
        self.assertEqual(doc["chunks_count"], 3)
        self.assertIn("Paragraph 1", doc["content"])
        self.assertIn("Paragraph 2", doc["content"])
        self.assertIn("Paragraph 3", doc["content"])

    def test_03_admin_all_view_grouping(self):
        """_group_fallback_chunks_into_documents correctly isolates and groups cross-tenant entries."""
        raw_chunks = [
            {"id": "d1_0", "doc_id": "d1", "title": "[T1] Doc 1", "client_id": "T1", "content": "C1"},
            {"id": "d1_1", "doc_id": "d1", "title": "[T1] Doc 1", "client_id": "T1", "content": "C2"},
            {"id": "d1_0", "doc_id": "d1", "title": "[T2] Doc 1", "client_id": "T2", "content": "C3"},
        ]
        grouped = _group_fallback_chunks_into_documents(raw_chunks)
        self.assertEqual(len(grouped), 2)
        tenants = {g.get("client_id") for g in grouped}
        self.assertEqual(tenants, {"T1", "T2"})
        t1_doc = next(g for g in grouped if g.get("client_id") == "T1")
        t2_doc = next(g for g in grouped if g.get("client_id") == "T2")
        self.assertEqual(t1_doc["chunks_count"], 2)
        self.assertEqual(t2_doc["chunks_count"], 1)

    def test_04_title_assisted_scoring(self):
        """calculate_fallback_score evaluates title text so product titles surface relevant chunks."""
        title = "CZ Dialer Troubleshooting Guide"
        content = "Verify microphone is plugged into USB port 2 and check headset volume."
        query = "CZ Dialer"

        score_content_only = calculate_fallback_score(query, content)
        score_with_title = calculate_fallback_score(query, f"{title}\n{content}")

        self.assertLess(score_content_only, 0.20)
        self.assertGreaterEqual(score_with_title, 0.20)
        self.assertGreater(score_with_title, score_content_only)

    def test_05_retrieve_returns_doc_id_not_chunk_id(self):
        """retrieve_knowledge() fallback mapping maps doc_id to parent document ID, not chunk-level ID."""
        cid = "CLI-TEST-RETRIEVE"
        chunks = [
            {
                "id": "doc_net_0",
                "doc_id": "doc_net",
                "title": "Network Gateway Configuration",
                "chunk_index": 0,
                "content": "Configure primary DNS settings and gateway IP for network bridge."
            }
        ]
        save_fallback_db(cid, chunks)

        with patch("app.rag.embed_query", return_value=None):
            results = retrieve_knowledge(cid, query="DNS network gateway")

        self.assertGreater(len(results), 0)
        top = results[0]
        self.assertEqual(top["doc_id"], "doc_net")
        self.assertEqual(top["id"], "doc_net_0")
        self.assertGreaterEqual(top["score"], 0.20)

    def test_06_tenant_purge_removes_file(self):
        """purge_client_fallback() physically removes tenant JSON file from disk."""
        cid = "CLI-PURGE-ME"
        fpath = get_fallback_path(cid)
        save_fallback_db(cid, [{"id": "x", "content": "temp"}])
        self.assertTrue(os.path.exists(fpath))

        ok = purge_client_fallback(cid)
        self.assertTrue(ok)
        self.assertFalse(os.path.exists(fpath))

    @patch("app.rag.embed_passages")
    @patch("app.rag.ensure_collection")
    @patch("app.rag.upsert_chunks")
    @patch("app.rag.qdrant_get_client_documents")
    def test_07_reconciliation_promotes_unindexed_doc(
        self, mock_get_docs, mock_upsert, mock_ensure, mock_embed
    ):
        """Pass 1 discovers documents missing from Qdrant, embeds passages, and upserts them."""
        cid = "CLI-RECON-PROMOTE"
        chunks = [
            {
                "id": "doc_unindexed_0",
                "doc_id": "doc_unindexed",
                "title": "Offline Guide",
                "chunk_index": 0,
                "chunks_count": 1,
                "content": "This document was saved during an outage."
            }
        ]
        save_fallback_db(cid, chunks)

        mock_get_docs.return_value = []
        mock_embed.return_value = [[0.05] * 768]
        mock_ensure.return_value = True
        mock_upsert.return_value = True

        with patch("app.rag.save_fallback_db"):
            result = reconcile_and_sync_knowledge(cid)

        self.assertEqual(result["pass1_promoted"], 1)
        mock_embed.assert_called_once_with(["This document was saved during an outage."])
        mock_upsert.assert_called_once()
        args, _ = mock_upsert.call_args
        self.assertEqual(args[0], cid)
        self.assertEqual(args[1], "doc_unindexed")
        self.assertEqual(args[2], "Offline Guide")

    def test_08_reconciliation_pagination_and_uuid_serialization(self):
        """Pass 2 paginates Qdrant points beyond 256 and serializes UUID point IDs cleanly."""
        cid = "CLI-RECON-PAGE"
        mock_qclient = MagicMock()

        # Build 256 points for page 1 with UUID ids
        page1_points = [
            MagicMock(
                id=uuid.uuid4(),
                payload={"doc_id": f"doc_{i}", "title": f"Doc {i}", "chunk_index": 0, "chunks_count": 1, "content": f"Content {i}"}
            )
            for i in range(256)
        ]
        # Build 10 points for page 2 with UUID ids
        page2_points = [
            MagicMock(
                id=uuid.uuid4(),
                payload={"doc_id": f"doc_extra_{i}", "title": f"Extra Doc {i}", "chunk_index": 0, "chunks_count": 1, "content": f"Extra {i}"}
            )
            for i in range(10)
        ]

        def scroll_side_effect(**kwargs):
            offset = kwargs.get("offset")
            if offset is None:
                return (page1_points, "cursor_page_2")
            elif offset == "cursor_page_2":
                return (page2_points, None)
            return ([], None)

        mock_qclient.scroll.side_effect = scroll_side_effect

        with patch("app.vector_store.get_qdrant_client", return_value=mock_qclient), \
             patch("app.rag.load_fallback_db", return_value=[]):
            result = reconcile_and_sync_knowledge(cid)

        self.assertEqual(result["pass2_snapshot_chunks"], 266)
        self.assertEqual(len(result["errors"]), 0)

        # Verify fallback JSON on disk has all 266 points with string IDs
        saved = load_fallback_db(cid)
        self.assertEqual(len(saved), 266)
        for item in saved:
            self.assertIsInstance(item["id"], str)


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
"""Adapter tests for the aether wrapper. router.py and reasoning.py had no
coverage at all, and aether.snapshot()/tick() — the document the console
actually reads — is where the two get merged into speculum's snapshot."""

import tempfile
import unittest
from pathlib import Path

import aether
import reasoning
import router


class TestAetherMergedDocument(unittest.TestCase):
    """snapshot()/tick() add the router and reasoning keys without dropping
    speculum's own keys."""

    def test_snapshot_and_tick_merge_adapter_keys(self):
        for doc in (aether.snapshot(), aether.tick()):
            self.assertIn("kpi", doc)                    # speculum key survives
            self.assertEqual(set(doc["router"]), {"t", "nodes", "runs"})
            self.assertIn("mtp_accept_pct", doc["reasoning"])


class TestRouterNodes(unittest.TestCase):
    def test_running_to_nodes_shapes_and_never_raises(self):
        nodes = router.running_to_nodes([
            {"model": "llama-3", "cmd": "llama-server -m x",
             "proxy": "http://localhost:8080"},
            "junk", 42,
        ])
        self.assertEqual(len(nodes), 1)
        self.assertEqual(nodes[0]["label"], "llama-3")
        self.assertEqual(nodes[0]["engine"], "llama")
        self.assertEqual(nodes[0]["backend"], "http://127.0.0.1:8080")
        self.assertEqual(router.running_to_nodes(None), [])
        self.assertEqual(router.scan_run_folders("/no/such/root"), [])

    def test_graph_bounds_and_run_folders(self):
        g = router.RouterGraph()
        g.update_running([{"model": "m%d" % i}
                          for i in range(router.NODES_MAX + 20)])
        self.assertEqual(len(g.nodes()), router.NODES_MAX)
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "run-a").mkdir()
            (Path(d) / "run-a" / "meta.json").write_text(
                '{"stage": "staged", "model": "m1"}', encoding="utf-8")
            g.refresh_runs([d])
            runs = g.snapshot()["runs"]
            self.assertEqual(runs[0]["id"], "folder:run-a")
            self.assertEqual(runs[0]["stage"], "staged")
            self.assertEqual(runs[0]["model"], "m1")


class TestReasoningTracker(unittest.TestCase):
    def test_parse_line_and_tpot(self):
        parsed = reasoning.parse_reasoning_line(
            "req#7 done | TTFT 200 ms | total 5.0s"
            " | mtp accepted 772/1,024 (75.4%) | thinking 234/4,096")
        self.assertEqual(parsed["thinking"], 234)
        self.assertEqual(parsed["mtp_acc"], 772)
        self.assertEqual(parsed["mtp_tot"], 1024)
        self.assertEqual(parsed["ttft_s"], 0.2)
        self.assertEqual(parsed["total_s"], 5.0)
        self.assertAlmostEqual(reasoning.tpot_of(5.0, 0.2, 500), 0.0096)

    def test_feed_request_dedupes_by_id(self):
        r = reasoning.ReasoningTracker()
        rec = {"id": "req-1", "t": 1000.0, "ttft_s": 0.2, "total_s": 5.0,
               "output": 500, "thinking": 234, "mtp_acc": 772, "mtp_tot": 1024}
        self.assertTrue(r.feed_request(rec))
        self.assertFalse(r.feed_request(dict(rec)))      # same id: ignored
        r.feed_request({"id": "req-2", "t": 1001.0})
        snap = r.snapshot()
        self.assertEqual(snap["requests"], 2)
        self.assertEqual(snap["thinking_tokens"], 234)
        self.assertEqual(snap["mtp_accept_pct"], 75.4)
        self.assertEqual(len(snap["ttft_wave"]), 1)
        self.assertEqual(len(snap["tpot_wave"]), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
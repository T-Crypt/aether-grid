#!/usr/bin/env python3
"""Tests for KPI model attribution: engine_model_name, and the tps_models field
kpi_pass emits so the UI can name the model behind the decode rate."""

import time
import unittest

import speculum


def _reset_kpi_state():
    S = speculum.S
    S.engines.clear()
    S._swap_models = []
    S.strata["models"] = []
    S.requests.clear()
    S.gpu["last"] = None
    S.host["last"] = None


class TestEngineModelName(unittest.TestCase):
    def test_by_origin(self):
        swap = [("llama", "llama-3.3-70b"), ("ninfer", "NInfer-Qwen3-8B")]
        strata = ["strata-model"]
        e = {
            "llama":  {"key": "llama", "origin": "llama-swap", "up": True, "label": "llama-3.3-70b"},
            "ninfer": {"key": "ninfer", "origin": "ninfer", "up": True, "label": "NInfer-Qwen3-8B"},
            "strata": {"key": "strata", "origin": "strata", "up": True, "label": "Strata"},
            "ollama": {"key": "ollama", "origin": "ollama", "up": True, "label": "Ollama",
                       "models": [{"id": "qwen3:8b"}]},
            "down":   {"key": "vllm", "origin": "vllm", "up": False, "label": "vLLM",
                       "models": [{"id": "m"}]},
        }
        self.assertEqual(speculum.engine_model_name("llama", e["llama"], swap, strata), "llama-3.3-70b")
        self.assertEqual(speculum.engine_model_name("ninfer", e["ninfer"], swap, strata), "NInfer-Qwen3-8B")
        self.assertEqual(speculum.engine_model_name("strata", e["strata"], swap, strata), "strata-model")
        self.assertEqual(speculum.engine_model_name("ollama", e["ollama"], swap, strata), "qwen3:8b")
        self.assertIsNone(speculum.engine_model_name("vllm", e["down"], swap, strata))
        # idle llama-swap engine (absent from the running set) attributes no model
        self.assertIsNone(speculum.engine_model_name("llama", e["llama"], [], strata))

    def test_discovered_engine_without_models(self):
        e = {"key": "sglang", "origin": "sglang", "up": True, "label": "SGLang"}
        self.assertIsNone(speculum.engine_model_name("sglang", e, [], []))


class TestKpiPassTpsModels(unittest.TestCase):
    def setUp(self):
        _reset_kpi_state()

    def test_ninfer_decode_rate_names_model(self):
        S = speculum.S
        e = S.engine("ninfer", "NInfer-Qwen3-8B", "ninfer")
        e["up"] = True
        e["rates"] = {"decode_tps": 72.0}
        speculum.kpi_pass()
        self.assertEqual(S.kpi["last"]["tps_models"], ["NInfer-Qwen3-8B"])

    def test_llama_swap_model_from_running_set(self):
        S = speculum.S
        e = S.engine("llama", "llama-3.3-70b", "llama-swap")
        e["up"] = True
        e["rates"] = {"decode_tps": 45.0}
        S._swap_models = [("llama", "llama-3.3-70b")]
        speculum.kpi_pass()
        self.assertEqual(S.kpi["last"]["tps_models"], ["llama-3.3-70b"])

    def test_idle_engine_attributes_no_model(self):
        S = speculum.S
        e = S.engine("ninfer", "NInfer-Qwen3-8B", "ninfer")
        e["up"] = True
        e["rates"] = None            # up but not decoding: no model to attribute
        speculum.kpi_pass()
        self.assertEqual(S.kpi["last"]["tps_models"], [])


class TestNinferLogMapping(unittest.TestCase):
    """NInfer v3 serves no /metrics, so the dashboard's live rate comes
    from completed-request log lines. Thousands separators must survive
    the parse, and the trailing rate must reflect real output."""
    def setUp(self):
        _reset_kpi_state()

    def _done(self, rid, body):
        e = speculum.S.engine("t-ninfer", "NInfer-Qwen3-8B", "ninfer")
        speculum.log_line("req#%d done | %s" % (rid, body), e)

    def test_mtp_comma_pair(self):
        self._done(7, "openai-chat | prompt 10,000 | output 500 | cache 9,000"
                      " | TTFT 200 ms | total 5.0s | queue 10 ms"
                      " | prefill 1,820.0 tok/s | decode 103.7 tok/s"
                      " | mtp accepted 772/1,024 (75.4%) | thinking 234/4,096")
        r = speculum.S.requests[0]
        self.assertEqual(r["mtp_acc"], 772)
        self.assertEqual(r["mtp_tot"], 1024)
        self.assertEqual(r["prefill_tps"], 1820.0)
        self.assertEqual(r["decode_tps"], 103.7)
        self.assertEqual(r["prompt"], 10000)

    def test_log_rates_trailing(self):
        self._done(8, "openai-chat | prompt 1,000 | output 500 | cache 900"
                      " | TTFT 200 ms | total 5.0s | prefill 600.0 tok/s"
                      " | decode 100.0 tok/s")
        self._done(9, "openai-chat | prompt 2,000 | output 700 | cache 1,800"
                      " | TTFT 300 ms | total 7.0s | prefill 610.5 tok/s"
                      " | decode 117.4 tok/s")
        rates = speculum.ninfer_log_rates("NInfer-Qwen3-8B")
        self.assertEqual(rates["decode_tps"], round(1200 / 60.0, 1))
        self.assertEqual(rates["prefill_tps"], 610.5)

    def test_log_rates_idle_is_zero(self):
        rates = speculum.ninfer_log_rates("NInfer-Qwen3-8B")
        self.assertEqual(rates["decode_tps"], 0.0)
        self.assertIsNone(rates["prefill_tps"])

    def test_started_then_done_marks_active(self):
        S = speculum.S
        e = S.engine("t-ninfer", "NInfer-Qwen3-8B", "ninfer")
        speculum.log_line("req#11 started", e)
        self.assertTrue(speculum.engine_active(e))
        self._done(11, "openai-chat | prompt 1,000 | output 60 | cache 900"
                       " | TTFT 200 ms | total 1.0s | decode 60.0 tok/s")
        self.assertFalse(speculum.engine_active(e))

    def test_replayed_start_is_not_active(self):
        S = speculum.S
        e = S.engine("t-ninfer", "NInfer-Qwen3-8B", "ninfer")
        speculum.log_line("2026-10-14 09:00:00.000  INFO  req#3 started", e)
        self.assertFalse(speculum.engine_active(e))


class TestBuiltinEndpoints(unittest.TestCase):
    """llama-swap and Strata can be moved off their stock ports, by url or by
    the host/port shorthand, since the built-in threads are not discovery."""

    def test_default_when_unset(self):
        self.assertEqual(speculum.endpoint_url({}, "http://127.0.0.1:9090"),
                         "http://127.0.0.1:9090")
        self.assertEqual(speculum.endpoint_url(None, "http://127.0.0.1:9090"),
                         "http://127.0.0.1:9090")

    def test_url_override(self):
        self.assertEqual(
            speculum.endpoint_url({"url": "http://127.0.0.1:9091/"},
                                  "http://127.0.0.1:9090"),
            "http://127.0.0.1:9091")

    def test_port_shorthand_overrides_default(self):
        self.assertEqual(
            speculum.endpoint_url({"port": 9091}, "http://127.0.0.1:9090"),
            "http://127.0.0.1:9091")

    def test_host_shorthand(self):
        self.assertEqual(
            speculum.endpoint_url({"host": "gpu.lan"},
                                  "http://127.0.0.1:8080"),
            "http://gpu.lan:8080")


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
"""Aether collector — thin wrapper over the vendored speculum feed.

Reuses speculum's State, background threads and HTTP handler, and adds:

    router     function nodes: llama-swap /running entries plus
               muse-router .router run folders (see router.py)
    reasoning  reasoning tokens, MTP accept %, TTFT/TPOT waves fed from
               the request stream (see reasoning.py)

Serves the static UI from web/ (falls back to the repo root) plus:

    GET /api/snapshot   speculum snapshot + router + reasoning keys
    GET /api/stream     speculum tick with the same two keys merged in

Stdlib only. All sources optional — with nothing running, the extra keys
read as empty nodes / empty waves. Bounded buffers live in the adapters
(router.NODES_MAX/RUNS_MAX, reasoning.WAVES_MAX) and speculum's own rings.
"""

import json
import sys
import threading
import time
from pathlib import Path

try:
    import speculum
except ImportError:  # pragma: no cover - pytest rootdir layout
    from collector import speculum  # type: ignore

try:
    import router as _router_mod
    import reasoning as _reasoning_mod
except ImportError:  # pragma: no cover
    from collector import router as _router_mod  # type: ignore
    from collector import reasoning as _reasoning_mod  # type: ignore

router = _router_mod
reasoning = _reasoning_mod

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
STATIC_ROOT = WEB if WEB.is_dir() else ROOT

# Shared adapter state: bounded deques inside, speculum.State untouched.
ROUTER = router.RouterGraph(run_roots=router.default_run_roots(ROOT))
REASON = reasoning.ReasoningTracker()


# --------------------------------------------------------------------------
# merged views (speculum snapshot/tick + two extra keys)
# --------------------------------------------------------------------------

def snapshot():
    snap = speculum.snapshot()
    snap["router"] = ROUTER.snapshot()
    snap["reasoning"] = REASON.snapshot()
    return snap


def tick():
    data = speculum.tick()
    data["router"] = ROUTER.snapshot()
    data["reasoning"] = REASON.snapshot()
    return data


# --------------------------------------------------------------------------
# adapter poll threads (follow speculum.State; never raise out)
# --------------------------------------------------------------------------

def router_thread(interval=5.0):
    """Refresh function nodes from speculum S.running + .router folders."""
    while True:
        try:
            with speculum.lock:
                running = list(speculum.S.running or [])
            ROUTER.update_running(running)
        except Exception:
            pass
        try:
            roots = router.default_run_roots(ROOT)
            if roots:
                ROUTER.refresh_runs(roots)
            elif ROUTER.run_roots:
                ROUTER.refresh_runs()
        except Exception:
            pass
        time.sleep(interval)


def reasoning_thread(interval=2.0):
    """Feed new speculum requests into the reasoning tracker (dedupe by id)."""
    fed = set()
    while True:
        try:
            with speculum.lock:
                recs = list(speculum.S.requests)
            for rec in recs:
                rid = rec.get("id") if isinstance(rec, dict) else None
                if rid is not None and rid in fed:
                    continue
                if REASON.feed_request(rec) and rid is not None:
                    fed.add(rid)
                    while len(fed) > reasoning.REQS_MAX * 2:
                        fed.pop()
        except Exception:
            pass
        time.sleep(interval)


class Handler(speculum.Handler):
    """Speculum handler serving web/ + merged snapshot/stream."""

    def do_GET(self):
        path = self.path.partition("?")[0]
        if path == "/api/snapshot":
            try:
                self._json(snapshot())
            except Exception as e:
                self._json({"error": str(e)}, 500)
        elif path == "/api/stream":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            try:
                while True:
                    self.wfile.write(b"event: tick\ndata: "
                                     + json.dumps(tick()).encode()
                                     + b"\n\n")
                    self.wfile.flush()
                    time.sleep(1.0)
            except Exception:
                pass
        else:
            # history/requests/spans/storage/export/prune + static: speculum
            super().do_GET()

    def _static(self, path):
        if path == "/":
            path = "/index.html"
        f = (STATIC_ROOT / path.lstrip("/")).resolve()
        if STATIC_ROOT not in f.parents and f != STATIC_ROOT:
            self.send_error(403)
            return
        if not f.is_file():
            self.send_error(404)
            return
        data = f.read_bytes()
        ctype = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".svg": "image/svg+xml",
            ".json": "application/json",
            ".md": "text/plain; charset=utf-8",
        }.get(f.suffix, "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)


def main():
    """Start speculum's threads (via its own main helpers) plus the two
    adapter threads, then serve the merged API. Delegates config/port
    handling to speculum.main's machinery by running it with our Handler.

    Thin approach: reuse speculum.main() but swap the handler class and
    start adapter threads first. speculum.main() looks up Handler by
    module global, so patch speculum.Handler before delegating.
    """
    for fn in (router_thread, reasoning_thread):
        threading.Thread(target=fn, daemon=True).start()
    speculum.Handler = Handler
    # Serve from web/ (or repo root): speculum.Handler._static uses its
    # module ROOT, so point it at our static root.
    speculum.ROOT = STATIC_ROOT
    sys.argv[0] = str(Path(__file__))
    speculum.main()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Router adapter for aether-grid: function nodes from two optional sources.

Sources (each optional, degrades to no nodes):

    llama-swap  /running entries -> one function node per running model
                (key, label, backend proxy, cmd). Read from the live
                speculum State when wired via update_running(), or from
                running_to_nodes() pure helper in tests.
    muse-router .router run folders -> one function node per staged run
                folder. Each immediate subdirectory of the run root is a
                run node; an optional meta.json inside names it
                ({"name"|"id", "stage"|"status", "model"}). Unreadable
                root -> no run nodes, never an exception.

Stdlib only. Bounded buffers: at most NODES_MAX nodes, RUNS_MAX run
records. Pure helpers are import-safe (no disk/network on import).
"""

import json
import time
from collections import deque
from pathlib import Path

NODES_MAX = 128
RUNS_MAX = 50

DEFAULT_RUN_ROOTS = (".router",)


def running_to_nodes(running):
    """Pure: llama-swap /running list -> function nodes. Never raises."""
    nodes = []
    try:
        entries = list(running or [])
    except TypeError:
        return []
    for r in entries:
        if not isinstance(r, dict):
            continue
        model = r.get("model") or "model"
        cmd = r.get("cmd") or ""
        proxy = (r.get("proxy") or "").replace("localhost", "127.0.0.1")
        kind = "ninfer" if ("ninfer" in cmd or "NInfer" in str(model)) else "llama"
        nodes.append({
            "id": "run:%s" % model,
            "kind": "model",
            "label": model,
            "engine": kind,
            "backend": proxy or None,
            "up": True,
        })
        if len(nodes) >= NODES_MAX:
            break
    return nodes


def scan_run_folders(root):
    """Pure: immediate subdirs of `root` -> run records. Never raises.

    Each record: {id, name, mtime, files, stage, model}. stage/model come
    from meta.json when present and valid, else None.
    """
    try:
        base = Path(root)
        dirs = sorted(
            (d for d in base.iterdir() if d.is_dir()),
            key=lambda d: d.name,
        )
    except Exception:
        return []
    out = []
    for d in dirs[:RUNS_MAX]:
        rec = {"id": "folder:%s" % d.name, "name": d.name,
               "mtime": None, "files": 0, "stage": None, "model": None}
        try:
            st = d.stat()
            rec["mtime"] = st.st_mtime
        except Exception:
            pass
        try:
            names = [p.name for p in d.iterdir()]
            rec["files"] = len(names)
        except Exception:
            pass
        try:
            meta = json.loads((d / "meta.json").read_text(encoding="utf-8"))
            if isinstance(meta, dict):
                rec["stage"] = meta.get("stage") or meta.get("status")
                rec["model"] = meta.get("model")
                if meta.get("name") or meta.get("id"):
                    rec["name"] = str(meta.get("name") or meta.get("id"))
        except Exception:
            pass
        out.append(rec)
    return out


def runs_to_nodes(runs):
    """Pure: run records -> function nodes (kind=run). Never raises."""
    nodes = []
    for r in runs or []:
        if not isinstance(r, dict):
            continue
        nodes.append({
            "id": r.get("id") or "folder:%s" % r.get("name", "?"),
            "kind": "run",
            "label": r.get("name") or "?",
            "stage": r.get("stage"),
            "model": r.get("model"),
            "up": None,
        })
        if len(nodes) >= NODES_MAX:
            break
    return nodes


class RouterGraph:
    """Bounded function-node graph. All sources optional."""

    def __init__(self, run_roots=()):
        self.run_roots = [str(r) for r in (run_roots or [])]
        self._running = []
        self._runs = deque(maxlen=RUNS_MAX)
        self._t = None

    def update_running(self, running):
        self._running = running_to_nodes(running)[:NODES_MAX]
        self._t = time.time()

    def refresh_runs(self, roots=None):
        seen = {}
        for root in (roots if roots is not None else self.run_roots):
            for rec in scan_run_folders(root):
                seen[rec["id"]] = rec
        self._runs = deque(list(seen.values())[:RUNS_MAX], maxlen=RUNS_MAX)
        self._t = time.time()
        return list(self._runs)

    def nodes(self):
        combined = list(self._running) + runs_to_nodes(list(self._runs))
        return combined[:NODES_MAX]

    def snapshot(self):
        return {"t": self._t, "nodes": self.nodes(),
                "runs": list(self._runs)}


def default_run_roots(repo_root):
    """Candidate .router roots under `repo_root` (existing dirs only)."""
    out = []
    try:
        base = Path(repo_root)
    except Exception:
        return out
    for name in DEFAULT_RUN_ROOTS:
        cand = base / name
        try:
            if cand.is_dir():
                out.append(str(cand))
        except Exception:
            continue
    return out

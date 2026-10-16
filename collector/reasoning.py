#!/usr/bin/env python3
"""Reasoning adapter for aether-grid: reasoning tokens, MTP accept, TTFT/TPOT waves.

Input is the existing log/request stream (no new network): feed either raw
log lines via feed_line() or finished request records (speculum shape) via
feed_request(). All sources optional — with no input the snapshot reads as
zeros/empty waves.

Stdlib only. Bounded buffers: WAVES_MAX samples per wave, REQS_MAX recent
request ids for dedupe. Pure parse helpers are import-safe.

Wave samples are {"t", "v"} with v in seconds (TTFT/TPOT) so the UI can
draw them directly. TPOT per request = (total_s - ttft_s) / output tokens
when all three are present and positive, else None (skipped).
"""

import re
import time
from collections import deque

WAVES_MAX = 300
REQS_MAX = 500

THINK_RE = re.compile(r"thinking\s+([\d,]+)\s*/", re.IGNORECASE)
REASON_RE = re.compile(r"reason(?:ing)?[\s_]*tokens?\s*[:=]?\s*([\d,]+)", re.IGNORECASE)
MTP_RE = re.compile(r"mtp accepted\s+([\d,]+)\s*/\s*([\d,]+)", re.IGNORECASE)
TTFT_RE = re.compile(r"TTFT\s+([\d.]+\s*(?:ms|s|m|h)?)", re.IGNORECASE)
TOTAL_RE = re.compile(r"(?<!\S)total\s+([\d.]+\s*(?:ms|s|m|h)?)", re.IGNORECASE)


def parse_dur(s):
    try:
        m = re.match(r"^([\d.]+)\s*(ms|s|m|h)?$", str(s).strip())
        if not m:
            return None
        v = float(m.group(1))
        unit = m.group(2) or "s"
        if unit == "ms":
            v /= 1000.0
        elif unit == "m":
            v *= 60.0
        elif unit == "h":
            v *= 3600.0
        return v
    except (TypeError, ValueError):
        return None


def _int(s):
    try:
        return int(str(s).replace(",", ""))
    except (TypeError, ValueError):
        return None


def parse_reasoning_line(line):
    """Pure: one log line -> {thinking, mtp_acc, mtp_tot, ttft_s, total_s} (missing keys None)."""
    if not line or not isinstance(line, str):
        return None
    out = {"thinking": None, "mtp_acc": None, "mtp_tot": None,
           "ttft_s": None, "total_s": None}
    m = THINK_RE.search(line)
    if m:
        out["thinking"] = _int(m.group(1))
    else:
        m = REASON_RE.search(line)
        if m:
            out["thinking"] = _int(m.group(1))
    m = MTP_RE.search(line)
    if m:
        out["mtp_acc"] = _int(m.group(1))
        out["mtp_tot"] = _int(m.group(2))
    m = TTFT_RE.search(line)
    if m:
        out["ttft_s"] = parse_dur(m.group(1))
    m = TOTAL_RE.search(line)
    if m:
        out["total_s"] = parse_dur(m.group(1))
    if all(v is None for v in out.values()):
        return None
    return out


def tpot_of(total_s, ttft_s, output_tokens):
    """Pure: per-token time in seconds, or None when not computable."""
    try:
        out = int(output_tokens) if output_tokens is not None else 0
        if not out or out <= 0:
            return None
        total = float(total_s)
        ttft = float(ttft_s) if ttft_s is not None else 0.0
        rest = total - ttft
        if rest < 0:
            rest = total
        return rest / out
    except (TypeError, ValueError):
        return None


class ReasoningTracker:
    """Bounded reasoning/MTP/latency accumulator."""

    def __init__(self):
        self.thinking_tokens = 0
        self.thinking_lines = 0
        self.mtp_acc = 0
        self.mtp_tot = 0
        self.requests = 0
        self._seen = deque(maxlen=REQS_MAX)
        self._seen_set = set()
        self.ttft = deque(maxlen=WAVES_MAX)   # {"t","v"} seconds
        self.tpot = deque(maxlen=WAVES_MAX)   # {"t","v"} seconds
        self._t = None

    def _note(self, rid, t, ttft_s, total_s, output, thinking, mtp_acc, mtp_tot):
        if rid is not None:
            if rid in self._seen_set:
                return False
            self._seen.append(rid)
            self._seen_set.add(rid)
            while len(self._seen_set) > REQS_MAX:
                old = self._seen.popleft()
                self._seen_set.discard(old)
        t = t if t is not None else time.time()
        self._t = t
        self.requests += 1
        if thinking:
            self.thinking_tokens += thinking
            self.thinking_lines += 1
        if mtp_acc is not None and mtp_tot:
            self.mtp_acc += mtp_acc
            self.mtp_tot += mtp_tot
        if ttft_s is not None and ttft_s >= 0:
            self.ttft.append({"t": t, "v": ttft_s})
        tp = tpot_of(total_s, ttft_s, output)
        if tp is not None and tp >= 0:
            self.tpot.append({"t": t, "v": tp})
        return True

    def feed_line(self, line, t=None, output=None, rid=None):
        """One log line; output/rid optional (unknown from a bare line)."""
        parsed = parse_reasoning_line(line)
        if parsed is None:
            return False
        return self._note(rid, t if t is not None else time.time(),
                          parsed["ttft_s"], parsed["total_s"], output,
                          parsed["thinking"], parsed["mtp_acc"], parsed["mtp_tot"])

    def feed_request(self, rec):
        """One speculum request record (dict). Never raises."""
        try:
            if not isinstance(rec, dict):
                return False
            think = rec.get("thinking")
            if think is None:
                detail = rec.get("detail") or ""
                parsed = parse_reasoning_line(detail) if detail else None
                think = parsed["thinking"] if parsed else None
            return self._note(rec.get("id"), rec.get("t"), rec.get("ttft_s"),
                              rec.get("total_s"), rec.get("output"),
                              think, rec.get("mtp_acc"), rec.get("mtp_tot"))
        except Exception:
            return False

    def snapshot(self):
        mtp = (round(100.0 * self.mtp_acc / self.mtp_tot, 1)
               if self.mtp_tot else None)
        return {
            "t": self._t,
            "requests": self.requests,
            "thinking_tokens": self.thinking_tokens,
            "thinking_lines": self.thinking_lines,
            "mtp_acc": self.mtp_acc,
            "mtp_tot": self.mtp_tot,
            "mtp_accept_pct": mtp,
            "ttft_wave": list(self.ttft),
            "tpot_wave": list(self.tpot),
        }

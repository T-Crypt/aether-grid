// Inference Intercept: shared derivations.
//
// Every figure a panel prints traces to a snapshot key or a derivation of
// one. The two derived figures here say how in their comment:
//
//   sessionRate  the engine's decode rate shared across its sessions by
//                context fill, so the session column always sums back to
//                the real engine decode figure.
//   prefillOf    the engine-reported prefill rate when the feed carries
//                one; otherwise request arrivals (rpm) times the mean
//                prompt size of the newest requests, divided out to
//                tokens per second.
//
// All pure. No RNG, so a held feed settles on one static frame.

import { wellState } from '../../lib/format'

// Engines that are up; the one the desk locks on: the first up engine
// actually decoding, else the first up engine, else nothing.
export function upEngines(snap) {
  return (((snap && snap.engines) || []) || []).filter((e) => e && e.up !== false)
}

export function lockedEngine(snap) {
  const up = upEngines(snap)
  return up.find((e) => (e.rates && e.rates.decode_tps) > 0) || up[0] || null
}

export function decodeOf(snap) {
  return upEngines(snap).reduce((a, e) => a + (e && e.rates && e.rates.decode_tps != null ? e.rates.decode_tps : 0), 0)
}

function engineByLabel(snap, label) {
  return (((snap && snap.engines) || []) || []).find((e) => e && (e.label === label || e.key === label)) || null
}

// The engine a session belongs to. deriveSessions stamps the engine label
// on each row; match back on label, then key.
export function sessionEngine(s, snap) {
  return engineByLabel(snap, s.engine) || engineByLabel(snap, s.id && s.id.split('-')[0]) || null
}

// Decode share of one session: the engine's decode rate spread across its
// sessions in proportion to context fill. Honest by construction — the
// column sums to the real engine decode rate — and labelled DERIVED in the
// table header.
export function sessionRate(s, snap) {
  if (!s || !s.window) return null
  const eng = sessionEngine(s, snap)
  const rate = eng && eng.rates && eng.rates.decode_tps != null ? eng.rates.decode_tps : null
  const kin = (((snap && snap.sessions) || []) || []).filter((x) => x && sessionEngine(x, snap) === eng)
  const total = kin.reduce((a, x) => a + (x.used || 0), 0)
  if (rate == null || total <= 0) return null
  return rate * ((s.used || 0) / total)
}

export function sessionFill(s) {
  if (!s || !s.window) return null
  return Math.min(1, (s.used || 0) / s.window)
}

// KV well state -> the console's session state ladder.
export function sessionState(s) {
  const f = sessionFill(s)
  if (f == null) return 'idle'
  const w = wellState(f)
  return w === 'ok' ? 'ok' : w === 'warn' ? 'watch' : w === 'alert' ? 'hot' : 'idle'
}

// The model the desk intercepts: the feed's per-model rate list first,
// then the model list, then the serving engine's label.
export function modelOf(snap) {
  const k = (snap && snap.kpi) || {}
  if (Array.isArray(k.tps_models) && k.tps_models.length) return String(k.tps_models[0])
  const models = (snap && snap.models) || []
  if (models.length) return String(models[0].id != null ? models[0].id : models[0])
  const lock = lockedEngine(snap)
  return lock ? String(lock.label || lock.key) : null
}

// Mean prompt size of the newest requests, tokens.
export function meanPrompt(requests, n = 20) {
  const rows = ((requests || []) || []).slice(0, n)
  if (!rows.length) return null
  let sum = 0
  let count = 0
  for (const r of rows) {
    if (r && r.prompt != null && isFinite(r.prompt)) {
      sum += r.prompt
      count += 1
    }
  }
  return count ? sum / count : null
}

// Prefill tokens per second: engine-reported when the feed carries it,
// otherwise arrivals (rpm) times mean prompt tokens, spread per second.
export function prefillOf(snap) {
  const reported = upEngines(snap).reduce((a, e) => {
    const p = e && e.rates && e.rates.prefill_tps
    return a + (p != null && isFinite(p) ? p : 0)
  }, 0)
  if (reported > 0) return { v: reported, derived: false }
  const k = (snap && snap.kpi) || {}
  const mp = meanPrompt(snap && snap.requests)
  if (k.rpm != null && mp != null && isFinite(mp)) return { v: (k.rpm / 60) * mp, derived: true }
  return { v: null, derived: false }
}

// Sessions by KV well state, for the counters the rail and strip print.
export function wellCounts(snap) {
  const c = { hot: 0, watch: 0, ok: 0 }
  for (const s of ((snap && snap.sessions) || []) || []) {
    const f = sessionFill(s)
    if (f == null) continue
    if (f >= 0.85) c.hot += 1
    else if (f >= 0.6) c.watch += 1
    else c.ok += 1
  }
  return c
}

// Sum of context tokens in use across sessions.
export function ctxUsed(snap) {
  return ((((snap && snap.sessions) || []) || []).reduce((a, s) => a + (s && s.used ? s.used : 0), 0)) || 0
}

// Derivations every scene needs, in one place.
//
// These used to be copied into each scene module: four copies of the same
// deterministic helpers and three copies of the same runtime resolver, which
// drifted apart because nothing kept them honest. A scene imports what it
// uses from here.
//
// Everything here is pure. No RNG, so a scene replays identically on reload
// and settles identically under reduced motion.

// Stable 0..1 value from a number, for deterministic jitter and lore.
export function det(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// Stable non-negative integer hash of a string, for per-id derivation.
export function hashCode(s) {
  let h = 0
  const str = String(s)
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function pad(n, w = 2) {
  return String(n).padStart(w, '0')
}

// A hex word derived from a seed string, for the identifiers the chrome prints.
export function hexFrom(seed, len) {
  const chars = '0123456789ABCDEF'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(det(hashCode(seed) + i * 13.7) * 16)]
  return s
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

// A feed that is not moving: offline, still booting, or a held zero-tps
// stream. Panels read this to hold their numbers instead of printing drift.
export function staleOf(snap) {
  const k = (snap && snap.kpi) || {}
  return !snap || snap.mode === 'offline' || snap.mode === 'boot' || (k.tps || 0) === 0
}

// The runtime the console is watching, as one flat object.
//
// Every scene prints some part of this and each had grown its own resolver.
// Superset shape: pick the fields you need, ignore the rest.
export function activeRuntime(snap) {
  const k = (snap && snap.kpi) || {}
  const engines = ((snap && snap.engines) || []).filter((e) => e && e.key != null)
  const up = engines.filter((e) => e.up !== false)
  const first = up.length ? up[0] : engines[0] || null
  const tpsModels = Array.isArray(k.tps_models) && k.tps_models.length ? k.tps_models[0] : null
  const models = (snap && snap.models) || []
  const fromModels = models.length ? models[0].id || models[0] : null
  const gpu = (snap && snap.gpu) || null
  const r = (snap && snap.reasoning) || {}
  const decode = up.reduce((a, e) => a + (e && e.rates && e.rates.decode_tps != null ? e.rates.decode_tps : 0), 0)

  return {
    model: tpsModels ? String(tpsModels) : first ? String(first.label || first.key) : fromModels ? String(fromModels) : null,
    engine: first ? String(first.label || first.key) : engines.length ? `${up.length}/${engines.length}` : null,
    engineRatio: engines.length ? `${up.length}/${engines.length}` : null,
    engineKey: first ? first.key : null,
    engineCount: engines.length,
    upCount: up.length,
    decode,
    tps: k.tps != null ? k.tps : null,
    temp: gpu && gpu.temp != null ? gpu.temp : null,
    mtp: r.mtp_accept_pct != null ? r.mtp_accept_pct : k.mtp != null ? k.mtp : null,
    think: r.thinking_tokens != null ? r.thinking_tokens : null,
    queue: k.queue != null ? k.queue : null,
    p95: k.p95 != null ? k.p95 : null,
  }
}

export { clamp }

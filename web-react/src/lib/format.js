// Formatters and thresholds shared by the console. Mirrors the field names in
// web/app.js so both UIs read the same snapshot shape.

export const KPI_KEYS = ['tps', 'rpm', 'p95', 'ttft', 'tpot', 'vram', 'cache', 'reingest', 'mtp', 'queue']

// The four numbers an operator actually steers by get the large treatment.
export const KPI_PRIMARY = { tps: true, queue: true, vram: true, p95: true }

export const KPI_LABEL = {
  tps: 'throughput',
  rpm: 'req / min',
  p95: 'p95 latency',
  ttft: 'time to 1st',
  tpot: 'time / token',
  vram: 'vram used',
  cache: 'kv cache',
  reingest: 'reingest',
  mtp: 'mtp accept',
  queue: 'queue depth',
}

const fmt = {
  tps: (v) => Math.round(v),
  rpm: (v) => Math.round(v),
  queue: (v) => Math.round(v),
  ttft: (v) => (v / 1000).toFixed(2) + 's',
  tpot: (v) => Math.round(v) + 'ms',
  p95: (v) => (v / 1000).toFixed(1) + 's',
  cache: (v) => v.toFixed(1) + '%',
  reingest: (v) => v.toFixed(1) + '%',
  mtp: (v) => v.toFixed(1) + '%',
  vram: (v) => v.toFixed(1) + 'G',
}

export const KPI_FMT = fmt

export function fmtKpi(key, v) {
  if (v == null || !isFinite(v)) return null
  const f = fmt[key]
  return f ? f(v) : String(Math.round(v))
}

export function fmtBig(v) {
  if (v == null || !isFinite(v)) return '—'
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'k'
  return String(Math.round(v))
}

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

// Slot fill -> semantic state. Same ladder as web/app.js wellClass().
export function wellState(f) {
  if (f >= 0.85) return 'alert'
  if (f >= 0.6) return 'warn'
  if (f > 0.02) return 'ok'
  return 'off'
}

// Absolute thermal ladder: severity must not follow the skin accent.
export function tempState(c) {
  if (c == null || !isFinite(c)) return 'idle'
  if (c >= 85) return 'alert'
  if (c >= 70) return 'warn'
  return 'ok'
}

export const pad2 = (n) => String(n).padStart(2, '0')

export function clockCode(d = new Date()) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

export function relAge(epochSec, nowSec = Date.now() / 1000) {
  if (!epochSec) return '—'
  const s = Math.max(0, Math.round(nowSec - epochSec))
  if (s < 60) return s + 's'
  if (s < 3600) return Math.round(s / 60) + 'm'
  return Math.round(s / 3600) + 'h'
}

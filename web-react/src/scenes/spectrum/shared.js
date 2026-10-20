// Logit Spectrum shared chrome: the scene's own derives. The deterministic
// helpers and the active-runtime figure are shared console-wide and live in
// lib/derive; this module re-exports the ones the spectrum's components
// import and keeps only what is specific to the spectrogram, the phase
// strip and the reasoning lock. All bindings read the feed snapshot plus
// the conductor's smoothed scalars (heat/alert/flow/reason); the scene owns
// no timers.
//
// Telemetry mapping:
//   reasoning lock      = reasoning.mtp_accept_pct (kpi.mtp fallback), the
//                         confirmed state rides the conductor alert scalar
//   alert index         = conductor.alert (alerts + fresh err events)
//   think tokens        = reasoning.thinking_tokens, the per-tick rate is
//                         the delta between feed snaps (module memory)
//   phase activity      = prefill from kpi.ttft, decode from kpi.tps,
//                         think from the think rate, reingest from kpi.reingest
//   class mix           = snap.events grouped by message shape
//   anomaly log         = the newest feed events
//   engine bars         = engine rates.decode_tps per engine
//   request pipeline    = kpi.queue / kpi.ttft / kpi.tps / think / requests
//   think share         = think rate over think rate + decode rate
//   decode share        = decode activity over decode + prefill activity

import { activeRuntime, clamp, det, pad, staleOf } from '../../lib/derive'

export { det, pad, staleOf }

export const runtimeOf = activeRuntime

export function grp(n) {
  return Math.round(n).toLocaleString('en-US')
}

// Feed clock: hours:minutes:seconds that march on the feed tick, so wall
// time freezes with a held feed and stays still under reduced motion.
const CLOCK_SEED = 9 * 3600 + 52 * 60
export function clockOf(tick) {
  const total = Math.max(0, Math.floor(tick || 0)) + CLOCK_SEED
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600) % 24
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

// Event wall time: events carry epoch seconds, the print is HH:MM:SS.
export function hmOf(epochS) {
  const d = new Date((epochS || 0) * 1000)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// ---------------------------------------------------------------------------
// Spectrogram: time falls down the tube (newest row at NOW, bottom), and a
// row's brightness profile across the bins is three lobes: think (left),
// decode (centre, the broad one), mtp acceptance (right). Anomalies burn a
// bright streak across the rows that land while the flare is fresh.
// Returns 0..1 fields the painters read every frame.
// ---------------------------------------------------------------------------

// Perceptual heat ramp for the spectrogram, built from the active scheme's
// canvas channels: dark noise floor → accent → data → bright hot carrier.
// The floor dims the accent toward black so it sits near the scene
// background while keeping the scheme hue; the carrier lifts the data
// channel toward the hot colour. Derived per paint, so a scheme switch
// re-tints the whole history with no hard-coded hex.
const rgbOf = (ch) => {
  const s = String(ch || '125 184 196').split(' ')
  return [Number(s[0]) || 0, Number(s[1]) || 0, Number(s[2]) || 0]
}

const mix = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
]

export function heatRamp(pal) {
  const acc = rgbOf(pal && pal.acc)
  const dat = rgbOf(pal && pal.dat)
  const col = rgbOf(pal && pal.col)
  const floor = mix([0, 0, 0], acc, 0.12)
  const hot = mix(dat, col, 0.6).map((v) => Math.min(255, Math.round(v * 1.2 + 18)))
  return [
    { v: 0.0, c: floor, a: 0.55 },
    { v: 0.42, c: floor, a: 0.75 },
    { v: 0.62, c: acc, a: 0.65 },
    { v: 0.82, c: dat, a: 0.95 },
    { v: 1.0, c: hot, a: 1 },
  ]
}

// Sample the ramp at v (0..1). The alarm streak stays outside the scale and
// is handled at the call site.
export function rampColor(ramp, v) {
  const x = Math.min(1, Math.max(0, v))
  let i = 1
  while (i < ramp.length - 1 && ramp[i].v < x) i++
  const lo = ramp[i - 1]
  const hi = ramp[i]
  const t = hi.v === lo.v ? 0 : (x - lo.v) / (hi.v - lo.v)
  const c = mix(lo.c, hi.c, t)
  const a = lo.a + (hi.a - lo.a) * t
  return `rgb(${c[0]} ${c[1]} ${c[2]} / ${a.toFixed(3)})`
}

// The think rate: the delta of reasoning.thinking_tokens between feed snaps.
// The previous reading lives in module memory the way the spark painters
// hold their history. Painters call this every frame off the same snap, so
// the delta is computed once per snapshot and memoised on its reference.
let lastThink = null
const thinkMemo = { snap: null, total: null, rate: null }
export function thinkRate(snap) {
  if (snap && thinkMemo.snap === snap) return { total: thinkMemo.total, rate: thinkMemo.rate }
  const r = (snap && snap.reasoning) || {}
  const now = r.thinking_tokens != null ? r.thinking_tokens : null
  let d = null
  if (now != null && lastThink != null && now >= lastThink) d = now - lastThink
  if (now != null && snap && snap.mode !== 'offline') lastThink = now
  thinkMemo.snap = snap
  thinkMemo.total = now
  thinkMemo.rate = d
  return { total: now, rate: d }
}

// The lane amps for one snapshot: think, decode, mtp, plus the alert spike.
// Each lane is normalised over the range the phase loop actually visits, so
// the lanes separate on the tube instead of all pinning near the floor.
export function lanesOf(snap, conductor) {
  const r = (snap && snap.reasoning) || {}
  const k = (snap && snap.kpi) || {}
  const stale = staleOf(snap)
  const rate = thinkRate(snap).rate
  const think = stale ? 0 : rate != null ? clamp(rate / 200, 0, 1) : conductor ? clamp(conductor.reason * 0.6, 0, 1) : 0
  const decode = stale ? 0 : conductor ? clamp(conductor.flow, 0, 1) : 0
  const mtpRaw = r.mtp_accept_pct != null ? r.mtp_accept_pct : k.mtp != null ? k.mtp : null
  const mtp = stale || mtpRaw == null ? 0 : clamp((mtpRaw - 25) / 75, 0, 1)
  const spike = stale ? 0 : conductor ? clamp(conductor.alert, 0, 1) : 0
  return { think, decode, mtp, spike }
}

// ---------------------------------------------------------------------------
// Reasoning lock: the acceptance figure under lock, and the confirmed state
// once the alert scalar crosses 0.25. The score is the reasoning feed's own
// number, never a decorated one.
// ---------------------------------------------------------------------------

export function lockScore(snap, conductor) {
  const r = (snap && snap.reasoning) || {}
  const k = (snap && snap.kpi) || {}
  const alert = conductor ? clamp(conductor.alert, 0, 1) : 0
  const confirmed = alert > 0.25
  const mtp = r.mtp_accept_pct != null ? r.mtp_accept_pct : k.mtp != null ? k.mtp : null
  return { score: mtp != null ? Math.round(mtp) : null, confirmed, alert }
}

// Alert index 0..100 off the conductor's smoothed alert scalar, which is
// itself derived from active alerts, fresh err events and vram pressure.
export function alertIndex(snap, conductor) {
  const alerts = (snap && snap.alerts) || []
  const raw = conductor ? clamp(conductor.alert, 0, 1) : alerts.length ? 0.45 : 0
  return { index: Math.round(raw * 100), alerts }
}

// ---------------------------------------------------------------------------
// Phase activity: four readouts, one per inference phase. Each is a real key
// normalised to 0..1, and the label names its source, so no bar prints a
// metric the feed does not carry.
// ---------------------------------------------------------------------------

export function phaseMix(snap, conductor) {
  const k = (snap && snap.kpi) || {}
  const lanes = lanesOf(snap, conductor)
  const offline = !snap || snap.mode === 'offline'
  const prefill = k.ttft != null && !offline ? clamp(k.ttft / 1000, 0, 1) : 0
  const decode = lanes.decode
  const think = lanes.think
  const reingest = k.reingest != null && !offline ? clamp(k.reingest / 60, 0, 1) : 0
  return [
    { name: 'PREFILL', v: prefill, src: k.ttft != null ? `${Math.round(k.ttft)} MS` : '—' },
    { name: 'DECODE', v: decode, src: k.tps != null ? `${Math.round(k.tps)} T/S` : '—' },
    { name: 'THINK', v: think, src: `${Math.round(think * 200)} T/S` },
    { name: 'REINGEST', v: reingest, src: k.reingest != null ? `${Math.round(k.reingest)} %` : '—' },
  ]
}

// ---------------------------------------------------------------------------
// Class mix: the newest 40 feed events grouped by message shape, as a share.
// A quiet log prints an empty mix, never a fabricated one.
// ---------------------------------------------------------------------------

const classTag = (msg, level) => {
  const m = String(msg || '')
  if (level === 'err' || level === 'alert') return 'ALERT'
  if (/kv|slot|cohort|cache|reingest/i.test(m)) return 'KV'
  if (/queue|p95|decode|tok/i.test(m)) return 'QUEUE'
  if (/vram|power|temp|watt/i.test(m)) return 'GPU'
  if (/phase|burst|recover|request/i.test(m)) return 'FLOW'
  return 'SYS'
}

export function classMix(snap) {
  const events = ((snap && snap.events) || []).slice(0, 40)
  const counts = { KV: 0, QUEUE: 0, FLOW: 0, GPU: 0, ALERT: 0, SYS: 0 }
  for (const e of events) {
    if (!e) continue
    counts[classTag(e.msg, e.level)] += 1
  }
  const n = events.length
  const names = Object.keys(counts)
  return names.map((name) => ({ name, v: n ? (counts[name] / n) * 100 : 0, n: counts[name] }))
}

// Anomaly log: the last 12 feed events, newest first.
export function history12(snap) {
  const events = ((snap && snap.events) || []).slice(0, 12)
  return events.map((e, i) => ({
    id: e && e.id != null ? e.id : `ev-${i}`,
    t: e && e.t != null && isFinite(e.t) ? hmOf(e.t) : '—',
    msg: String((e && e.msg) || 'EVENT').slice(0, 26).toUpperCase(),
    level: (e && e.level) || 'info',
  }))
}

// ---------------------------------------------------------------------------
// Engine bars: one bar per engine, load = the engine's own decode rate.
// Missing engines drop out instead of ghosting a fake slot.
// ---------------------------------------------------------------------------

export function engineLevels(snap) {
  const engines = ((snap && snap.engines) || []).slice(0, 8)
  return engines.map((e, i) => {
    const share = e && e.rates && e.rates.decode_tps != null ? e.rates.decode_tps : null
    const load = share != null ? clamp(share / 120, 0.06, 1) : e && e.up === false ? 0 : 0.42
    return { id: e.key || `eng-${i}`, label: e.label || e.key || `ENG-${pad(i + 1)}`, up: e ? e.up !== false : false, load, tps: share }
  })
}

// ---------------------------------------------------------------------------
// Request pipeline: five stages lit by real state. QUEUE waits while the
// depth is non-zero, PREFILL runs while a TTFT is measured, DECODE runs
// while tokens flow, THINK runs while the think rate is up, DONE holds once
// the ledger has records. Offline holds the whole chain.
// ---------------------------------------------------------------------------

export function pipelineStages(snap, conductor) {
  const k = (snap && snap.kpi) || {}
  const r = (snap && snap.reasoning) || {}
  const think = thinkRate(snap).rate
  const offline = !snap || snap.mode === 'offline'
  const queued = (k.queue || 0) > 0
  const stages = [
    { name: 'QUEUE', state: offline ? 'HOLD' : queued ? 'WAIT' : 'CLEAR' },
    { name: 'PREFILL', state: offline ? 'HOLD' : k.ttft != null ? 'RUN' : 'IDLE' },
    { name: 'DECODE', state: offline ? 'HOLD' : (k.tps || 0) > 0 ? 'RUN' : 'IDLE' },
    { name: 'THINK', state: offline ? 'HOLD' : think > 0 || (r.thinking_tokens || 0) > 0 ? 'RUN' : 'IDLE' },
    { name: 'DONE', state: offline ? 'HOLD' : ((snap && snap.requests) || []).length > 0 ? 'DONE' : 'IDLE' },
  ]
  return stages
}

// ---------------------------------------------------------------------------
// Think share: the think rate over the think rate + the decode rate, the
// honest split of the tokens this tick produced. Zero while nothing runs.
// Decode share: decode activity over decode + prefill activity, for the
// second dial.
// ---------------------------------------------------------------------------

export function sharesOf(snap, conductor) {
  const k = (snap && snap.kpi) || {}
  const rate = thinkRate(snap).rate || 0
  const tps = k.tps != null ? k.tps : 0
  const thinkN = clamp(rate / 200, 0, 1)
  const decodeN = clamp(tps / 280, 0, 1)
  const prefillN = k.ttft != null ? clamp(k.ttft / 1000, 0, 1) : 0
  const thinkShare = thinkN + decodeN > 0 ? (thinkN / (thinkN + decodeN)) * 100 : 0
  const decodeShare = decodeN + prefillN > 0 ? (decodeN / (decodeN + prefillN)) * 100 : 0
  const offline = !snap || snap.mode === 'offline'
  return {
    thinkShare: offline ? null : thinkShare,
    decodeShare: offline ? null : decodeShare,
    thinkRate: rate,
    tps,
  }
}

// Live latency: p95 and ttft, both in ms off the KPI block.
export function latOf(snap) {
  const k = (snap && snap.kpi) || {}
  return {
    p95: k.p95 != null ? Math.round(k.p95) : null,
    ttft: k.ttft != null ? Math.round(k.ttft) : null,
    offline: !snap || snap.mode === 'offline',
  }
}

// Top meta pills + bottom event ticker: uptime, arrival rate, ledger size,
// the newest events as the ticker line.
export function metaOf(snap) {
  const host = (snap && snap.host) || null
  const k = (snap && snap.kpi) || {}
  const up = host && host.uptime != null ? host.uptime : null
  const dd = up != null ? Math.floor(up / 86400) : null
  const hh = up != null ? pad(Math.floor(up / 3600) % 24) : null
  const mm = up != null ? pad(Math.floor(up / 60) % 60) : null
  const rpm = k.rpm != null ? k.rpm : null
  const ledger = ((snap && snap.requests) || []).length
  return {
    up: up != null ? `UP ${dd}D ${hh}:${mm}` : 'UP —',
    ledger: `${ledger.toLocaleString('en-US')} LEDGERED`,
    rpm: rpm != null ? `${Math.round(rpm)} REQ/MIN` : '— REQ/MIN',
    ticker: ((snap && snap.events) || []).slice(0, 9),
  }
}

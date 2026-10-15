// Deepsignal shared chrome: deterministic helpers (no RNG: the scene must
// replay identically on reload and settle identically under reduced motion).
// All bindings read the feed snapshot plus the conductor's smoothed scalars
// (heat/alert/flow/reason); the scene itself owns no timers.

export function det(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export function hashCode(s) {
  let h = 0
  const str = String(s)
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function pad(n, w = 2) {
  return String(n).padStart(w, '0')
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

// Dormant outpost: offline/boot or a held zero-tps stream. Heat and spike
// park so the waterfall scrolls near-empty (dimmed drift) and the band
// strip settles; the rails already hold their numbers behind HOLD states.
export function staleOf(snap) {
  const k = (snap && snap.kpi) || {}
  return !snap || snap.mode === 'offline' || snap.mode === 'boot' || (k.tps || 0) === 0
}

// Active-runtime figure for the RUNTIME edge span: the loaded model plus
// live tok/s, gpu temp and engine load, in outpost-neutral nouns. Model =
// kpi.tps_models[0], else the first up engine label, else models[0].id;
// engine = first up label, else up/total. Pure function of snap; the scene
// renders no ACTIVE-model hero by design, this span is the closest live line.
export function runtimeOf(snap) {
  const k = (snap && snap.kpi) || {}
  const fromTps = Array.isArray(k.tps_models) && k.tps_models.length ? String(k.tps_models[0]) : null
  const engines = ((snap && snap.engines) || []).filter((e) => e && e.key != null)
  const up = engines.filter((e) => e.up !== false)
  const first = up.length ? up[0] : null
  const fromEng = first ? String(first.label || first.key) : null
  const models = (snap && snap.models) || []
  const fromModels = models.length ? String(models[0].id || models[0]) : null
  const gpu = (snap && snap.gpu) || null
  return {
    model: fromTps || fromEng || fromModels,
    tps: k.tps != null ? k.tps : null,
    temp: gpu && gpu.temp != null ? gpu.temp : null,
    engine: fromEng || (engines.length ? `${up.length}/${engines.length}` : null),
  }
}

// SAST wall clock (UTC+2) advanced at feed rate from the snapshot clock, so
// it ticks in live and demo and freezes identically under reduced motion.
// Seed puts the shift near the 02:14 candidate log on first paint.
export function sastOf(snap) {
  const t = (snap && snap.t != null ? snap.t : 0) || 0
  const total = Math.floor(t) + 2 * 3600 + 414
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600) % 24
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

// ---------------------------------------------------------------------------
// Waterfall + band strip: time×frequency heat from the thinking-token rate
// (reason scalar) blended with token flow; the amber spike rides the alert
// scalar. Returns 0..1 fields the painters read every frame.
// ---------------------------------------------------------------------------

export function waterfallOf(snap, conductor) {
  if (staleOf(snap)) return { heat: 0.06, spike: 0, tps: 0, think: 0, amberX: 0.62 }
  const k = (snap && snap.kpi) || {}
  const r = (snap && snap.reasoning) || {}
  const think = r.thinking_tokens != null ? r.thinking_tokens : (conductor ? conductor.reason * 400 : 0)
  const thinkRate = clamp(think / 400, 0, 1)
  const flow = conductor ? clamp(conductor.flow, 0, 1) : 0
  const reason = conductor ? clamp(conductor.reason, 0, 1) : 0
  const heat = clamp(0.22 + thinkRate * 0.45 + flow * 0.33, 0, 1)
  const spike = conductor ? clamp(conductor.alert, 0, 1) : 0
  const tps = k.tps != null ? k.tps : 0
  return { heat, spike, tps, think: Math.round(think), amberX: 0.62 + reason * 0.08 }
}

// 200 band-strip bins from the heat scalar, one deterministic shimmer term
// per cell so the strip breathes without a timer. Settling (240 ms) is the
// .ds-band-i CSS transition on the cells.
export function bandBins(snap, conductor, n = 200) {
  const w = waterfallOf(snap, conductor)
  const tick = (snap && snap.tick != null ? snap.tick : conductor ? conductor.tick : 0) || 0
  const bins = []
  for (let i = 0; i < n; i++) {
    const pos = i / (n - 1)
    // two persistent carriers (sky noise floor + band-shape) plus the live
    // heat; the amber spikeatest near amberX.
    const floor = 0.1 + det(i * 1.7) * 0.22
    const shape = 0.5 + 0.5 * Math.sin(pos * Math.PI * 3 + 1.2)
    const shimmer = (det(i * 7.3 + Math.floor(tick) * 0.91) - 0.5) * 0.12
    let v = clamp(floor * 0.4 + shape * 0.25 + w.heat * 0.55 + shimmer, 0, 1)
    const d = Math.abs(pos - w.amberX)
    if (d < 0.02) v = clamp(v + w.spike * (1 - d / 0.02) * 0.9 + w.spike * 0.2, 0, 1)
    bins.push(v)
  }
  return { bins, spike: w.spike, amberX: w.amberX }
}

// Candidate score: the reference holds 74 after confirmation at 02:14. The
// flag stands (and the pip pulses) once the alert scalar crosses 0.25.
export function candScore(snap, conductor) {
  const alert = conductor ? clamp(conductor.alert, 0, 1) : 0
  const confirmed = alert > 0.25
  return { score: confirmed ? 74 : 73, confirmed, alert }
}

// Live latency: queue seconds from p95, RTT from ttft (both arrive in ms).
export function latOf(snap) {
  const k = (snap && snap.kpi) || {}
  const q = k.p95 != null ? k.p95 / 1000 : k.ttft != null ? k.ttft / 1000 : null
  const rtt = k.ttft != null ? k.ttft : 137
  return {
    queue: q != null ? q.toFixed(2) : '—',
    rtt: q != null || k.ttft != null ? Math.round(rtt) : 137,
    offline: !snap || snap.mode === 'offline',
  }
}

// D-01..D-12 dishes from the engine table: up/down + per-engine load from
// the decode rate share. Missing engines ghost the cell.
export function dishLevels(snap) {
  const engines = (snap && snap.engines) || []
  const levels = []
  for (let i = 0; i < 12; i++) {
    const e = engines.length ? engines[i % engines.length] : null
    const share = e && e.rates && e.rates.decode_tps != null ? e.rates.decode_tps : null
    const load = share != null ? clamp(share / 60, 0.06, 1) : e ? (e.up === false ? 0 : 0.42) : 0
    levels.push({
      id: `D-${pad(i + 1)}`,
      up: e ? e.up !== false : false,
      load,
      maint: i >= 6 && i <= 7,
    })
  }
  return levels
}

// Feed event clock: `t` arrives as epoch seconds (simulator `now`, adapt
// passthrough); the rail prints wall HH:MM like the safehouse transcript.
function hmOf(epochS) {
  const d = new Date(epochS * 1000)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Candidate history: the last 12 feed events, newest first.
export function history12(snap) {
  const events = ((snap && snap.events) || []).slice(-12).reverse()
  return events.map((e, i) => ({
    id: e && e.id != null ? e.id : `ev-${i}`,
    t: e && e.t != null && isFinite(e.t) ? hmOf(e.t) : '—',
    msg: String((e && e.msg) || 'NOISE').slice(0, 26).toUpperCase(),
    level: (e && e.level) || 'info',
  }))
}

// Decoder pipeline: 7 stages gated by engine up/down + queue depth.
export function pipeline7(snap) {
  const engines = (snap && snap.engines) || []
  const up = engines.filter((e) => e && e.up).length
  const total = engines.length || 1
  const frac = up / total
  const k = (snap && snap.kpi) || {}
  const queued = (k.queue || 0) > 0
  const stages = ['RAW', 'DEMOD', 'FFT', 'CLASSIFY', 'CROSS-CORR', 'ARCHIVE', 'PEER QUERY']
  return stages.map((name, i) => {
    const need = (i + 1) / stages.length
    const run = frac >= need - 0.001
    return { name, state: !snap || snap.mode === 'offline' ? 'HOLD' : run ? (queued && i >= 4 ? 'QUEUE' : 'RUN') : 'HOLD' }
  })
}

// L/C/X/K band strips from the VRAM split (4 bands → 4 engines); engines
// missing reuses the GPU headroom so the meters never flatline.
export function bandStrips(snap) {
  const engines = (snap && snap.engines) || []
  const gpu = (snap && snap.gpu) || null
  const names = ['L-BAND', 'C-BAND', 'X-BAND', 'K-BAND']
  return names.map((name, i) => {
    const e = engines.length ? engines[i % engines.length] : null
    const sess = (e && e.sessions) || []
    let used = 0
    let win = 0
    for (const s of sess) {
      used += s.used || 0
      win += s.window || 0
    }
    let fill = win > 0 ? clamp(used / win, 0, 1) : 0
    if (!win && gpu && gpu.vramTotal) fill = clamp(gpu.vram / gpu.vramTotal, 0.05, 1) * (0.72 + det(i * 3.1) * 0.4)
    if (!win && !gpu) fill = 0.3 + det(i * 3.1) * 0.3
    return { name, fill: clamp(fill, 0, 1), up: e ? e.up !== false : !!gpu }
  })
}

// RFI hits this hour: anomaly-level events in the log, floor of 47 to match
// the reference's suppressed-band counter when the log is quiet.
export function rfiCount(snap) {
  const events = (snap && snap.events) || []
  const n = events.filter((e) => e && (e.level === 'warn' || e.level === 'err' || e.level === 'alert')).length
  return { hits: Math.max(47, n), suppressed: n === 0 }
}

// S/N ratio, integration time, antenna temp: tps / queue / gpu temp.
export function gaugeVals(snap) {
  const k = (snap && snap.kpi) || {}
  const gpu = (snap && snap.gpu) || null
  return {
    snr: k.tps != null ? (8.4 + clamp(k.tps / 40, 0, 6)).toFixed(1) : '—',
    integ: k.queue != null ? `${Math.round(40 + k.queue * 2)} s` : '—',
    temp: gpu && gpu.temp != null ? `${Math.round(gpu.temp)} K` : '—',
  }
}

// Classifier bars: mtp-accept / cache split proxies, flagged per the card
// (no direct KPIs for coherence/drift/repeat).
export function classifierBars(snap, conductor) {
  const r = (snap && snap.reasoning) || {}
  const k = (snap && snap.kpi) || {}
  const alert = conductor ? clamp(conductor.alert, 0, 1) : 0
  const mtp = r.mtp_accept_pct != null ? r.mtp_accept_pct : k.mtp != null ? k.mtp : 74
  const cache = k.cache != null ? k.cache : 61
  return [
    { name: 'NARROWBAND', v: clamp(mtp, 0, 100) },
    { name: 'COHERENCE', v: clamp(cache, 0, 100) },
    { name: 'DRIFT-RATE', v: clamp(30 + alert * 55, 0, 100) },
    { name: 'LOCAL-RFI', v: clamp(88 - alert * 40, 0, 100) },
    { name: 'REPEAT', v: clamp(12 + alert * 70, 0, 100) },
    { name: 'ATMOSPHERIC', v: clamp(64 - alert * 20, 0, 100) },
  ]
}

// Top meta pills + bottom bot-log ticker: shift/uptime, candidate counts,
// the newest events as the ticker line.
export function metaOf(snap) {
  const host = (snap && snap.host) || null
  const k = (snap && snap.kpi) || {}
  const up = host && host.uptime != null ? host.uptime : (snap && snap.t) || 0
  const dd = Math.floor(up / 86400)
  const hh = pad(Math.floor(up / 3600) % 24)
  const mm = pad(Math.floor(up / 60) % 60)
  const rpm = k.rpm != null ? k.rpm : 0
  const cands = 9432 - Math.round(rpm % 40)
  return {
    shift: `SHIFT ${dd}D ${hh}:${mm}`,
    cands: `${cands.toLocaleString('en-US')} CANDS`,
    rpm: `${Math.round(rpm)} RPM`,
    ticker: ((snap && snap.events) || []).slice(-9).reverse(),
  }
}

// Pointing lore (decorative, flagged in the report): fixed RA/DEC for the
// GJ 1132 track solution; the AZ/EL needles wobble deterministically with
// the snapshot clock so they sit still under reduced motion.
export function pointingOf(snap) {
  const t = (snap && snap.t != null ? snap.t : 0) || 0
  return {
    az: 218 + Math.sin(t / 40) * 1.4,
    el: 47 + Math.cos(t / 55) * 0.9,
    ra: '10h 14m 51s',
    dec: '−12° 55′ 04″',
  }
}

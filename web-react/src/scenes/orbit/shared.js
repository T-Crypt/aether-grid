// Context Orbit shared chrome: the scene's own derives. The deterministic
// helpers and the active-runtime figure are shared console-wide and live in
// lib/derive; this module re-exports the ones this scene's components import
// and keeps only the slot, memory and pressure bindings. The scene never
// owns a timer; transient row flashes restart a finite CSS animation by
// re-keying the element.

import { activeRuntime, clamp, hexFrom, pad, staleOf } from '../../lib/derive'

export { staleOf }

export const activeOf = activeRuntime

export function grp(n) {
  return Math.round(n).toLocaleString('en-US')
}

// Master clock in display seconds (conductor.t is seconds, frozen under
// reduced motion / held feed — a valid static value either way).
export function clockOf(sec, seed = 0) {
  const total = Math.max(0, Math.floor(sec)) + seed
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600) % 24
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

// ---------------------------------------------------------------------------
// The KV slot system. Pods are the orbit; sessions are the slots.
// ---------------------------------------------------------------------------

export const POD_COUNT = 12

// Slot fill -> state name. The thresholds are the console-wide KV well
// states (lib/format wellState): 0.6 is the warn line, 0.85 the alert line.
// A filling slot reads PREFILL, a heavy one DECODE, an empty one IDLE and
// one past the alert line EVICT.
export function slotState(fill) {
  if (fill >= 0.85) return 'EVICT'
  if (fill >= 0.6) return 'DECODE'
  if (fill > 0.02) return 'PREFILL'
  return 'IDLE'
}

// 12 pods from the session pool. With more sessions than pods the pool is
// sampled end to end (pod 0 the first slot, pod 11 the last) so the orbit
// reads the whole pool; with fewer, empty pods stay and read IDLE. Slot ids
// are derived from the real session id (decorative, per the report rules).
export function podsOf(snap) {
  const sessions = (snap && snap.sessions) || []
  const n = sessions.length
  const pods = []
  for (let i = 0; i < POD_COUNT; i++) {
    const idx = n >= POD_COUNT ? Math.round((i * (n - 1)) / (POD_COUNT - 1)) : i < n ? i : -1
    const s = idx >= 0 ? sessions[idx] : null
    const fill = s && s.window ? clamp((s.used || 0) / s.window, 0, 1) : 0
    pods.push({
      pod: i,
      idx,
      id: s ? hexFrom(`kv-slot-${s.id}`, 4) : '----',
      engine: s ? s.engine : null,
      used: s ? s.used || 0 : 0,
      win: s ? s.window || 0 : 0,
      cached: s ? s.cached : null,
      fill,
      state: slotState(fill),
    })
  }
  return pods
}

// Session row index -> pod index (the reverse of the sampling above), so a
// kv_slot_changed event flash lands on the pod bound to that session.
export function podOfSession(sessions, index) {
  const n = (sessions || []).length
  if (n <= 0) return 0
  if (n < POD_COUNT) return index
  return Math.round((index * (POD_COUNT - 1)) / Math.max(1, n - 1))
}

// ---------------------------------------------------------------------------
// Callout anchors: [anchorX, anchorY, labelX, labelY, side] in the leader-svg
// viewBox (1244 x 834), converted to percentages here so the same composition
// scales to any stage size. The hero painter reads the same table, so its
// pods, gauge nodes and the leader dots land on the same points.
// ---------------------------------------------------------------------------

const VBX = 1244
const VBY = 834
const pct = (x, y) => ({ x: (x / VBX) * 100, y: (y / VBY) * 100 })

// One entry per leader-line callout (18). `side` is the label anchor side.
// Label anchors are chosen so no two chips in the same column collide: a chip
// is three lines tall (~40 px in the 834 px viewBox), so same-column anchors
// need that much separation.
//
// Seven anchors sit on the pod ring (the slot callouts, `bind: 'slot:N'` for
// pod N); the other eleven sit on the inner telemetry ring and the outer
// gauge ring and bind to pressure telemetry.
export const CALLOUTS = [
  { a: pct(740.9, 623.0), l: pct(560.0, 726.0), side: 'left', bind: 'slot:5' },
  { a: pct(622.0, 179.1), l: pct(505.0, 200.0), side: 'right', bind: 'slot:0' },
  { a: pct(828.0, 298.1), l: pct(324.3, 314.0), side: 'left', bind: 'slot:2' },
  { a: pct(622.0, 654.9), l: pct(919.7, 727.0), side: 'right', bind: 'slot:6' },
  { a: pct(416.0, 535.9), l: pct(919.7, 610.1), side: 'right', bind: 'slot:8' },
  { a: pct(384.1, 417.0), l: pct(919.7, 417.0), side: 'right', bind: 'slot:9' },
  { a: pct(441.7, 351.4), l: pct(239.0, 360.0), side: 'left', bind: 'ctx' },
  { a: pct(475.1, 293.7), l: pct(306.1, 268.0), side: 'left', bind: 'kvpct' },
  { a: pct(622.0, 117.8), l: pct(324.3, 222.0), side: 'left', bind: 'queue' },
  { a: pct(768.9, 293.7), l: pct(796.0, 290.0), side: 'right', bind: 'vram' },
  { a: pct(802.3, 351.4), l: pct(1005.0, 340.0), side: 'right', bind: 'ram' },
  { a: pct(622.0, 716.2), l: pct(919.7, 786.0), side: 'right', bind: 'evict' },
  { a: pct(903.2, 519.3), l: pct(1005.0, 549.1), side: 'right', bind: 'temp' },
  { a: pct(322.8, 417.0), l: pct(215.7, 417.0), side: 'left', bind: 'feed' },
  { a: pct(441.7, 482.6), l: pct(239.0, 490.0), side: 'left', bind: 'util' },
  { a: pct(368.6, 265.0), l: pct(239.0, 176.0), side: 'left', bind: 'tps' },
  { a: pct(875.4, 569.0), l: pct(1005.0, 675.0), side: 'right', bind: 'reing' },
]

// Telemetry callout copy: bind -> [key line, name line]. Key lines stay
// short: a right-column chip at x=1005 has ~177 px to the stage edge at
// 1280 px, so the copy is capped well under that.
const TELE_BINDS = {
  kvpct: ['KV POOL', 'kv cache share'],
  ctx: ['CTX TOK', 'context tokens'],
  vram: ['GPU VRAM', 'vram allocated'],
  ram: ['HOST RAM', 'host memory'],
  util: ['GPU LOAD', 'compute util'],
  queue: ['QUEUE', 'requests queued'],
  evict: ['EVICT WATCH', 'slots at 85%+'],
  temp: ['GPU THERM', 'thermals'],
  feed: ['FEED LINK', 'telemetry link'],
  tps: ['DECODE', 'decode rate'],
  reing: ['REINGEST', 'cache reingest'],
}

// One callout's copy and state: pods read their bound session, the rest the
// pressure telemetry. `stale` sweeps every chip to HELD. State keys match
// the leader colours: alarm / warn / normal / swept.
export function calloutState(bind, snap, heat, alert, stale) {
  const k = (snap && snap.kpi) || {}
  const gpu = (snap && snap.gpu) || null
  const host = (snap && snap.host) || null
  const sessions = (snap && snap.sessions) || []
  if (bind.startsWith('slot:')) {
    const pod = podsOf(snap)[Number(bind.slice(5))]
    if (stale) return { state: 'swept', key: 'KV SLOT · FEED HELD', val: 'HELD', pill: 'HELD' }
    const pctv = pod.win ? Math.round(pod.fill * 100) : null
    return {
      state: pod.fill >= 0.85 ? 'alarm' : pod.fill >= 0.6 ? 'warn' : 'normal',
      key: `KV SLOT ${pod.id} · POD ${pad(pod.pod + 1, 2)}${pctv != null ? ` · KV ${pctv}%` : ''}`,
      val: pod.win ? `${grp(pod.used)} / ${grp(pod.win)} CTX TOK` : 'EMPTY SLOT',
      pill: pod.state,
    }
  }
  const [b1, b2] = TELE_BINDS[bind] || ['—', '—']
  if (stale) return { state: 'swept', key: `${b1} · FEED HELD`, val: 'HELD', pill: 'HELD' }
  const f = (v, d = 1) => (v == null || !isFinite(v) ? null : v.toFixed(d))
  switch (bind) {
    case 'kvpct':
      return { state: k.cache != null && k.cache < 40 ? 'warn' : 'normal', key: `${b1} · ${b2}`, val: k.cache != null ? `${Math.round(k.cache)}%` : '—', pill: 'POOL' }
    case 'ctx': {
      const used = sessions.reduce((a, s) => a + (s.used || 0), 0)
      return { state: 'normal', key: `${b1} · ${b2}`, val: used >= 1e6 ? `${(used / 1e6).toFixed(2)}M` : grp(used), pill: 'TOK' }
    }
    case 'vram': {
      const pctv = gpu && gpu.vramTotal ? (gpu.vram || 0) / gpu.vramTotal : null
      return {
        state: pctv != null && pctv >= 0.9 ? 'alarm' : pctv != null && pctv >= 0.75 ? 'warn' : 'normal',
        key: `${b1} · ${b2}`,
        val: gpu ? `${f(gpu.vram)} / ${f(gpu.vramTotal, 0)} GB` : '—',
        pill: pctv != null ? `${Math.round(pctv * 100)}%` : '—',
      }
    }
    case 'ram': {
      const pctv = host && host.ramTotal ? (host.ramUsed || 0) / host.ramTotal : null
      return {
        state: pctv != null && pctv >= 0.85 ? 'warn' : 'normal',
        key: `${b1} · ${b2}`,
        val: host ? `${f(host.ramUsed)} / ${f(host.ramTotal, 0)} GB` : '—',
        pill: pctv != null ? `${Math.round(pctv * 100)}%` : '—',
      }
    }
    case 'util':
      return { state: 'normal', key: `${b1} · ${b2}`, val: gpu && gpu.util != null ? `${Math.round(gpu.util)}%` : '—', pill: 'SM' }
    case 'queue':
      return { state: k.queue != null && k.queue > 8 ? 'warn' : 'normal', key: `${b1} · ${b2}`, val: k.queue != null ? grp(k.queue) : '—', pill: 'REQ' }
    case 'evict': {
      const flagged = sessions.filter((s) => s.window && (s.used || 0) / s.window >= 0.85).length
      return { state: flagged ? 'alarm' : 'normal', key: `${b1} · ${b2}`, val: `${flagged} AT 85%+`, pill: flagged ? 'ARMED' : 'CLEAR' }
    }
    case 'temp': {
      const hot = gpu && gpu.temp != null ? gpu.temp >= 70 : false
      return {
        state: hot ? 'warn' : 'normal',
        key: `${b1} · ${b2}`,
        val: gpu && gpu.temp != null ? `${Math.round(gpu.temp)}°C · ${gpu.power != null ? Math.round(gpu.power) : '—'}W` : '—',
        pill: 'NOM',
      }
    }
    case 'feed': {
      const off = !snap || snap.mode === 'offline'
      return { state: off ? 'warn' : 'normal', key: `${b1} · ${b2}`, val: off ? 'NO LINK' : 'SSE · 1.0S', pill: off ? 'LOSE' : 'OPEN' }
    }
    case 'tps':
      return { state: alert > 0.25 ? 'alarm' : 'normal', key: `${b1} · ${b2}`, val: k.tps != null ? `${grp(k.tps)} TOK/S` : '—', pill: 'RATE' }
    case 'reing':
      return { state: k.reingest != null && k.reingest > 40 ? 'warn' : 'normal', key: `${b1} · ${b2}`, val: k.reingest != null ? `${Math.round(k.reingest)}%` : '—', pill: 'REFILL' }
    default:
      return { state: 'normal', key: '—', val: '—', pill: '—' }
  }
}

// ---------------------------------------------------------------------------
// Rails: memory bars, GPU readouts, the pressure telemetry list, the
// eviction log, the headroom ring and the VRAM pressure strip.
// ---------------------------------------------------------------------------

// Left-rail memory block: VRAM and host RAM as paired bars plus the GPU
// readout rows (temp/power/util). Every number is a snapshot key.
export function memOf(snap) {
  const gpu = (snap && snap.gpu) || null
  const host = (snap && snap.host) || null
  const vramPct = gpu && gpu.vramTotal ? clamp((gpu.vram || 0) / gpu.vramTotal, 0, 1) : null
  const ramPct = host && host.ramTotal ? clamp((host.ramUsed || 0) / host.ramTotal, 0, 1) : null
  return {
    vram: { used: gpu ? gpu.vram : null, total: gpu ? gpu.vramTotal : null, pct: vramPct, name: gpu ? gpu.name : null },
    ram: { used: host ? host.ramUsed : null, total: host ? host.ramTotal : null, pct: ramPct },
    temp: gpu ? gpu.temp : null,
    power: gpu ? gpu.power : null,
    util: gpu ? gpu.util : null,
    offline: !gpu && !host,
  }
}

// Right-rail telemetry list: 18 rows, every one a snapshot key or a direct
// derivation (headroom = 1 - vram/vramTotal; at-risk = the 0.85 well state).
// Each row: [label, value, state] — one label per row.
export function telemRows(snap) {
  const k = (snap && snap.kpi) || {}
  const gpu = (snap && snap.gpu) || null
  const host = (snap && snap.host) || null
  const sessions = (snap && snap.sessions) || []
  const engines = (snap && snap.engines) || []
  const flagged = sessions.filter((s) => s.window && (s.used || 0) / s.window >= 0.85).length
  const upEng = engines.filter((e) => e && e.up).length
  const vramPct = gpu && gpu.vramTotal && gpu.vram != null ? gpu.vram / gpu.vramTotal : null
  const f = (v, d = 1) => (v == null || !isFinite(v) ? null : v.toFixed(d))
  const rows = [
    ['VRAM USED', gpu && gpu.vram != null ? `${f(gpu.vram)} / ${f(gpu.vramTotal, 0)} GB` : '—', vramPct != null && vramPct >= 0.9 ? 'alarm' : vramPct != null && vramPct >= 0.75 ? 'warn' : ''],
    ['HEADROOM', vramPct != null ? `${Math.round((1 - vramPct) * 100)}%` : '—', vramPct != null && vramPct >= 0.9 ? 'alarm' : ''],
    ['KV POOL', k.cache != null ? `${Math.round(k.cache)}%` : '—', k.cache != null && k.cache < 40 ? 'warn' : ''],
    ['REINGEST', k.reingest != null ? `${Math.round(k.reingest)}%` : '—', k.reingest != null && k.reingest > 40 ? 'warn' : ''],
    ['SLOTS LIVE', sessions.length ? grp(sessions.length) : '0'],
    ['AT RISK', grp(flagged), flagged ? 'alarm' : ''],
    ['QUEUE', k.queue != null ? grp(k.queue) : '—', k.queue != null && k.queue > 8 ? 'warn' : ''],
    ['DECODE TOK/S', k.tps != null ? grp(k.tps) : '—'],
    ['P95 LATENCY', k.p95 != null ? `${f(k.p95 / 1000)}s` : '—'],
    ['TTFT', k.ttft != null ? `${f(k.ttft / 1000, 2)}s` : '—'],
    ['REQ/MIN', k.rpm != null ? grp(k.rpm) : '—'],
    ['MTP ACCEPT', k.mtp != null ? `${f(k.mtp)}%` : '—'],
    ['THINK TOK', (snap && snap.reasoning && snap.reasoning.thinking_tokens) != null ? grp(snap.reasoning.thinking_tokens) : '—'],
    ['DIE TEMP', gpu && gpu.temp != null ? `${Math.round(gpu.temp)}°C` : '—', gpu && gpu.temp != null && gpu.temp >= 70 ? 'warn' : ''],
    ['BOARD DRAW', gpu && gpu.power != null ? `${Math.round(gpu.power)}W` : '—', gpu && gpu.power != null && gpu.power > 380 ? 'warn' : ''],
    ['COMPUTE UTIL', gpu && gpu.util != null ? `${Math.round(gpu.util)}%` : '—'],
    ['ENGINES UP', `${upEng}/${engines.length || 0}`],
    ['HOST CPU', host && host.cpu != null ? `${Math.round(host.cpu)}%` : '—'],
  ]
  return rows.map(([key, val, state]) => ({ key, val: val == null ? '—' : val, state: state || '' }))
}

// Word-boundary clip for log rows (the spectrum's rule): a row never cuts a
// word in half and never ends on a separator.
export function clipWords(s, n) {
  const t = String(s || '')
  if (t.length <= n) return t
  const cut = t.slice(0, n)
  const sp = cut.lastIndexOf(' ')
  return (sp > n * 0.5 ? cut.slice(0, sp) : cut).replace(/[\s·—-]+$/, '') + '…'
}

// Feed events carry epoch seconds; the log prints HH:MM:SS.
export function hmOf(epochS) {
  const d = new Date((epochS || 0) * 1000)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// Eviction log: the newest feed events that concern capacity — kv, slot,
// cache, vram, power or pressure wording — with everything else skipped.
// An empty list prints an empty log, never a fabricated row.
const EVICT_RE = /kv|slot|cache|vram|power|evict|reingest|pressure|cohort/i
export function evictLog(snap) {
  const events = ((snap && snap.events) || []).filter((e) => e && EVICT_RE.test(String(e.msg || ''))).slice(0, 8)
  return events.map((e, i) => ({
    id: e.id != null ? e.id : `ev-${i}`,
    t: e.t != null && isFinite(e.t) ? hmOf(e.t) : '—',
    msg: clipWords(String(e.msg || '').slice(0, 60).toUpperCase(), 26),
    level: e.level || 'info',
  }))
}

// Headroom ring: free VRAM as a percent of the pool, plus the four rows the
// ring sits beside (all real keys).
export function headroom(snap) {
  const k = (snap && snap.kpi) || {}
  const gpu = (snap && snap.gpu) || null
  const sessions = (snap && snap.sessions) || []
  const vramPct = gpu && gpu.vramTotal && gpu.vram != null ? gpu.vram / gpu.vramTotal : null
  const pct = vramPct != null ? Math.round((1 - vramPct) * 100) : null
  return {
    pct,
    rows: [
      ['VRAM', gpu && gpu.vram != null ? `${f1(gpu.vram)} / ${f1(gpu.vramTotal, 0)} GB` : '—'],
      ['KV POOL', k.cache != null ? `${Math.round(k.cache)}%` : '—'],
      ['SESSIONS', sessions.length ? grp(sessions.length) : '0'],
      ['REINGEST', k.reingest != null ? `${Math.round(k.reingest)}%` : '—'],
    ],
  }
}

const f1 = (v, d = 1) => (v == null || !isFinite(v) ? '—' : v.toFixed(d))

// VRAM pressure strip: kpiHist.vram resampled to 47 cells against the pool
// (hot >= 0.9, warm >= 0.75, dim otherwise); falls back to the
// deterministic seed pattern when no history has landed yet.
export const PRESSURE_SEED = [0, 1, 0, 2, 0, 0, 3, 0, 1, 3, 0, 0, 3, 0, 0, 0, 3, 1, 0, 0, 3, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 1]
export function pressureCells(snap) {
  const gpu = (snap && snap.gpu) || null
  const pool = (gpu && gpu.vramTotal) || 24
  const hist = ((snap && snap.kpiHist && snap.kpiHist.vram) || []).filter((v) => v != null)
  if (hist.length >= 8) {
    const cells = []
    for (let i = 0; i < 47; i++) {
      const v = hist[Math.floor((i / 47) * (hist.length - 1)) || 0] / pool
      cells.push(v >= 0.9 ? 'hot' : v >= 0.75 ? 'warm' : 'dim')
    }
    return cells
  }
  return PRESSURE_SEED.map((v) => (v === 3 ? 'hot' : v === 2 ? 'warm' : 'dim'))
}

// Slot strip cells: the 47-tick stage strip samples the session pool end to
// end (tick 0 the first slot, tick 46 the last), so a dense pool reads as a
// continuous pressure band and a sparse one as scattered live ticks.
export const STRIP_TICKS = 47
export function stripCells(snap) {
  const sessions = (snap && snap.sessions) || []
  const n = sessions.length
  const cells = []
  for (let i = 0; i < STRIP_TICKS; i++) {
    const s = n ? sessions[Math.min(n - 1, Math.floor((i / (STRIP_TICKS - 1)) * (n - 1)))] : null
    const fill = s && s.window ? clamp((s.used || 0) / s.window, 0, 1) : 0
    cells.push({
      id: s ? hexFrom(`kv-slot-${s.id}`, 4) : '----',
      pct: s && s.window ? Math.round(fill * 100) : 0,
      cls: !s ? 'dim' : fill >= 0.85 ? 'risk' : fill >= 0.6 ? 'hot' : fill > 0.02 ? '' : 'dim',
      title: s ? `SLOT ${hexFrom(`kv-slot-${s.id}`, 4)} · KV ${Math.round(fill * 100)}%` : 'IDLE SLOT',
    })
  }
  return cells
}

// Uptime print from host.uptime_s (the collector reports seconds).
export function uptimeOf(snap) {
  const host = (snap && snap.host) || null
  const up = host && host.uptime != null ? host.uptime : null
  if (up == null) return '—'
  const d = Math.floor(up / 86400)
  const h = pad(Math.floor(up / 3600) % 24)
  const m = pad(Math.floor(up / 60) % 60)
  return d > 0 ? `${d}D ${h}:${m}` : `${h}:${m}`
}

// VRAM pool stats for the core plate and the data plate.
export function vramStats(snap) {
  const gpu = (snap && snap.gpu) || null
  const k = (snap && snap.kpi) || {}
  const pct = gpu && gpu.vramTotal && gpu.vram != null ? clamp(gpu.vram / gpu.vramTotal, 0, 1) : null
  return {
    gb: gpu ? gpu.vram : null,
    total: gpu ? gpu.vramTotal : null,
    pct,
    cache: k.cache != null ? Math.round(k.cache) : null,
  }
}

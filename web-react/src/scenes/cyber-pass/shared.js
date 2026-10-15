// Cyber-pass shared chrome: deterministic helpers (no RNG: the scene must
// replay identically on reload and settle identically under reduced motion)
// plus the telemetry binding layer — every readout the plates print is a
// pure function of the latest snap / conductor scalars. The scene never
// owns a timer; transient row flashes restart a finite CSS animation by
// re-keying the element.
//
// Reference lore (uispace.org/cyber-pass): a mountain customs booth whose
// handheld assay lights amber or violet beside a button-currency exchange
// whose price of water is still climbing. Telemetry mapping (P0 card):
//   price/chart/ticker  = kpi.vram (B/L); the overflow phase is the climb
//   lamps + device      = per-engine up/down (amber up, violet down/anomaly)
//   reading             = Strata thinking rate (the unmeasurable meter)
//   stamp ledger        = events (desk to post, level)
//   scan log            = per-request stream (lamp + session + origin/status)
//   queue tin / cistern = queue depth served / vram used-window
//   tallies             = per-engine counts by status, session-fill ranks
//   post log            = events, newest at bottom
//   generator           = host cpu + gpu power; dead bulbs = down engines
//   weather / clause    = decorative (flagged in the report)

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

// ---------------------------------------------------------------------------
// Deterministic helpers
// ---------------------------------------------------------------------------

export function det(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export function hashCode(s) {
  let h = 0
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) | 0
  return Math.abs(h)
}

export function pad(n, w = 2) {
  return String(n).padStart(w, '0')
}

export function grp(n) {
  return Math.round(n).toLocaleString('en-US')
}

// A stable docket number per snapshot (deterministic — the reference's
// "docket" is just the next number on the pad).
export function docketOf(snap) {
  const t = (snap && snap.t != null ? snap.t : 0) | 0
  return String(3900 + (hashCode(String(t)) % 40))
}

// Post clock: the reference's booth clock marches on the feed (tick), so the
// wall time freezes with a held feed and stays still under reduced motion.
const CLOCK_SEED = 9 * 3600 + 52 * 60 // the reference's 09:52
export function clockHm(tick, seed = CLOCK_SEED) {
  const total = Math.max(0, Math.floor(tick || 0)) + seed
  const h = Math.floor(total / 3600) % 24
  const m = Math.floor(total / 60) % 60
  return `${pad(h)}:${pad(m)}`
}

export function clockHms(tick, seed = CLOCK_SEED) {
  const total = Math.max(0, Math.floor(tick || 0)) + seed
  const s = total % 60
  return `${clockHm(tick, seed)}:${pad(s)}`
}

// ---------------------------------------------------------------------------
// The posted price of a litre of water, in buttons (B/L) — kpi.vram, so the
// overflow demo phase is the reference's +56 % climb and recover lets it ease
// back. `open` is the first history sample: the morning's posted rate.
// ---------------------------------------------------------------------------

export function priceStats(snap, gpu) {
  const g = gpu || (snap && snap.gpu) || null
  const k = (snap && snap.kpi) || {}
  const price = k.vram != null ? k.vram : g && g.vram != null ? g.vram : null
  const hist = ((snap && snap.kpiHist && snap.kpiHist.vram) || []).slice()
  const open = hist.length >= 2 ? hist[0] : price
  if (price == null) return { price: null, open: null, delta: null, pct: null, lo: null, hi: null, openHm: null, hist }
  const delta = open != null ? price - open : null
  const pct = open ? (delta / open) * 100 : null
  let lo = Infinity
  let hi = -Infinity
  for (const v of hist) {
    if (v != null) {
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
  }
  if (!isFinite(lo)) lo = price
  if (!isFinite(hi)) hi = price
  const openHm = clockHm((-(hist.length - 1) % 86400 + 86400) % 86400)
  return { price, open, delta, pct, lo, hi, openHm, hist }
}

// The declared tin (2,000 B) as it spends: the queue draining is the tin
// being handed out, so what's left = 2,000 − the recent queue load.
export function tinSpentOf(snap, price) {
  const q = ((snap && snap.kpiHist && snap.kpiHist.queue) || []).slice(-48)
  const spent = q.length ? Math.min(1940, Math.round(q.reduce((a, v) => a + (v || 0), 0) * 2)) : 0
  void price
  return 2000 - spent
}

// ---------------------------------------------------------------------------
// Lamp state: the two-lamp language. Amber = the engine set is up; violet =
// any engine down or the anomaly pressure is high.
// ---------------------------------------------------------------------------

export function engineLamps(snap) {
  const engines = ((snap && snap.engines) || []).filter((e) => e && e.key != null)
  return engines.map((e, i) => ({
    key: e.key,
    label: e.label || e.key,
    up: e.up !== false,
    lamp: e.up !== false ? 'A' : 'V',
    rank: i,
  }))
}

export function assayLamp(snap, alert) {
  const engines = ((snap && snap.engines) || [])
  const anyDown = engines.some((e) => e && e.up === false)
  return anyDown || (alert || 0) > 0.5 ? 'V' : 'A'
}

// The handheld's reading: the Strata thinking rate — the unmeasurable meter.
export function readingOf(conductor, snap) {
  const rs = snap && snap.reasoning
  const base = rs && rs.mtp_accept_pct != null ? rs.mtp_accept_pct / 100 : null
  const r = base != null ? base : clamp(conductor.reason || 0, 0, 1)
  return clamp(r, 0, 1)
}

// Boot ranks (the reference's boot-borne castes) from session KV fill.
export const BOOT_LABELS = ['GREY', 'TAN', 'RED', 'BLACK']

export function sessionRanks(snap) {
  const sessions = ((snap && snap.sessions) || []).filter((s) => s && s.window)
  const ranks = [0, 0, 0, 0]
  for (const s of sessions) {
    const f = clamp((s.used || 0) / s.window, 0, 1)
    ranks[Math.min(3, Math.floor(f * 4))] += 1
  }
  return { ranks, total: sessions.length, flagged: sessions.filter((s) => (s.used || 0) / s.window >= 0.85).length }
}

// ---------------------------------------------------------------------------
// Daily tallies: lamps by engine status, boots by session fill, stoops from
// the request pool, refusals from the deepest sessions.
// ---------------------------------------------------------------------------

export function talliesOf(snap) {
  const lamps = engineLamps(snap)
  const amb = lamps.filter((l) => l.lamp === 'A').length
  const vio = lamps.filter((l) => l.lamp === 'V').length
  const { ranks } = sessionRanks(snap)
  const requests = ((snap && snap.requests) || []).length
  const { flagged } = sessionRanks(snap)
  return {
    amb,
    vio,
    boots: ranks,
    stoops: Math.min(60, requests + flagged * 2),
    refused: Math.min(9, flagged),
    docket: 3900 + (hashCode((snap && snap.kpi && String(snap.kpi.tps)) || 'x') % 40),
  }
}

export function staleOf(snap) {
  const k = (snap && snap.kpi) || {}
  return !snap || snap.mode === 'offline' || snap.mode === 'boot' || (k.tps || 0) === 0
}

// Decode-rate gate 0..1 for booth motion (bulb shimmer, tape run, scan
// walk): 0 when the feed is stale so the booth holds still, otherwise the
// kpi decode rate normalised the way the conductor normalises flow.
export function decode01(snap) {
  if (staleOf(snap)) return 0
  const tps = snap && snap.kpi && snap.kpi.tps != null ? snap.kpi.tps : 0
  return clamp(tps / 280, 0.3, 1)
}

// ---------------------------------------------------------------------------
// STAMP LEDGER rows: the event stream dressed as desk-to-post. Level tints:
// err → violet, warn → amber, ok → plain (the officer's ink).
// ---------------------------------------------------------------------------

export function ledgerRows(snap) {
  const events = ((snap && snap.events) || []).slice(0, 8)
  const rows = []
  events.forEach((e, i) => {
    if (!e) return
    const h = hashCode(e.id || `${e.t}-${e.msg}`)
    const dk = 3908 + (h % 24)
    const lamp = h % 10 < 7 ? 'AMBER' : 'VIOLET'
    const boot = BOOT_LABELS[h % 4]
    const toPost = h % 5 !== 2
    const from = toPost ? 'POST · DESK' : `${dk} ${lamp}·${boot.slice(0, 3)}`
    const to = toPost ? String(dk) : 'POST'
    const n = 1 + (h % 3)
    const level = e.level === 'err' || e.level === 'alert' ? 'V' : e.level === 'warn' ? 'A' : ''
    const note =
      e.level === 'err' || e.level === 'alert'
        ? `HOLD · ${String(e.msg || '').slice(0, 14).toUpperCase()}`
        : `MEETING ${1 + (h % 9)}`
    rows.push({ id: e.id || `led-${i}`, t: e.t, from, to, n, note, level, post: toPost })
  })
  return rows
}

// ---------------------------------------------------------------------------
// PROBE LOG: per-request stream — probe seq, lamp, session, reading,
// origin, status. Deterministic per request id so a held feed prints a
// held table. Freshness is an event-dedupe boundary owned by the plate
// (unseen ids flash once), never the row position.
// ---------------------------------------------------------------------------

export function scanRows(snap, lamp, tick) {
  const requests = ((snap && snap.requests) || []).slice(0, 40)
  const k = (snap && snap.kpi) || {}
  const queued = (k.queue || 0) >= 9
  const rows = []
  requests.forEach((r, i) => {
    if (!r) return
    const h = hashCode(r.id || `req-${i}`)
    const dp = r.decode_tps != null ? r.decode_tps : 100
    const isV = h % 10 >= 7
    const rowLamp = snap && snap.mode === 'boot' ? 'A' : isV ? 'V' : 'A'
    const rd = (0.09 + det(h) * 0.9).toFixed(3)
    const boots = BOOT_LABELS[h % 4]
    let so = rowLamp === 'V' ? 'NONE' : `${1 + (h % 3)} → POST`
    if (rowLamp === 'V' && h % 3 === 0) so = 'ALL ←'
    let sx = 'DONE'
    let sxC = 'ok'
    if (i === 0 && snap && snap.mode !== 'boot') {
      sx = queued ? 'IN QUEUE' : lamp === 'V' ? 'ASSAYING' : 'ASSAYING'
      sxC = lamp === 'V' ? 'inp' : 'inp'
    } else if (rowLamp === 'V') {
      sx = 'IN POST'
      sxC = 'inp'
    } else if (dp < 60) {
      sx = 'REFUSED'
      sxC = 'bad'
    }
    void tick
    rows.push({
      id: r.id,
      dk: 3900 + (h % 40),
      tm: clockHm((r.t ? Math.floor(r.t / 1000) % 86400 : 0), 0),
      lamp: rowLamp,
      boots: boots.charAt(0) === 'G' ? 'b0' : boots.charAt(0) === 'T' ? 'b1' : boots.charAt(0) === 'R' ? 'b2' : 'b3',
      rd,
      so,
      sx,
      sxC,
      hot: rowLamp === 'V' && h % 4 === 0,
    })
  })
  return rows
}

// ---------------------------------------------------------------------------
// POST LOG: the teletype, newest at the bottom. Tag from the message shape.
// ---------------------------------------------------------------------------

export function postLog(snap) {
  const events = ((snap && snap.events) || []).slice(0, 26)
  return events
    .filter((e) => e)
    .map((e, i) => {
      const m = String(e.msg || '')
      const tag = /phase|overflow|recover/i.test(m)
        ? 'RATE'
        : /vram|power|temp|kv|slot|cohort|cache|reingest/i.test(m)
          ? 'GEN'
          : /queue|p95|decode/i.test(m)
            ? 'ASSAY'
            : /runner|shift|open|close/i.test(m)
              ? 'POST'
              : 'WX'
      const cls = e.level === 'err' || e.level === 'alert' ? 'v' : e.level === 'warn' ? 'a' : e.level === 'ok' ? '' : 'w'
      return { id: e.id || `log-${i}`, t: clockHm(Math.floor((e.t || 0) / 1000) % 86400, 0), tag, tx: m.toUpperCase().slice(0, 64), cls }
    })
    .reverse() // newest at the bottom
}

// ---------------------------------------------------------------------------
// GENERATOR: load from host cpu + gpu power on the 3 kW GEN-1 rating; dead
// sockets are the down engines (offline: all dark).
// ---------------------------------------------------------------------------

export function genStats(snap, gpu, host) {
  const g = gpu || null
  const h = host || (snap && snap.host) || null
  const k = (snap && snap.kpi) || {}
  const power = g && g.power != null ? g.power : null
  const cpu = h && h.cpu != null ? h.cpu / 100 : null
  const load = clamp(
    (cpu != null ? cpu * 0.55 : 0.3) + (power != null ? (power / 450) * 0.45 : 0.25),
    0,
    1,
  )
  const kw = load * 3
  const dead = []
  if (snap && snap.mode === 'offline') {
    for (let i = 0; i < 14; i++) dead.push(i)
  } else {
    const engines = ((snap && snap.engines) || [])
    engines.forEach((e, i) => {
      if (e && e.up === false) dead.push(i % 14)
    })
  }
  const lit = 14 - new Set(dead).size
  const volt = Math.round(230 - 6 * (kw / 3) - load * 8)
  const hz = (50 - load * 0.4 - (cpu || 0) * 0.1).toFixed(2)
  const fuel = (24 * (1 - load * 0.62)).toFixed(1)
  const fuelPct = Math.round(100 - load * 62)
  const uptimeH = h && h.uptime != null ? Math.floor(h.uptime / 3600) : null
  return { load, kw: kw.toFixed(2), pct: Math.round(load * 100), dead, lit, volt, hz, fuel, fuelPct, uptimeH, queue: k.queue != null ? Math.round(k.queue) : null }
}

// Bulb x fractions (of the rail width) for the screen-blended light pool.
export function bulbFracs(litMask) {
  const out = []
  for (let i = 0; i < 14; i++) {
    if (litMask && !litMask(i)) continue
    out.push(13 + ((i + 0.5) / 14) * 74)
  }
  return out
}

// ---------------------------------------------------------------------------
// THE EXCHANGE boards: QUEUE SERVED (the declared 2,000-cell tin, spent as
// the queue deepens), STRONGBOX (the post's box of serve cells, worth less
// water each re-post) and CISTER (the water stock: vram used-window, sold
// at the posted price).
// ---------------------------------------------------------------------------

export function tinStats(snap, price) {
  const q = ((snap && snap.kpiHist && snap.kpiHist.queue) || []).slice(-48)
  const spent = q.length ? Math.min(1940, Math.round(q.reduce((a, v) => a + (v || 0), 0) * 2)) : 0
  const tin = 2000 - spent
  const p = price != null && price > 0 ? price : 14.2
  return { tin, spent, litres: (tin / p).toFixed(1) }
}

export function boxStats(snap, price, gpu) {
  const g = gpu || (snap && snap.gpu) || null
  const v = g && g.vram != null ? g.vram : 12
  const total = g && g.vramTotal != null ? g.vramTotal : 24
  const box = Math.round(600 + (1 - clamp(v / total, 0, 1)) * 900)
  const p = price != null && price > 0 ? price : 14.2
  return { box, litres: (box / p).toFixed(1), tariff: (40 / p).toFixed(2) }
}

export function cisternStats(snap, price, gpu) {
  const g = gpu || (snap && snap.gpu) || null
  const v = g && g.vram != null ? g.vram : 12
  const total = g && g.vramTotal != null ? g.vramTotal : 24
  const level = clamp(v / total, 0, 1)
  const litres = Math.round(level * 4000)
  const p = price != null && price > 0 ? price : 14.2
  const worth = Math.round(litres * p)
  const sold = Math.round(level * 300)
  return { level, litres, cap: 4000, worth, sold, soldB: Math.round(sold * p) }
}

// ---------------------------------------------------------------------------
// ACTIVE screen line: the loaded model this booth is assaying, plus the
// live tok/s + temp + queue/p95 figures. ACTIVE = kpi.tps_models[0], else
// the first up engine label, else models[0].id. Pure function of snap.
// ---------------------------------------------------------------------------

export function activeModelOf(snap) {
  const k = (snap && snap.kpi) || {}
  const fromTps = Array.isArray(k.tps_models) && k.tps_models.length ? String(k.tps_models[0]) : null
  const engines = ((snap && snap.engines) || []).filter((e) => e && e.key != null)
  const up = engines.find((e) => e.up !== false)
  const fromEng = up ? String(up.label || up.key) : null
  const models = (snap && snap.models) || []
  const fromModels = models.length ? String(models[0].id || models[0]) : null
  const g = (snap && snap.gpu) || null
  const upCount = engines.filter((e) => e.up !== false).length
  return {
    model: fromTps || fromEng || fromModels,
    tps: k.tps != null ? k.tps : null,
    temp: g && g.temp != null ? g.temp : null,
    queue: k.queue != null ? k.queue : null,
    p95: k.p95 != null ? k.p95 : null,
    engine: fromEng || (engines.length ? `${upCount}/${engines.length}` : null),
  }
}

// ---------------------------------------------------------------------------
// WEATHER: decorative (flagged in the report). Wind/cinders/visibility ride
// the conductor scalars; the pass clock is the reference's own story.
// ---------------------------------------------------------------------------

export function weatherOf(conductor, snap) {
  const t = conductor.t || 0
  const heat = clamp(conductor.heat || 0, 0, 1)
  const flow = clamp(conductor.flow || 0, 0, 1)
  const g1 = Math.sin(2 * Math.PI * 0.13 * t) * 0.85
  const g2 = Math.sin(2 * Math.PI * 0.31 * t + 1.2) * 0.5
  const g3 = Math.sin(2 * Math.PI * 0.57 * t + 2.7) * 0.3
  const wind = 12.5 + heat * 6 + (g1 + g2 + g3) * (conductor.reduced ? 0 : 1)
  const dir = Math.round(((287 + heat * 24 + (Math.sin(2 * Math.PI * 0.11 * t + 0.4) + Math.sin(2 * Math.PI * 0.27 * t)) * 6 * (conductor.reduced ? 0 : 1)) % 360 + 360) % 360)
  const cinders = Math.max(0.4, 1.6 + flow * 2.2)
  const vis = clamp(1.4 - 0.46 * (cinders - 2.0), 0.5, 2.4)
  const air = -3.4 + heat * 5.2
  const press = 781.2 - 0.32 * ((t / 3600) % 24) + 0.08 * Math.sin(2 * Math.PI * (t / 3600) / 0.86)
  const k = (snap && snap.kpi) || {}
  return { wind: wind.toFixed(1), dir, cinders: cinders.toFixed(1), vis: vis.toFixed(1), air: `${air < 0 ? '−' : ''}${Math.abs(air).toFixed(1)} °C`, hpa: press.toFixed(1), road: vis < 1.0 ? 'ROAD OPEN · LOW VIS' : 'ROAD OPEN', queue: k.queue != null ? Math.round(k.queue) : 0 }
}

// ---------------------------------------------------------------------------
// MANUAL CLAUSE: narrative lore (decorative, flagged). The index lights on
// anomaly pressure; the clause lines are the reference's manual text.
// ---------------------------------------------------------------------------

export const CLAUSE = {
  ref: 'MANUAL OF THE POST · PART IV · CL. 14(3)',
  q: 'A TRAVELLER WHOSE LAMP COMES UP VIOLET AND WHOSE BOOTS ARE GREY IS STOOPED TO BY EVERYONE, AT EACH MEETING. THE POST IS NOT EXCEPTED.',
  q1: '14(1) · AN AMBER STOOPS TO THE POST ONCE, AND ONCE MORE FOR EACH RANK OF BOOT.',
  q2: '14(4) · A STOOP NOT PERFORMED IS A REFUSAL. A REFUSAL IS TURNED BACK.',
  index: [
    ['BUTTONS', 'NO ENTRY'],
    ['TINS', 'NO ENTRY'],
    ['PRICE, CLIMBING', 'NO ENTRY'],
    ['ASSAY DEVICE', 'NO MANUAL'],
  ],
}

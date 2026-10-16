// Bloom-Line shared chrome: the greenhouse's own derives. The deterministic
// helpers and the active-runtime figure are shared console-wide and live in
// lib/derive; this module re-exports the ones this scene's components import
// and keeps only the tank, drone, manifest and archive bindings. The scene
// never owns a timer; transient row flashes restart a finite CSS animation by
// re-keying the element.

import { activeRuntime, clamp, det, hashCode, hexFrom, pad, staleOf } from '../../lib/derive'

export { det, hashCode, hexFrom, pad, staleOf }

export const activeOf = activeRuntime

// Master clock in display seconds (conductor.t is seconds, frozen under
// reduced motion / held feed — a valid static value either way).
export function fmtClock(sec, seed = 0) {
  const total = Math.max(0, Math.floor(sec)) + seed
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600) % 24
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

// ---------------------------------------------------------------------------
// Fixed reference lore, bound to real telemetry where the card maps one.
// ---------------------------------------------------------------------------

// 47 species ticks along the top strip. Index 22 (P23) is the bloom; the
// harvest states follow the reference.
export const SPECIES = Array.from({ length: 47 }, (_, i) => {
  const n = i + 1
  return { id: `P${pad(n)}`, harvest: [3, 11, 28, 36, 41].includes(n), bloom: n === 23 }
})

// 12 tank zone labels: the reference's plant codes per zone (Z-06/P23 is the
// bloom tank, matching the species strip).
export const TANK_CODES = ['P07', '—', 'P14', '—', '—', 'P23', 'P28', '—', 'P36', 'P41', '—', 'P47']

// 28 pollinator drones; the reference names them.
export const DRONE_NAMES = [
  'Honey', 'Hopper', 'Curious', 'Patient', 'Bumble', 'Loops', 'Sunny', 'Spiral', 'Dewey', 'Petal',
  'Whirl', 'Spry', 'Mooch', 'Tinker', 'Wisp', 'Dart', 'Bramble', 'Shimmer', 'Flutter', 'Gust',
  'Spark', 'Plum', 'Twirl', 'Quill', 'Echo', 'Marbles', 'Fizz', 'Lark',
]

// 12-bay germline archive seed: dim/warm/hot pattern of the reference strip.
export const ARCHIVE_SEED = [0, 1, 0, 2, 0, 0, 3, 0, 1, 3, 0, 0, 3, 0, 0, 0, 3, 1, 0, 0, 3, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 1]

// Callout anchors: [anchorX, anchorY, labelX, labelY, side] in the reference
// leader-svg viewBox (1244 x 834), converted to percentages here so the same
// composition scales to any stage size.
const VBX = 1244
const VBY = 834
const pct = (x, y) => ({ x: (x / VBX) * 100, y: (y / VBY) * 100 })

// One entry per leader-line callout (18). `side` is the label anchor side.
export const CALLOUTS = [
  { a: pct(740.9, 623.0), l: pct(324.3, 751.5), side: 'left', cyr: 'ДЫНЯ ТАШКЕНТ', lat: 'P23 · TASHKENT MELON 2178', bind: 'bloom' },
  { a: pct(622.0, 179.1), l: pct(324.3, 30.7), side: 'left', cyr: 'ТОМАТ', lat: 'SAN MARZANO · P07', bind: 'harv' },
  { a: pct(828.0, 298.1), l: pct(324.3, 223.9), side: 'left', cyr: 'САЛАТ', lat: 'SPOTTED TROUT · P14', bind: 'nom' },
  { a: pct(622.0, 654.9), l: pct(919.7, 786.0), side: 'right', cyr: 'КЛУБНИКА', lat: 'MARA DES BOIS · P28', bind: 'nom' },
  { a: pct(416.0, 535.9), l: pct(919.7, 610.1), side: 'right', cyr: 'БАЗИЛИК', lat: 'GENOVESE DOP · P36', bind: 'warn' },
  { a: pct(384.1, 417.0), l: pct(919.7, 417.0), side: 'right', cyr: 'ЦВЕТЫ', lat: 'NASTURTIUM · P41', bind: 'nom' },
  { a: pct(503.1, 211.0), l: pct(919.7, 82.5), side: 'right', cyr: 'ПШЕНИЦА', lat: 'KHORASAN · P47', bind: 'nom' },
  { a: pct(441.7, 351.4), l: pct(239.0, 284.9), side: 'left', cyr: 'ГИДРОПОН.', lat: 'HYDROPONIC LOOP', bind: 'hydro' },
  { a: pct(475.1, 293.7), l: pct(306.1, 168.7), side: 'left', cyr: 'pH-БАЛАНС', lat: 'pH AVG', bind: 'ph' },
  { a: pct(622.0, 117.8), l: pct(324.3, 60.7), side: 'left', cyr: 'ЗЕРКАЛО', lat: 'MIRROR ARRAY', bind: 'nom' },
  { a: pct(768.9, 293.7), l: pct(937.9, 168.7), side: 'right', cyr: 'CO₂ АТМ.', lat: 'CO₂ ATMOSPHERE', bind: 'co2' },
  { a: pct(802.3, 351.4), l: pct(1005.0, 284.9), side: 'right', cyr: 'КИСЛОРОД', lat: 'O₂ ATMOSPHERE', bind: 'o2' },
  { a: pct(622.0, 716.2), l: pct(919.7, 786.0), side: 'right', cyr: 'РОЙ · 28', lat: 'DRONE BAY · 28/28', bind: 'drones' },
  { a: pct(903.2, 519.3), l: pct(1005.0, 549.1), side: 'right', cyr: 'ОБИТ. БЛОК', lat: 'HABITAT · YUMI', bind: 'hab' },
  { a: pct(322.8, 417.0), l: pct(215.7, 417.0), side: 'left', cyr: 'L2 ↔ ЗЕМЛЯ', lat: 'COMM · LAGOS RELAY', bind: 'comm' },
  { a: pct(441.7, 482.6), l: pct(239.0, 549.1), side: 'left', cyr: 'ФОНД · X-H', lat: 'FOUND. XENO-HERIT.', bind: 'nom' },
  { a: pct(368.6, 265.0), l: pct(239.0, 150.0), side: 'left', cyr: 'СВЕЧЕНИЕ', lat: 'GROW-LIGHT ARRAY', bind: 'nom' },
  { a: pct(875.4, 569.0), l: pct(1005.0, 675.0), side: 'right', cyr: 'ВОДА · ЦИКЛ', lat: 'WATER LOOP · NUTRIENT', bind: 'water' },
]

// ---------------------------------------------------------------------------
// Telemetry-derived region values. Every function takes the latest snap and
// returns display strings/states; nulls mean "no source" and the caller
// ghosts the region.
// ---------------------------------------------------------------------------

// 12 bioreactor tank zones: per-engine KV fill (the card's best-fit source;
// a missing engine reuses the previous zone so the ring never has holes).
export function tankZones(snap) {
  const engines = (snap && snap.engines) || []
  const zones = []
  for (let i = 0; i < 12; i++) {
    const e = engines.length ? engines[i % engines.length] : null
    const sess = (e && e.sessions) || []
    let used = 0
    let win = 0
    for (const s of sess) {
      used += s.used || 0
      win += s.window || 0
    }
    const fill = win > 0 ? clamp(used / win, 0, 1) : e ? (e.up === false ? 0 : 0.4) : 0
    const up = e ? e.up !== false : false
    const seed = `${e ? e.key : 'z'}-${i}`
    zones.push({
      id: `Z-${pad(i + 1)}`,
      code: TANK_CODES[i],
      fill,
      state: fill >= 0.85 ? 'bloom' : fill >= 0.6 ? 'warn' : '',
      up,
      // stable per-zone wobble so the bar is not a flat line (deterministic)
      wobble: 0.94 + det(hashCode(seed)) * 0.08,
    })
  }
  return zones
}

// 28 drone dock cells from the flat session pool; flagged = anomalous
// sessions (KV fill past the alert line).
export function droneCells(snap) {
  const sessions = (snap && snap.sessions) || []
  const cells = []
  for (let i = 0; i < 28; i++) {
    const s = sessions.length ? sessions[i % sessions.length] : null
    const fill = s && s.window ? clamp((s.used || 0) / s.window, 0, 1) : 0
    cells.push({
      id: `BEE-${pad(i + 1)}`,
      name: DRONE_NAMES[i],
      flagged: fill >= 0.85,
      up: s ? true : i < ((snap && snap.engines) || []).filter((e) => e && e.up).length * 3,
    })
  }
  return cells
}

// Right-rail telemetry list: 18 rows, the KPI table padded with greenhouse
// lore rows. Each row: [cyr, lat, value, state, flashKey].
export function telemRows(snap, heat, alert, flow) {
  const k = (snap && snap.kpi) || {}
  const gpu = (snap && snap.gpu) || null
  const host = (snap && snap.host) || null
  const sessions = (snap && snap.sessions) || []
  const engines = (snap && snap.engines) || []
  const flagged = sessions.filter((s) => s.window && (s.used || 0) / s.window >= 0.85).length
  const upEng = engines.filter((e) => e && e.up).length
  const bloom = alert > 0.25
  const f = (v, d = 1) => (v == null || !isFinite(v) ? null : v.toFixed(d))
  const rows = [
    ['УТРО · ДЕНЬ', 'cycle day', `${snap ? `${growDay(snap)} / 240` : '— / 240'}`, ''],
    ['ВРАЩЕНИЕ', 'rotation', `1.6 rpm · ${f(1.6 + flow * 0.1, 1)}°`],
    ['ТЕМП. ВНУТР.', 'interior °C', gpu ? `${f(20 + heat * 6, 1)}°C` : '—', gpu ? '' : 'ghost'],
    ['CO₂ АТМ.', 'CO₂', heat > 0.55 ? `${Math.round(700 + heat * 40)} ppm · BOOST` : `${Math.round(700 + heat * 40)} ppm`, heat > 0.55 ? 'warn' : ''],
    ['O₂ АТМ.', 'O₂', `${f(20.9 - heat * 0.4, 2)} %`],
    ['pH СРЕД.', 'pH avg', f(6.2 + det(hashCode((snap && snap.kpi && snap.kpi.tps) || 0)) * 0.1, 2)],
    ['ВЛАЖНОСТЬ', 'soil moist.', host ? `${Math.round(40 + host.cpu * 0.2)} %` : '—'],
    ['СВЕТ · ФОТО', 'photoperiod', '14h 00m · ON'],
    ['P23 · ТАШКЕНТ', 'P23 bloom', '★ FLAGGED', bloom ? 'bloom' : ''],
    ['P07 · САН-МАРЦ.', 'P07 tomato', 'HARV. 4d', ''],
    ['P28 · MARA DES B', 'P28 berry', 'FRUITING', ''],
    ['P36 · БАЗИЛИК', 'P36 basil', 'HARV. 2d', 'warn'],
    ['P47 · ХОРАСАН', 'P47 wheat', `CYC. ${30 + Math.floor(det(hashCode((k.tps || 0).toString())))}`, ''],
    ['РОЙ · ДОК', 'drones dock', `${Math.min(28, sessions.length || 0)} / 28`],
    ['РОЙ · ЗАВТ.', 'drones flag', flagged ? `${flagged} → P23` : '0 → P23', flagged ? 'bloom' : ''],
    ['СВЯЗЬ ЗЕМЛЯ', 'earth comm', (snap && snap.mode === 'offline') ? 'NO LINK' : 'OPEN · 5.0s', snap && snap.mode === 'offline' ? 'warn' : ''],
    ['ОПЫЛЕН. ЦИКЛ', 'pollination', flow > 0.5 ? '09:14 → P23 · 3 BEES' : 'IDLE', flow > 0.5 ? 'bloom' : ''],
    ['СБОР · ETA', 'harvest ETA', heat > 0.5 ? 'P36 · 1d 04h' : 'P36 · 2d 04h', heat > 0.5 ? 'warn' : ''],
  ]
  // keep the row shape [cyr, lat, val, state]
  return rows.map(([cyr, lat, val, state]) => ({ cyr, lat, val: val == null ? '—' : val, state: state || '' }))
}

// Grow-day: the reference ticks it once per 90 s; we advance it at feed rate
// (tick/90), which is the same cadence in live and demo.
export function growDay(snap) {
  const t = (snap && snap.t != null ? snap.t : 0) || 0
  return (187 + Math.floor(t / 90)) % 240
}

// Left-rail ENV/ATMOS/ROT readouts: the card flags these "best-fit proxies,
// no 1:1 data" — derived from host/gpu/kpi so they move with the feed.
export function envRows(snap) {
  const host = (snap && snap.host) || null
  const gpu = (snap && snap.gpu) || null
  const k = (snap && snap.kpi) || {}
  const heat = gpu && gpu.vramTotal ? clamp(gpu.vram / gpu.vramTotal, 0, 1) : 0.3
  const co2 = Math.round(700 + heat * 40)
  const env = [
    ['ВЛАЖН.', 'humidity', host ? `${Math.round(52 + host.cpu * 0.3)}%` : '—%'],
    ['CO₂', 'atm CO₂', `${co2} ppm`],
    ['АЭРАЦИЯ', 'aeration', `${(1.2 + (k.tps || 0) / 1000).toFixed(1)} m³/h`],
    ['NPK', 'nutrient', `${Math.round(144 + heat * 20)}/${Math.round(37 + heat * 8)}/${Math.round(188 - heat * 10)}`],
  ]
  const atm = [
    ['O₂', 0.78, `${Math.round(200 + heat * 30)} mL/L`, false],
    ['CO₂', 0.62, `${co2} ppm`, heat > 0.55],
    ['N₂', 0.92, `${Math.round(740 + heat * 40)} mL/L`, false],
  ]
  const rpm = 1.6 + (k.tps || 0) / 3000
  const rot = [
    ['RPM', 'spin', rpm.toFixed(2)],
    ['g', 'sustained', (rpm * rpm * 0.158).toFixed(2)],
    ['РЕЦИРК', 'recirc', `${(92 + heat * 6).toFixed(1)}%`],
    ['pH', 'reservoir', (6.18 + det(hashCode(String(Math.round((k.tps || 0) / 5)))) * 0.05).toFixed(2)],
  ]
  const offline = !host && !gpu
  return { env, atm, rot, offline }
}

// SHIP manifest: the four newest queued requests; dest = model, mass = the
// request's share of the queue (output tokens), eta = a pseudo-date hashed
// from the id so the table is stable per request.
export function shipManifest(snap) {
  const reqs = (snap && snap.requests) || []
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const rows = []
  for (let i = 0; i < 4; i++) {
    const r = reqs[i]
    if (!r) break
    const h = hashCode(r.id || `req-${i}`)
    const dest = String(r.model || r.id || '—').toUpperCase().slice(0, 16)
    const kg = (1 + ((r.output || 0) % 38) / 4 + (h % 10) / 10).toFixed(1)
    rows.push({
      id: r.id,
      dest: r.model ? `M${dest.slice(0, 12)}` : 'OUTPOST',
      eta: `${months[h % 12]} ${pad(3 + (h >> 3) % 27)}`,
      kg: `${kg} kg`,
    })
  }
  return rows
}

// GERM bank: six strain chips from the model list (star = the bloom strain).
export function germChips(snap) {
  const models = ((snap && snap.models) || []).slice(0, 6)
  const engines = (snap && snap.engines) || []
  const names = models.length
    ? models
    : engines.length
      ? engines.slice(0, 6).map((e) => e.label || e.key)
      : []
  const chips = names.map((m) => String(m).toUpperCase().slice(0, 12))
  while (chips.length < 6) chips.push(`STRAIN-${pad(chips.length + 1, 2)}`)
  return chips.slice(0, 6)
}

// RING gauge: colony-ship readiness from the gpu proxy (the card flags this
// as a proxy): the higher the thermal/VRAM headroom, the closer to ready.
export function ringStats(snap, heat) {
  const k = (snap && snap.kpi) || {}
  const pct = Math.round(clamp(64 + (0.5 - heat) * 30, 30, 96))
  return {
    pct,
    rows: [
      ['CARGO', k.queue != null ? `${(k.queue * 0.32).toFixed(1)} / 6.6 t` : '— / 6.6 t'],
      ['STRAINS', '38 / 47'],
      ['LAUNCH', '2218-04'],
      ['D-LEFT', '2 yr · 11 mo'],
    ],
  }
}

// ARCHIVE heat strip: the host cpu history resampled to 47 cells (hot > 70,
// warm > 40, dim otherwise); falls back to the deterministic seed pattern
// when the collector reports no host data.
export function archiveCells(snap) {
  const hist = ((snap && snap.hostHist && snap.hostHist.cpu) || []).filter((v) => v != null)
  if (hist.length >= 8) {
    const cells = []
    for (let i = 0; i < 47; i++) {
      const v = hist[Math.floor((i / 47) * (hist.length - 1)) || 0]
      cells.push(v > 70 ? 'hot' : v > 40 ? 'warm' : 'dim')
    }
    return cells
  }
  return ARCHIVE_SEED.map((v) => (v === 2 ? 'hot' : v === 1 ? 'warm' : 'dim'))
}

// The newest actionable alert as an incoming call (the card's closest
// conductor analog). null = no alert, popup stays hidden.
export function callOf(snap) {
  const alerts = (snap && snap.alerts) || []
  const events = (snap && snap.events) || []
  let key = null
  let label = null
  for (let i = 0; i < alerts.length; i++) {
    if (alerts[i]) {
      key = `alert-${alerts[i]}`
      label = alerts[i]
    }
  }
  if (!key) {
    for (let i = 0; i < events.length; i++) {
      const e = events[i]
      if (e && (e.level === 'err' || e.level === 'alert' || e.level === 'warn')) {
        key = `ev-${e.id ?? i}`
        label = String(e.msg || '')
        break
      }
    }
  }
  if (!key) return null
  const h = hashCode(key)
  const first = ['MAYA', 'YUMI', 'ADELE', 'NADIA', 'ZORA']
  const last = ['OLATUNDE-PARK', 'ADEYEMI-PARK', 'KONSTANTINOU', 'VELIKAYA', 'SINGH']
  return {
    key,
    name: `${first[h % first.length]} ${last[(h >> 4) % last.length]}`,
    loc: `LAGOS · ${fmtClock(22 * 3600 + 14 * 60 + (h % 60), 0)} LOCAL · 5.0s LAT`,
    msg: String(label || '').slice(0, 60),
  }
}

// Collector wire format -> console state contract.
//
// The two functions here mirror applySnapshot/applyTick in the retired
// static UI: snapshot() rebuilds the state wholesale, tick() patches it.
// Every external value is parsed defensively at this boundary (NaN -> null),
// so the views can trust the state shape defined by simulator.js.
//
// Pure: no React, no fetch, no timers. The only mutable input is the
// dedupe bookkeeping handle from createDedupe(), which lives outside the
// state contract.

import { KPI_KEYS } from './format'

export const HIST_CAP = 3600
const REQUEST_CAP = 200
const EVENT_CAP = 100
const EVENT_SEEN_CAP = 1000

// One set of dedupe bookkeeping per feed source: request ids and event
// signatures already shipped, so a retried snapshot or an overlapping poll
// cannot append the same record twice.
export function createDedupe() {
  return { requests: new Set(), events: new Set() }
}

// The state the console renders before the first snapshot lands.
export function emptyState() {
  return {
    mode: 'boot',
    feed: '—',
    t: 0,
    gpu: null,
    host: null,
    kpi: {},
    kpiHist: Object.fromEntries(KPI_KEYS.map((k) => [k, []])),
    engHist: {},
    hostHist: { cpu: [], ram: [] },
    engines: [],
    sessions: [],
    strata: { up: null, models: [] },
    models: [],
    alerts: [],
    events: [],
    requests: [],
    reasoning: null,
  }
}

function num(v) {
  if (v == null) return null
  const x = parseFloat(v)
  return Number.isFinite(x) ? x : null
}

// nvidia-smi field names -> state fields; unparseable reads become null so
// a dead probe shows a dash, never a bogus zero.
function normGpu(g) {
  if (!g || typeof g !== 'object') return null
  return {
    name: g.name || '—',
    temp: num(g['temperature.gpu']),
    util: num(g['utilization.gpu']),
    power: num(g['power.draw']),
    vram: num(g['memory.used_gb']),
    vramTotal: num(g['memory.total_gb']),
  }
}

function normHost(h) {
  if (!h || typeof h !== 'object') return null
  return {
    cpu: num(h.cpu_total_pct),
    ramUsed: num(h.ram_used_gb),
    ramTotal: num(h.ram_total_gb),
    uptime: num(h.uptime_s),
  }
}

function pushHist(arr, v) {
  if (!Array.isArray(arr)) return
  arr.push(v == null || !Number.isFinite(v) ? 0 : v)
  if (arr.length > HIST_CAP) arr.splice(0, arr.length - HIST_CAP)
}

function pushRequest(list, dedupe, r) {
  if (!r || typeof r !== 'object') return
  if (r.id != null && dedupe.requests.has(r.id)) return
  if (r.id != null) dedupe.requests.add(r.id)
  list.unshift(r)
  if (list.length > REQUEST_CAP) list.length = REQUEST_CAP
}

function pushEvent(list, dedupe, ev) {
  if (!ev || typeof ev !== 'object') return
  const k = `${ev.t ?? 0}|${ev.level ?? ''}|${ev.msg ?? ''}`
  if (dedupe.events.has(k)) return
  dedupe.events.add(k)
  // the seen set is unbounded otherwise: evict oldest once it overflows
  if (dedupe.events.size > EVENT_SEEN_CAP) dedupe.events.delete(dedupe.events.values().next().value)
  list.unshift(ev)
  if (list.length > EVENT_CAP) list.length = EVENT_CAP
}

// Flat session list the cohort grid draws: one entry per session of every
// engine that is up (Strata always, it reports slots even when down).
function deriveSessions(engines) {
  const out = []
  for (const e of engines || []) {
    if (!e || (!e.up && e.key !== 'strata')) continue
    for (const s of e.sessions || []) {
      if (!s || typeof s !== 'object') continue
      out.push({
        id: `${s.id ?? ''}${s.session ? `-${s.session}` : ''}`,
        engine: e.label || e.key,
        window: s.window || e.window,
        used: s.used,
        cached: s.cached,
      })
    }
  }
  return out
}

function engineValues(snap) {
  const engines = Object.values((snap && snap.engines) || {})
  return engines.filter((e) => e && typeof e === 'object' && e.key)
}

// Full snapshot: rebuilds everything from the wire document.
export function snapshotToState(prev, snap, dedupe) {
  const s = snap && typeof snap === 'object' ? snap : {}
  const kpiHist = {}
  for (const k of KPI_KEYS) {
    kpiHist[k] = [...((((s.kpi || {}).hist || {})[k]) || [])]
  }
  const engines = engineValues(s)
  const engHist = {}
  for (const e of engines) engHist[e.key] = [...(e.hist || [])]

  const next = {
    ...prev,
    t: num(s.t) ?? prev.t,
    gpu: normGpu(s.gpu && s.gpu.last),
    host: normHost(s.host),
    kpi: { ...((s.kpi || {}).last || {}) },
    kpiHist,
    engines,
    engHist,
    hostHist: {
      cpu: [...((s.host && s.host.hist && s.host.hist.cpu) || [])],
      ram: [...((s.host && s.host.hist && s.host.hist.ram_gb) || [])],
    },
    strata: s.strata || { up: null, models: [] },
    models: s.models || [],
    alerts: s.alerts || [],
    requests: [],
    events: [],
    sessions: [],
    reasoning: s.reasoning || null,
    mode: 'live',
    feed: 'snap',
  }
  for (const r of s.requests || []) pushRequest(next.requests, dedupe, r)
  for (const ev of (s.events || []).slice(0, EVENT_CAP)) pushEvent(next.events, dedupe, ev)
  next.sessions = deriveSessions(next.engines)
  return next
}

// 1 Hz tick: patch the current state in place of a new fetch.
export function tickToState(prev, tick, dedupe) {
  const d = tick && typeof tick === 'object' ? tick : {}
  const next = {
    ...prev,
    t: num(d.t) ?? prev.t,
    kpi: { ...prev.kpi },
    kpiHist: {},
    engHist: { ...prev.engHist },
    hostHist: { ...prev.hostHist },
    engines: (prev.engines || []).map((e) => ({ ...e })),
    strata: { ...(prev.strata || { up: null, models: [] }) },
    alerts: d.alerts != null ? d.alerts : prev.alerts,
    requests: [...(prev.requests || [])],
    events: [...(prev.events || [])],
    reasoning: d.reasoning || prev.reasoning,
  }
  if (d.gpu !== undefined) next.gpu = normGpu(d.gpu)
  if (d.host !== undefined) {
    next.host = normHost(d.host)
    if (next.host) {
      pushHist(next.hostHist.cpu, next.host.cpu)
      pushHist(next.hostHist.ram, next.host.ramUsed)
    }
  }
  for (const k of KPI_KEYS) {
    const v = d.kpi ? d.kpi[k] : prev.kpi[k]
    next.kpi[k] = v
    const hist = [...(prev.kpiHist[k] || [])]
    pushHist(hist, d.kpi ? d.kpi[k] : null)
    next.kpiHist[k] = hist
  }
  if (d.kpi && d.kpi.tps_models != null) next.kpi.tps_models = d.kpi.tps_models
  next.strata.up = d.strata_up != null ? d.strata_up : next.strata.up

  if (d.engines) {
    for (const [key, te] of Object.entries(d.engines)) {
      if (!te || typeof te !== 'object') continue
      let e = next.engines.find((x) => x.key === key)
      if (!e) {
        e = { key, label: te.label || key, origin: te.origin || key, sessions: [] }
        next.engines.push(e)
        next.engHist[key] = []
      }
      e.up = te.up ?? e.up
      e.queue = te.queue ?? e.queue
      e.rates = te.rates ?? e.rates
      e.mtp = te.mtp ?? e.mtp
      if (te.active !== undefined) e.active = te.active
      if (te.sessions) e.sessions = te.sessions
      if (te.rate != null) pushHist(next.engHist[key], te.rate)
    }
  }
  for (const r of d.new_requests || []) pushRequest(next.requests, dedupe, r)
  for (const ev of d.new_events || []) pushEvent(next.events, dedupe, ev)

  if (prev.mode === 'offline') next.mode = 'live'
  next.feed = 'sse'
  next.sessions = deriveSessions(next.engines)
  return next
}

// Token Foundry shared derives: the telemetry binding layer between the
// plates and the feed. Every readout a plate prints is a pure function of
// the latest snap and the conductor's smoothed scalars. The deterministic
// helpers and the active-runtime figure are shared console-wide and live in
// lib/derive; this module re-exports the ones the plates import. The scene
// never owns a timer; transient row flashes restart a finite CSS animation
// by re-keying the element.
//
// Telemetry mapping:
//   queue rail lamps   = kpi.queue (one lamp per slot, engine up/down tint)
//   request inspector  = the newest request record + kpi.ttft / kpi.p95 /
//                        the engine set (the lock-on lock)
//   request ledger     = snap.requests: id hash, model, tokens in/out, tok/s
//   throughput forge   = kpiHist.tps with the kpiHist.p95 band and the
//                        kpiHist.queue underlay; burst markers from kpiHist.rpm
//   served tokens      = the integral of kpiHist.tps over the covered window
//   queue board        = kpiHist.queue step chart
//   vram pool          = kpi.vram / gpu.vramTotal, cost per active session
//   model tally        = snap.requests grouped by model + kpi.rpm
//   gpu draw           = gpu.power / gpu.util / gpu.temp
//   sampler            = kpi.mtp / kpi.tpot / kpi.cache / kpi.reingest
//   pressure ladder    = vram 75/90% lines, power 85%, queue depth, hot KV

import { activeRuntime, clamp, det, hashCode, hexFrom, pad, staleOf } from '../../lib/derive'

export { det, hashCode, pad, staleOf, hexFrom }

export const activeModelOf = activeRuntime

export function grp(n) {
  return Math.round(n).toLocaleString('en-US')
}

// ---------------------------------------------------------------------------
// Feed clock: hours:minutes(:seconds) that march on the feed tick, so wall
// time freezes with a held feed and stays still under reduced motion.
// ---------------------------------------------------------------------------

const CLOCK_SEED = 9 * 3600 + 52 * 60
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
// VRAM COST (kpi.vram): the memory a request occupies while it runs. `open`
// is the first history sample, so delta reads the run so far. The figure is
// GB and % of the pool; no currency anywhere on this scene.
// ---------------------------------------------------------------------------

export function vramStats(snap, gpu) {
  const g = gpu || (snap && snap.gpu) || null
  const k = (snap && snap.kpi) || {}
  const gb = k.vram != null ? k.vram : g && g.vram != null ? g.vram : null
  const total = g && g.vramTotal != null ? g.vramTotal : null
  const hist = ((snap && snap.kpiHist && snap.kpiHist.vram) || []).slice()
  const open = hist.length >= 2 ? hist[0] : gb
  const delta = gb != null && open != null ? gb - open : null
  const pct = gb != null && total ? (gb / total) * 100 : null
  const openHm = clockHm(((-(hist.length - 1)) % 86400 + 86400) % 86400)
  return { gb, total, delta, pct, open, openHm, hist }
}

// ---------------------------------------------------------------------------
// THE LOCKED REQUEST: the newest record in the request stream, dressed with
// the runtime figures the inspector prints (engine, TTFT, p95, queue). A
// held feed holds the lock; a boot screen holds an empty bay.
// ---------------------------------------------------------------------------

export function lockedRequest(snap) {
  const act = activeModelOf(snap)
  const k = (snap && snap.kpi) || {}
  const r = ((snap && snap.requests) || [])[0] || null
  return {
    r,
    hash: r ? hexFrom(r.id || 'req-0', 6) : null,
    model: r && r.model ? String(r.model) : act.model,
    engine: act.engine,
    tps: r && r.decode_tps != null ? r.decode_tps : act.tps,
    inT: r && r.prompt != null ? r.prompt : null,
    outT: r && r.output != null ? r.output : null,
    ttft: k.ttft != null ? k.ttft : null,
    p95: k.p95 != null ? k.p95 : null,
    queue: k.queue != null ? k.queue : null,
  }
}

// Request status: the newest record is decoding while the runtime serves it;
// every older record is done. Boot mode holds. Nothing here invents a state
// the feed does not carry.
export function reqStatus(snap, newest, decodeTps) {
  if (!snap || snap.mode === 'boot' || snap.mode === 'offline') return 'HELD'
  if (newest) return 'DECODING'
  return decodeTps != null ? 'DONE' : 'DONE'
}

// ---------------------------------------------------------------------------
// REQUEST LEDGER rows: one row per request record, newest first. Hashes come
// from hexFrom seeded by the real request id, so a held feed prints a held
// table and a reload prints the same table.
// ---------------------------------------------------------------------------

export function ledgerRows(snap) {
  const k = (snap && snap.kpi) || {}
  const queued = (k.queue || 0) >= 9
  const requests = ((snap && snap.requests) || []).slice(0, 40)
  const rows = []
  requests.forEach((r, i) => {
    if (!r) return
    rows.push({
      id: r.id || `req-${i}`,
      hash: hexFrom(r.id || `req-${i}`, 6),
      model: String(r.model || '—'),
      inT: r.prompt != null ? r.prompt : null,
      outT: r.output != null ? r.output : null,
      tps: r.decode_tps != null ? r.decode_tps : null,
      tm: clockHm(r.t ? Math.floor(r.t / 1000) % 86400 : 0, 0),
      sx: reqStatus(snap, i === 0, r.decode_tps) === 'DECODING' && queued ? 'QUEUED' : reqStatus(snap, i === 0, r.decode_tps),
      hot: i === 0,
    })
  })
  return rows
}

// ---------------------------------------------------------------------------
// EVENT LOG rows: the feed's own event stream, tagged by message shape.
// Level tints: err → alarm, warn → accent, ok → plain.
// ---------------------------------------------------------------------------

export function eventRows(snap) {
  const events = ((snap && snap.events) || []).slice(0, 26)
  return events
    .filter((e) => e)
    .map((e, i) => {
      const m = String(e.msg || '')
      const tag = /phase|burst|recover/i.test(m)
        ? 'FLOW'
        : /vram|power|temp|watt/i.test(m)
          ? 'GPU'
          : /kv|slot|cohort|cache|reingest/i.test(m)
            ? 'KV'
            : /queue|p95|decode|tok/i.test(m)
              ? 'QUEUE'
              : 'SYS'
      const cls = e.level === 'err' || e.level === 'alert' ? 'v' : e.level === 'warn' ? 'a' : e.level === 'ok' ? '' : 'w'
      return { id: e.id || `log-${i}`, t: clockHm(Math.floor((e.t || 0) / 1000) % 86400, 0), tag, tx: m.toUpperCase().slice(0, 64), cls }
    })
    .reverse() // newest at the bottom
}

// ---------------------------------------------------------------------------
// MODEL TALLY: requests grouped by model, plus the arrival rate off kpi.rpm.
// ---------------------------------------------------------------------------

export function modelTally(snap) {
  const requests = ((snap && snap.requests) || [])
  const counts = new Map()
  for (const r of requests) {
    if (!r) continue
    const m = String(r.model || '—')
    counts.set(m, (counts.get(m) || 0) + 1)
  }
  const models = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  const k = (snap && snap.kpi) || {}
  return { models, total: requests.length, rpm: k.rpm != null ? Math.round(k.rpm) : null }
}

// ---------------------------------------------------------------------------
// GPU DRAW: power, util, temp and vram off the nvidia-smi reader.
// ---------------------------------------------------------------------------

export function gpuStats(snap, gpu) {
  const g = gpu || (snap && snap.gpu) || null
  const k = (snap && snap.kpi) || {}
  return {
    power: g && g.power != null ? g.power : null,
    util: g && g.util != null ? g.util : null,
    temp: g && g.temp != null ? g.temp : null,
    vram: k.vram != null ? k.vram : g && g.vram != null ? g.vram : null,
    total: g && g.vramTotal != null ? g.vramTotal : null,
  }
}

// ---------------------------------------------------------------------------
// QUEUE RAIL: fourteen request slots. Lit count = kpi.queue clamped to the
// rail, so the rail is the queue depth; an engine down tints the lit lamps
// violet; the newest slot flares on request_arrived (the conductor's kick).
// ---------------------------------------------------------------------------

export function queueRail(snap) {
  const engines = ((snap && snap.engines) || [])
  const down = engines.some((e) => e && e.up === false)
  const k = (snap && snap.kpi) || {}
  const q = k.queue != null ? k.queue : null
  const lit = q != null ? Math.max(0, Math.min(14, Math.round(q))) : 0
  return { lit, down, q: q != null ? Math.round(q) : null }
}

// Lamp x fractions (of the rail width) for the screen-blended light pool.
export function lampFracs(lit) {
  const out = []
  for (let i = 0; i < 14; i++) {
    if (lit == null || i >= lit) continue
    out.push(13 + ((i + 0.5) / 14) * 74)
  }
  return out
}

// Decode-rate gate 0..1 for scene motion (rail glint, tape run, sweep):
// 0 when the feed is stale so the foundry holds still, otherwise the decode
// rate normalised the way the conductor normalises flow.
export function decode01(snap) {
  if (staleOf(snap)) return 0
  const tps = snap && snap.kpi && snap.kpi.tps != null ? snap.kpi.tps : 0
  return clamp(tps / 280, 0.3, 1)
}

// ---------------------------------------------------------------------------
// SERVED TOKENS: the integral of the decode rate over the covered history
// window, one sample per feed tick. An honest derivation of a total the feed
// does not carry; every label names its window.
// ---------------------------------------------------------------------------

export function servedTokens(snap) {
  const hist = ((snap && snap.kpiHist && snap.kpiHist.tps) || [])
  let s = 0
  for (const v of hist) s += Math.max(0, v || 0)
  return { tokens: Math.round(s), samples: hist.length }
}

// ---------------------------------------------------------------------------
// SAMPLER: the decode-side figures the feed carries — multi-token
// prediction acceptance, time per output token, KV cache fill, reingest.
// ---------------------------------------------------------------------------

export function samplerOf(snap) {
  const k = (snap && snap.kpi) || {}
  return {
    mtp: k.mtp != null ? k.mtp : null,
    tpot: k.tpot != null ? k.tpot : null,
    cache: k.cache != null ? k.cache : null,
    reingest: k.reingest != null ? k.reingest : null,
  }
}

// ---------------------------------------------------------------------------
// PRESSURE LADDER: guard lines read against the live figures. A row lights
// when its line is crossed and holds alarm red at its critical line.
// ---------------------------------------------------------------------------

export function pressureLines(snap, gpu) {
  const g = gpu || (snap && snap.gpu) || null
  const k = (snap && snap.kpi) || {}
  const total = g && g.vramTotal != null ? g.vramTotal : 24
  const gb = k.vram != null ? k.vram : g && g.vram != null ? g.vram : 0
  const vp = (gb / total) * 100
  const sessions = ((snap && snap.sessions) || [])
  const hot = sessions.filter((s) => s && s.window && (s.used || 0) / s.window >= 0.85).length
  const q = k.queue != null ? k.queue : 0
  const power = g && g.power != null ? g.power : 0
  return [
    { label: 'VRAM 75% GUARD', v: `${vp.toFixed(0)}%`, on: vp >= 75, crit: vp >= 90 },
    { label: 'VRAM 90% GUARD', v: `${vp.toFixed(0)}%`, on: vp >= 90, crit: true },
    { label: 'POWER 382 W GUARD', v: `${power != null ? Math.round(power) : '—'} W`, on: power >= 382, crit: power >= 430 },
    { label: 'QUEUE 12 GUARD', v: `${Math.round(q)} DEEP`, on: q >= 12, crit: q >= 14 },
    { label: 'KV 85% GUARD', v: `${hot} HOT`, on: hot > 0, crit: hot >= 5 },
  ]
}

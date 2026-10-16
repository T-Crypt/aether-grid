// The scene conductor: ONE master clock for the whole console.
//
// SceneRoot is the only place in the app that runs a timer. This object is
// what the clock drives:
//
//   t         master time, seconds. Advances once per rAF frame while
//             `running`. Every animated surface derives its phase from `t`,
//             so one load spike moves every canvas on screen in the same
//             frame. Frozen while `paused`, and never running when
//             `reduced` (the static-fallback path).
//   snap      latest telemetry snapshot, written at feed rate (<= 1 Hz).
//             Canvases read it straight off the conductor in their paint
//             function. React state never ticks per frame.
//   heat / alert / flow / reason
//             smoothed 0..1 scalars. `heat` (VRAM/temp/power) and `alert`
//             (anomaly pressure) are published to the document as
//             --heat / --alert so CSS-driven chrome (KPI strip, log rail)
//             warms and cools with the scene; `flow` and `reason` drive the
//             helix, cable packets and safehouse sweep.
//   events    canonical event ring buffer. The translator (SceneRoot) emits
//             the five canonical types on each snap diff:
//
//               request_arrived   a new request record landed
//               token_generated   n tokens decoded this tick
//               kv_slot_changed   a KV slot changed fill state
//               vram_pressure     VRAM/power crossed a pressure threshold
//               anomaly           a warn/err event or alert fired
//
//             Each emit fans out to `on(type, fn)` subscribers AND leaves a
//             trace in the frame state (kvFlashes, pings, helix) that the
//             canvas painters consume. One event, many visible ripples.
//   painters  canvases register here; the clock calls them every frame.
//   anchors   DOM rects of named scene regions (queue cell, hero, KV grid,
//             GPU block, engine rail) so full-bleed layers can route cables
//             and scatter pings across panel boundaries.
//
// Skin-agnostic: painters receive the active skin's palette channels
// (conductor.palette, "R G B" strings) and never hard-code a colour except
// the absolute alarm red (ALM).

// The five canonical events translateSnap emits: request_arrived,
// token_generated, kv_slot_changed, vram_pressure, anomaly. Subscribers
// name them as string literals at the `conductor.on(type, fn)` call site;
// there is no enum to keep in sync.

// Absolute alarm red. Severity must never follow the skin accent, the same
// rule Status.jsx applies to pills and gauges.
export const ALM = '255 71 78'

// Helix choreography: tokens per coil. The helix phase advances by
// (tps / TOKENS_PER_COIL) coils per second, so the hero visibly turns in
// step with the decode rate; packet trains ride the strands below.
export const TOKENS_PER_COIL = 24

const EVENT_CAP = 256

export function createConductor() {
  const painters = new Set()
  const listeners = new Map()
  const anchorEls = new Map()

  const c = {
    t: 0,
    running: false, // clock advances
    reduced: false, // prefers-reduced-motion: static fallback
    paused: false, // demo transport hold
    snap: null,
    tick: 0,
    demo: false,
    phase: null, // demo scenario phase name (idle/burst/pressure/overflow/recover)
    palette: { acc: '0 224 224', dat: '240 220 80', col: '255 64 192' },
    layers: { declination: true, scopeOmega: true, loom9: true, safehouse: true },

    // Smoothed scalars, written by the clock each frame toward targets the
    // translator derives from the latest snap.
    heat: 0,
    alert: 0,
    flow: 0,
    reason: 0,
    _target: { heat: 0, alert: 0, flow: 0, reason: 0 },

    events: [],
    _evSeq: 0,
    kvFlashes: [], // { index, t0 }, cohort grid slot pulses
    pings: [], // { x, y, t0, crit }, scope-omega and safehouse ripples
    helix: { phase: 0, kick: 0 }, // kick: transient coil impulse 0..1

    anchors: new Map(), // id -> { x, y, w, h } viewport coords
    measured: 0,
  }

  c.register = (draw) => {
    painters.add(draw)
    return () => painters.delete(draw)
  }

  c.anchor = (id, el) => {
    if (el) anchorEls.set(id, el)
    else anchorEls.delete(id)
    c.measure()
  }

  // Cheap to run often: a handful of getBoundingClientRect calls.
  c.measure = () => {
    c.measured = c.t
    for (const [id, el] of anchorEls) {
      try {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) c.anchors.set(id, { x: r.left, y: r.top, w: r.width, h: r.height })
      } catch {
        /* element detached this frame */
      }
    }
  }

  c.emit = (type, payload = {}) => {
    const ev = { type, t: c.t, seq: ++c._evSeq, ...payload }
    c.events.push(ev)
    if (c.events.length > EVENT_CAP) c.events.splice(0, c.events.length - EVENT_CAP)
    // Frame-state traces the painters consume (cheap, bounded).
    if (type === 'kv_slot_changed' && typeof payload.index === 'number') {
      c.kvFlashes.push({ index: payload.index, t0: c.t })
      if (c.kvFlashes.length > 40) c.kvFlashes.splice(0, c.kvFlashes.length - 40)
    } else if (type === 'anomaly') {
      const a = c.anchors.get(payload.at || 'hero')
      const x = a ? a.x + a.w * (payload.px ?? 0.5) : innerWidth * 0.5
      const y = a ? a.y + a.h * (payload.py ?? 0.5) : innerHeight * 0.4
      c.pings.push({ x, y, t0: c.t, crit: payload.level === 'err' })
      if (c.pings.length > 24) c.pings.splice(0, c.pings.length - 24)
      if (payload.level === 'err') c.helix.kick = 1
    } else if (type === 'request_arrived') {
      c.helix.kick = Math.min(1, c.helix.kick + 0.5)
    }
    const set = listeners.get(type)
    if (set) for (const fn of [...set]) {
      try {
        fn(ev, c)
      } catch {
        /* a subscriber must not break the fan-out */
      }
    }
    return ev
  }

  c.on = (type, fn) => {
    if (!listeners.has(type)) listeners.set(type, new Set())
    listeners.get(type).add(fn)
    return () => listeners.get(type)?.delete(fn)
  }

  c.frame = (dt) => {
    c.t += dt
    const k = 1 - Math.exp(-dt / 0.8) // ~1 s time constant
    const T = c._target
    c.heat += (T.heat - c.heat) * k
    c.alert += (T.alert - c.alert) * k
    c.flow += (T.flow - c.flow) * k
    c.reason += (T.reason - c.reason) * k

    const tps = c.snap?.kpi?.tps || 0
    c.helix.phase += (dt * Math.max(0, tps)) / TOKENS_PER_COIL
    c.helix.kick = Math.max(0, c.helix.kick - dt * 1.4)

    if (c.t - c.measured > 1) c.measure()
    c.kvFlashes = c.kvFlashes.filter((f) => c.t - f.t0 < 1.6)
    c.pings = c.pings.filter((p) => c.t - p.t0 < 2.2)

    // Publish the smoothed scene state to CSS so DOM chrome warms too.
    // Quantised to 1/40 so the document style only flips on visible change;
    // a full-screen gradient layer must not repaint 60x per second.
    const h = Math.round(c.heat * 40) / 40
    const a = Math.round(c.alert * 40) / 40
    if (c._css !== h) document.documentElement.style.setProperty('--heat', String(h))
    if (c._cssa !== a) document.documentElement.style.setProperty('--alert', String(a))
    c._css = h
    c._cssa = a
    const f = Math.round(c.flow * 40) / 40
    if (c._cssf !== f) {
      document.documentElement.style.setProperty('--flow', String(f))
      c._cssf = f
    }

    for (const p of painters) {
      try {
        p(c)
      } catch {
        /* one painter must not kill the clock */
      }
    }
  }

  c.paintSettled = () => {
    for (const p of painters) {
      try {
        p(c)
      } catch {
        /* noop */
      }
    }
  }

  return c
}

// ---------------------------------------------------------------------------
// Translator: canonical events + smoothed targets from one snap diff.
// Runs at feed rate (<= 1 Hz), so it may diff lists freely.
// ---------------------------------------------------------------------------

import { wellState } from '../lib/format'

function lastIds(list, key) {
  const out = []
  for (const r of list || []) if (r && r[key] != null) out.push(r[key])
  return out
}

export function translateSnap(prev, next, c) {
  if (!next) return
  c.snap = next
  c.phase = next.phase || null
  const k = next.kpi || {}
  const gpu = next.gpu || {}
  const prevK = (prev && prev.kpi) || {}

  // token_generated: the decode rate for this tick, in tokens.
  const tps = k.tps != null && isFinite(k.tps) ? k.tps : 0
  c.emit('token_generated', { n: Math.round(tps), tps })

  // request_arrived: new request ids since the previous snap.
  const prevReq = new Set(lastIds(prev?.requests, 'id'))
  const fresh = (next.requests || []).filter((r) => r && r.id != null && !prevReq.has(r.id))
  if (fresh.length) c.emit('request_arrived', { n: fresh.length, ids: fresh.map((r) => r.id) })

  // kv_slot_changed: session fill crossed a well-state line, or moved a lot.
  const prevS = new Map()
  for (const s of prev?.sessions || []) if (s && s.id) prevS.set(s.id, s)
  const rows = next.sessions || []
  rows.forEach((s, index) => {
    if (!s || !s.id || !s.window) return
    const f = Math.min(1, (s.used || 0) / s.window)
    const p = prevS.get(s.id)
    const pf = p && p.window ? Math.min(1, (p.used || 0) / p.window) : f
    const crossed = wellState(pf) !== wellState(f)
    if (crossed || Math.abs(f - pf) > 0.12) {
      c.emit('kv_slot_changed', { index, id: s.id, fill: f, from: pf, to: f, engine: s.engine })
    }
  })

  // vram_pressure: threshold crossings on VRAM or power.
  const vt = gpu.vramTotal || 24
  const pct = gpu.vram != null ? gpu.vram / vt : 0
  const prevPct = prev?.gpu?.vramTotal ? (prev.gpu.vram != null ? prev.gpu.vram / prev.gpu.vramTotal : 0) : pct
  const cross = (a, b, th) => (a < th && b >= th) || (a >= th && b < th)
  if (cross(prevPct, pct, 0.75)) c.emit('vram_pressure', { pct, level: pct >= 0.75 ? 'warn' : 'ok', at: 'gpu' })
  if (cross(prevPct, pct, 0.9)) c.emit('vram_pressure', { pct, level: pct >= 0.9 ? 'crit' : 'warn', at: 'gpu' })
  if (gpu.power != null && prev?.gpu?.power != null && cross(prev.gpu.power / 450, gpu.power / 450, 0.85)) {
    c.emit('vram_pressure', { pct: gpu.power / 450, level: 'warn', at: 'gpu', why: 'power' })
  }

  // anomaly: warn/err events and alerts that are new since the previous snap.
  const prevEv = new Set(lastIds(prev?.events, 'id'))
  const freshEv = (next.events || []).filter((e) => e && e.id != null && !prevEv.has(e.id))
  for (const e of freshEv.slice(0, 6)) {
    const level = e.level === 'err' || e.level === 'alert' ? 'err' : e.level === 'warn' ? 'warn' : 'info'
    if (level === 'info') continue
    const msg = String(e.msg || '')
    const at = /vram|power|temp/i.test(msg) ? 'gpu' : /slot|kv|cohort|cache/i.test(msg) ? 'kv' : 'hero'
    c.emit('anomaly', { level, msg, at })
  }
  const prevAl = new Set(prev?.alerts || [])
  for (const a of next.alerts || []) {
    if (!prevAl.has(a)) c.emit('anomaly', { level: 'err', msg: a, at: 'kv' })
  }

  const vramN = gpu.vram != null ? gpu.vram / (gpu.vramTotal || 24) : 0
  const tempN = gpu.temp != null ? Math.min(1, Math.max(0, (gpu.temp - 40) / 50)) : 0
  const pwrN = gpu.power != null ? Math.min(1, gpu.power / 450) : 0
  const heatRaw = Math.max(0, (vramN - 0.35) / 0.6) * 0.55 + tempN * 0.25 + pwrN * 0.2
  const queueN = k.queue != null ? Math.min(1, k.queue / 16) : 0
  const alerts = next.alerts || []
  const errNow = freshEv.some((e) => e.level === 'err' || e.level === 'alert')
  c._target.heat = Math.min(1, heatRaw * (0.7 + queueN * 0.5))
  c._target.alert = Math.min(1, (alerts.length ? 0.45 : 0) + (errNow ? 0.5 : 0) + (vramN > 0.9 ? 0.3 : 0))
  c._target.flow = tps > 0 ? Math.min(1, tps / 280) : 0
  const reasoning = next.reasoning
  c._target.reason = reasoning ? Math.min(1, 0.35 + c._target.flow * 0.65) : 0
}

// Token Foundry canvas painters. Registered through SceneCanvas; every one
// is a pure function of the conductor (master clock, latest snapshot, active
// palette). No timers, no wall clock, no per-painter accumulators beyond the
// held-feed memory below: every phase derives from c.t, so a held feed
// freezes cleanly and reduced motion settles on one valid frame of the
// latest data.
//
// Canvases, grouped by surface:
//   paintQueueLamps  rail-cv        fourteen request-slot lamps on a bus bar,
//                                   lit by queue depth, newest slot flaring
//                                   on request_arrived (the helix kick)
//   paintBay         dv-body        the inspector chassis: plate steel, CRT
//                                   bezel, lock-on brackets, engraved base
//   paintFace        dv-live        CRT face: the locked request, hero tok/s
//                                   numerals, TTFT bar, scan sweep, glitch
//                                   slices on anomaly/vram_pressure
//   paintForge       ch-cv          tok/s over time (acc) with the p95 band
//                                   (col, right axis), queue underlay, burst
//                                   markers at arrival surges, NOW marker
//   paintTape        tk-cv          the request tape (VT323, newest at right)
//   paintCells       tn-cv          served tokens as a 25x8 cell grid
//   paintQueueSteps  qb-cv          queue depth step chart, drain marks
//   paintPool        pl-cv          the vram pool tank (used vs total GB)
//   paintSpark       t-cv/gd-cv     decode spark + gpu-draw + rate traces
//
// Colours come from c.palette ("R G B" channels); neutral shading uses plain
// black/white alphas (no hue); the only hard-coded colour is the absolute
// alarm red (ALM in scene/conductor.js) where severity, not palette, is the
// meaning.

import {
  activeModelOf,
  decode01,
  gpuStats,
  hexFrom,
  lockedRequest,
  queueRail,
  servedTokens,
  staleOf,
  vramStats,
} from './shared'

const chan = (s) => String(s || '0 0 0').trim().split(/\s+/).map(Number)
const clamp01 = (a) => (a < 0 ? 0 : a > 1 ? 1 : a)
const rgba = (s, a) => `rgba(${chan(s).join(',')},${clamp01(a)})`
const lerp = (a, b, t) => a + (b - a) * t
const det = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
const grp = (n) => Math.round(n).toLocaleString('en-US')

// Seconds since the most recent matching conductor event (Infinity if none).
// The glitch/flare surfaces read this: a fresh anomaly or vram_pressure
// crossing displaces the hero surfaces for a beat, then the frame heals.
function flareAge(c, types) {
  let a = Infinity
  for (const ev of c.events || []) {
    if (types.includes(ev.type)) a = Math.min(a, c.t - ev.t)
  }
  return a
}

function rrPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.arcTo(x + w, y, x + w, y + rr, rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr)
  ctx.lineTo(x + rr, y + h)
  ctx.arcTo(x, y + h, x, y + h - rr, rr)
  ctx.lineTo(x, y + rr)
  ctx.arcTo(x, y, x + rr, y, rr)
  ctx.closePath()
}

// ---------------------------------------------------------------------------
// QUEUE RAIL — one bus bar, fourteen request-slot lamps. Lit count is the
// queue depth; the newest slot flares on request_arrived; an engine down
// tints the lit lamps violet; offline: all dark. Shimmer is a slow
// deterministic drift seeded on the master clock, gated on the decode rate;
// stale and reduced motion hold the frame still.
// ---------------------------------------------------------------------------

export function paintQueueLamps(ctx, w, h, c) {
  if (w < 24 || h < 12) return
  const p = c.palette
  const t = c.t
  const anim = !c.reduced
  const snap = c.snap
  const rail = queueRail(snap)
  const kick = anim && !staleOf(snap) ? Math.max(0, c.helix.kick || 0) : 0

  const x0 = w * 0.17
  const x1 = w * 0.87
  const hooks = [x0 - w * 0.025, lerp(x0, x1, 1 / 3), lerp(x0, x1, 2 / 3), x1 + w * 0.025]
  const wireY = (x) => {
    for (let s = 0; s < hooks.length - 1; s++) {
      if (x >= hooks[s] && x <= hooks[s + 1]) {
        const tt = (x - hooks[s]) / (hooks[s + 1] - hooks[s])
        return 2 + h * 0.16 * 4 * tt * (1 - tt)
      }
    }
    return 2
  }

  // the bus: faint cable + a warm catch-light along its top
  ctx.lineWidth = 1.4
  ctx.strokeStyle = rgba(p.acc, 0.32)
  ctx.beginPath()
  for (let x = hooks[0]; x <= hooks[3]; x += 3) {
    const y = wireY(x)
    if (x === hooks[0]) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.lineWidth = 0.6
  ctx.strokeStyle = rgba(p.dat, 0.22)
  ctx.beginPath()
  for (let x = hooks[0]; x <= hooks[3]; x += 3) {
    const y = wireY(x) - 0.7
    if (x === hooks[0]) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  for (const x of hooks) {
    ctx.fillStyle = rgba(p.acc, 0.45)
    ctx.fillRect(x - 1.5, 0, 3, 4)
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(x - 0.5, 3, 1, 2)
  }

  const r = Math.max(2.6, h * 0.14)
  const ry = r * 1.3
  const held = staleOf(snap)
  for (let i = 0; i < 14; i++) {
    const x = lerp(x0, x1, (i + 0.5) / 14)
    const cord = 0.08 + 0.12 * det(i * 7.7)
    const wy = wireY(x)
    const sy = wy + h * cord
    const isNewest = rail.lit > 0 && i === rail.lit - 1
    // the newest slot flares on a fresh arrival; the rest shimmer gently
    const flare = isNewest ? kick : 0
    let L = i < rail.lit ? 0.85 * (anim && !held ? 0.86 + 0.14 * Math.sin(t * (0.7 + det(i * 3.1) * 0.6) + i * 2.1) : 1) : 0
    if (isNewest && flare > 0) L = Math.min(1.15, L + flare * 0.45)
    // cord + socket
    ctx.strokeStyle = 'rgba(0,0,0,0.65)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, wy)
    ctx.lineTo(x, sy)
    ctx.stroke()
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(x - r * 0.6, sy, r * 1.2, r * 0.95)
    ctx.fillStyle = rgba(p.dat, 0.14)
    ctx.fillRect(x - r * 0.6, sy, r * 1.2, 0.8)
    const cy = sy + r * 0.95 + ry * 0.9
    const col = rail.down ? p.col : p.dat
    if (L > 0) {
      const halo = ctx.createRadialGradient(x, cy, 0, x, cy, h * 1.15)
      halo.addColorStop(0, rgba(col, 0.55 * L))
      halo.addColorStop(1, rgba(col, 0))
      ctx.fillStyle = halo
      ctx.fillRect(x - h * 1.2, cy - h * 1.2, 2.4 * h, 2.4 * h)
      const gg = ctx.createRadialGradient(x, cy - ry * 0.25, 0, x, cy, ry)
      gg.addColorStop(0, `rgba(255,250,242,${Math.min(1, 0.3 + 0.7 * L)})`)
      gg.addColorStop(0.55, rgba(col, Math.min(1, 0.25 + 0.7 * L)))
      gg.addColorStop(1, rgba(p.acc, 0.25 + 0.5 * L))
      ctx.fillStyle = gg
      ctx.beginPath()
      ctx.ellipse(x, cy, r, ry, 0, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // an empty slot: dark bulb with a ticked ring, waiting for a request
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.beginPath()
      ctx.ellipse(x, cy, r, ry, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = rgba(p.acc, 0.3)
      ctx.lineWidth = 0.8
      ctx.stroke()
      ctx.strokeStyle = rgba(p.acc, 0.22)
      ctx.beginPath()
      ctx.moveTo(x - r * 0.4, cy + ry * 0.2)
      ctx.lineTo(x - r * 0.1, cy - ry * 0.25)
      ctx.moveTo(x + r * 0.12, cy - ry * 0.1)
      ctx.lineTo(x + r * 0.42, cy + ry * 0.25)
      ctx.stroke()
    }
  }
}

// ---------------------------------------------------------------------------
// THE INSPECTOR BAY — two stacked canvases: the chassis (this) and the CRT
// face (paintFace). One pure layout for both: plate-steel body, CRT bezel,
// status strip, engraved base line, lock-on brackets around the tube.
// ---------------------------------------------------------------------------

const bayGeo = new Map()
function bayLayout(w, h) {
  const key = `${w}x${h}`
  const hit = bayGeo.get(key)
  if (hit) return hit
  // The callout cards are a DOM row under the bay (InspectorPlate), so the
  // device simply centres and scales to the canvas.
  const baseU = 72 + 318 + 26 + 4
  const u = Math.max(0.2, Math.min((w * 0.94) / 380, (h - 4) / baseU))
  const X = Math.round((w - 380 * u) / 2)
  const Y = Math.round(Math.max(2, (h - baseU * u) / 2))
  const g = {
    w, h, u, X, Y,
    head: { x: X, y: Y, w: 380 * u, h: 64 * u, r: 12 * u },
    lens: { x: X + 64 * u, y: Y + 18 * u, w: 252 * u, h: 32 * u, r: 5 * u },
    body: { x: X, y: Y + 72 * u, w: 380 * u, h: 318 * u, r: 24 * u },
    bezel: { x: X + 15 * u, y: Y + 89 * u, w: 350 * u, h: 214 * u, r: 14 * u },
    crt: { x: X + 24 * u, y: Y + 98 * u, w: 332 * u, h: 196 * u, r: 10 * u },
    plate: { x: X + 34 * u, y: Y + 357 * u, w: 312 * u, h: 22 * u, r: 3 * u },
  }
  if (bayGeo.size > 24) bayGeo.clear()
  bayGeo.set(key, g)
  return g
}

export function paintBay(ctx, w, h, c) {
  if (w < 60 || h < 60) return
  const g = bayLayout(w, h)
  const p = c.palette
  const u = g.u
  const t = c.t
  const anim = !c.reduced
  const snap = c.snap
  const stale = staleOf(snap)
  const kick = anim && !stale ? Math.max(0, c.helix.kick || 0) : 0
  const flow = clamp01(c.flow || 0)

  // cast shadow on the plate wall
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.7)'
  ctx.shadowBlur = 18 * u
  ctx.shadowOffsetY = 7 * u
  ctx.shadowOffsetX = 3 * u
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  rrPath(ctx, g.body.x, g.body.y, g.body.w, g.body.h, g.body.r)
  ctx.fill()
  rrPath(ctx, g.head.x, g.head.y, g.head.w, g.head.h, g.head.r)
  ctx.fill()
  ctx.restore()

  // oxidised steel: dark fill, accent wash, edge light from the lamps above
  const metal = (pathFn, x0, y0, x1, y1) => {
    pathFn()
    const mg = ctx.createLinearGradient(0, y0, 0, y1)
    mg.addColorStop(0, `rgba(0,0,0,0.62)`)
    mg.addColorStop(1, `rgba(0,0,0,0.78)`)
    ctx.fillStyle = mg
    ctx.fill()
    pathFn()
    const wash = ctx.createLinearGradient(0, y0, 0, y1)
    wash.addColorStop(0, rgba(p.acc, 0.16))
    wash.addColorStop(1, rgba(p.acc, 0.04))
    ctx.fillStyle = wash
    ctx.fill()
    // wear speckles: deterministic, tinted by the accent
    pathFn()
    ctx.save()
    ctx.clip()
    for (let i = 0; i < 26; i++) {
      const rx = x0 + det(i * 3.7 + 11) * (x1 - x0)
      const ry = y0 + det(i * 5.1 + 7) * (y1 - y0)
      const rr = 1.5 + det(i * 7.3) * 4 * u
      ctx.fillStyle = rgba(p.acc, 0.05 + det(i * 9.1) * 0.08)
      ctx.beginPath()
      ctx.ellipse(rx, ry, rr, rr * 0.6, det(i) * 3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
    pathFn()
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(0,0,0,0.75)'
    ctx.stroke()
    ctx.strokeStyle = rgba(p.dat, 0.14)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x0 + 8 * u, y0 + 0.8)
    ctx.lineTo(x1 - 8 * u, y0 + 0.8)
    ctx.stroke()
  }

  const bodyPath = () => rrPath(ctx, g.body.x, g.body.y, g.body.w, g.body.h, g.body.r)
  const headPath = () => rrPath(ctx, g.head.x, g.head.y, g.head.w, g.head.h, g.head.r)

  metal(bodyPath, g.body.x, g.body.y, g.body.x + g.body.w, g.body.y + g.body.h)
  metal(headPath, g.head.x, g.head.y, g.head.x + g.head.w, g.head.y + g.head.h)

  // status-strip recess (the lens window; the face paint fills it)
  ctx.fillStyle = 'rgba(0,0,0,0.7)'
  rrPath(ctx, g.lens.x - 4 * u, g.lens.y - 4 * u, g.lens.w + 8 * u, g.lens.h + 8 * u, 7 * u)
  ctx.fill()
  ctx.strokeStyle = rgba(p.dat, 0.1)
  ctx.stroke()

  // CRT bezel (the face itself is painted on the live layer)
  const bz = g.bezel
  const bg2 = ctx.createLinearGradient(0, bz.y, 0, bz.y + bz.h)
  bg2.addColorStop(0, 'rgba(0,0,0,0.75)')
  bg2.addColorStop(1, 'rgba(0,0,0,0.6)')
  ctx.fillStyle = bg2
  rrPath(ctx, bz.x, bz.y, bz.w, bz.h, bz.r)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.9)'
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.strokeStyle = rgba(p.dat, 0.08)
  ctx.lineWidth = 1
  rrPath(ctx, bz.x + 1, bz.y + 1, bz.w - 2, bz.h - 2, bz.r)
  ctx.stroke()

  // screws
  const sr = Math.max(1.6, 3.4 * u)
  for (const [sx, sy] of [
    [g.body.x + 13 * u, g.body.y + 13 * u],
    [g.body.x + g.body.w - 13 * u, g.body.y + 13 * u],
    [g.body.x + 13 * u, g.body.y + g.body.h - 13 * u],
    [g.body.x + g.body.w - 13 * u, g.body.y + g.body.h - 13 * u],
    [g.head.x + 14 * u, g.head.y + g.head.h / 2],
    [g.head.x + g.head.w - 14 * u, g.head.y + g.head.h / 2],
  ]) {
    ctx.fillStyle = rgba(p.acc, 0.4)
    ctx.beginPath()
    ctx.arc(sx, sy, sr, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'
    ctx.lineWidth = Math.max(0.8, u)
    ctx.beginPath()
    ctx.moveTo(sx - sr * 0.7, sy - sr * 0.3)
    ctx.lineTo(sx + sr * 0.7, sy + sr * 0.3)
    ctx.stroke()
  }

  // LOCK-ON BRACKETS: four corner Ls around the tube. On request_arrived
  // they snap in tight (kick), then relax; under reduced motion they sit
  // closed. Lock brackets are the inspector's own gesture, in the accent.
  const reach = anim && !stale ? lerp(26 * u, 9 * u, Math.min(1, kick * 1.6)) : 9 * u
  const bx = { x0: g.crt.x - reach, y0: g.crt.y - reach, x1: g.crt.x + g.crt.w + reach, y1: g.crt.y + g.crt.h + reach }
  const arm = Math.max(14 * u, (bx.x1 - bx.x0) * 0.12)
  const bA = 0.5 + 0.35 * Math.min(1, kick) + (flow > 0 ? 0.12 * Math.sin(t * 1.7) : 0)
  ctx.save()
  ctx.shadowColor = rgba(p.acc, 0.8)
  ctx.shadowBlur = 7 * u
  ctx.strokeStyle = rgba(p.acc, Math.min(1, bA))
  ctx.lineWidth = Math.max(1.4, 2.2 * u)
  for (const [cx, cy, dx, dy] of [
    [bx.x0, bx.y0, 1, 1],
    [bx.x1, bx.y0, -1, 1],
    [bx.x0, bx.y1, 1, -1],
    [bx.x1, bx.y1, -1, -1],
  ]) {
    ctx.beginPath()
    ctx.moveTo(cx + dx * arm, cy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx, cy + dy * arm)
    ctx.stroke()
  }
  ctx.restore()

  // the engraved base plate
  const pl = g.plate
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  rrPath(ctx, pl.x, pl.y, pl.w, pl.h, pl.r)
  ctx.fill()
  ctx.strokeStyle = rgba(p.dat, 0.09)
  ctx.stroke()
  const pf = Math.max(8, 10.5 * u)
  ctx.font = `600 ${pf.toFixed(1)}px Rubik, system-ui, sans-serif`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  const long = 'TOKEN FOUNDRY · INSPECTOR BAY 2 · REQUEST LOCK · RIG 01'
  const shortT = 'TOKEN FOUNDRY · REQUEST LOCK'
  const txt = ctx.measureText(long).width < pl.w - 10 * u ? long : shortT
  ctx.fillStyle = 'rgba(0,0,0,0.8)'
  ctx.fillText(txt, pl.x + pl.w / 2, pl.y + pl.h / 2 + 1)
  ctx.fillStyle = rgba(p.dat, 0.5)
  ctx.fillText(txt, pl.x + pl.w / 2, pl.y + pl.h / 2)

  // head legend: the lock lamp sits at the left of the strip
  if (u >= 0.45) {
    ctx.font = `600 ${Math.max(8, 9.5 * u).toFixed(1)}px Rubik, system-ui, sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = rgba(p.dat, 0.34)
    ctx.fillText('LOCK', g.head.x + 26 * u, g.head.y + g.head.h - 8 * u)
  }

  // the scan sweep: a band of light crossing the chassis, speed on the
  // decode rate; a stale feed rests it mid-body
  if (anim && !stale && flow > 0) {
    const ph = (t * 0.11 * (0.4 + flow)) % 1.4
    const sx = lerp(g.body.x - 40 * u, g.body.x + g.body.w + 40 * u, ph)
    const sw = Math.max(6, 26 * u)
    const sg = ctx.createLinearGradient(sx - sw, 0, sx + sw, 0)
    sg.addColorStop(0, rgba(p.dat, 0))
    sg.addColorStop(0.5, rgba(p.dat, 0.07))
    sg.addColorStop(1, rgba(p.dat, 0))
    ctx.fillStyle = sg
    ctx.fillRect(sx - sw, g.body.y, 2 * sw, g.body.h)
  }
}

// ---------------------------------------------------------------------------
// dv-live: the CRT face. The newest request is the lock: header hash and
// status, hero decode numerals, model/engine/token lines, the TTFT bar. A
// fresh arrival (kick) runs the lock-in sweep; anomaly/vram_pressure flares
// displace the hero line for a beat (glitch slices); a stale feed holds the
// last locked figures under a HOLD face.
// ---------------------------------------------------------------------------

// The bay's held memory: the last locked request + figures, read back while
// the feed is stale. Scene-local (this module only), never a store; the
// face is the only reader.
const lastSeen = { model: null, tps: null, ttft: null }

export function paintFace(ctx, w, h, c) {
  if (w < 60 || h < 60) return
  const g = bayLayout(w, h)
  const p = c.palette
  const u = g.u
  const t = c.t
  const anim = !c.reduced
  const snap = c.snap
  const stale = staleOf(snap)
  const lock = lockedRequest(snap)
  if (!stale) {
    if (lock.model) lastSeen.model = lock.model
    if (lock.tps != null) lastSeen.tps = Math.round(lock.tps)
    if (lock.ttft != null) lastSeen.ttft = Math.round(lock.ttft)
  }
  const kick = anim && !stale ? Math.max(0, c.helix.kick || 0) : 0
  const locking = kick > 0.3
  const glitch = Math.max(0, 1 - flareAge(c, ['anomaly', 'vram_pressure']) / 0.8)
  const B = stale ? 0.42 : locking ? 0.5 + 0.4 * (1 - kick) : 0.85
  const ink = (a) => rgba(p.dat, a * (0.35 + 0.65 * B))

  const tickSec = Math.max(0, Math.floor((snap && snap.t) || 0))
  const hm = `${String(Math.floor((9 * 3600 + 52 * 60 + tickSec) / 3600) % 24).padStart(2, '0')}:${String(Math.floor(((9 * 3600 + 52 * 60 + tickSec) / 60) % 60) % 60).padStart(2, '0')}`

  // --- the CRT face ---
  ctx.save()
  rrPath(ctx, g.crt.x, g.crt.y, g.crt.w, g.crt.h, g.crt.r)
  ctx.clip()
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(g.crt.x, g.crt.y, g.crt.w, g.crt.h)
  const cx = g.crt.x + g.crt.w * 0.46
  const cy = g.crt.y + g.crt.h * 0.48
  const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, g.crt.w * 0.72)
  rg.addColorStop(0, rgba(p.dat, 0.03 + 0.07 * B))
  rg.addColorStop(1, rgba(p.dat, 0.005))
  ctx.fillStyle = rg
  ctx.fillRect(g.crt.x, g.crt.y, g.crt.w, g.crt.h)

  // beam sweep: a soft band rolling up the face
  const phBand = anim ? (t * 0.2) % 1 : 0.35
  const sBand = g.crt.h * 0.13
  const yc = lerp(g.crt.y + g.crt.h + 2.4 * sBand, g.crt.y - 2.4 * sBand, phBand)
  const hg = ctx.createLinearGradient(0, yc - 2.4 * sBand, 0, yc + 2.4 * sBand)
  hg.addColorStop(0, rgba(p.dat, 0))
  hg.addColorStop(0.5, rgba(p.dat, 0.06))
  hg.addColorStop(1, rgba(p.dat, 0))
  ctx.fillStyle = hg
  ctx.fillRect(g.crt.x, yc - 2.4 * sBand, g.crt.w, 4.8 * sBand)

  const pad = Math.max(5, g.crt.h * 0.05)
  const hdrF = Math.min(15, Math.max(10, g.crt.h * 0.062))
  const heroF = Math.min(74, g.crt.w * 0.24, g.crt.h * 0.3)
  const lineF = Math.min(19, Math.max(11, g.crt.h * 0.075))

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  const y1 = g.crt.y + pad + hdrF * 0.9
  ctx.font = `${hdrF.toFixed(1)}px "VT323", ui-monospace, monospace`
  ctx.fillStyle = ink(0.62)
  const hdrL = stale
    ? `HOLD · ${hm}`
    : locking
      ? `${lock.hash || '——'} · LOCKING · ${hm}`
      : `${lock.hash || '——'} · LOCKED · ${hm}`
  ctx.fillText(hdrL, g.crt.x + pad, y1)
  const status = stale ? 'HOLD' : locking ? 'LOCKING' : 'DECODING'
  ctx.textAlign = 'right'
  ctx.fillStyle = ink(0.8)
  ctx.fillText(status, g.crt.x + g.crt.w - pad, y1)
  ctx.textAlign = 'left'

  // the hero numerals: the locked request's decode rate, the biggest type
  // on the face, glowing. Glitch flare: ghost copies displaced on both
  // sides, then the clean pass on top.
  const tpsV = stale ? lastSeen.tps : lock.tps != null ? Math.round(lock.tps) : null
  const hero = tpsV != null ? String(tpsV) : '—'
  const y2 = y1 + Math.max(6, g.crt.h * 0.05) + heroF * 0.86
  ctx.font = `${heroF.toFixed(1)}px "VT323", ui-monospace, monospace`
  if (glitch > 0 && anim) {
    const dx = 3 * u + 3 * u * glitch
    ctx.fillStyle = rgba(p.alm, 0.4 * glitch)
    ctx.fillText(hero, g.crt.x + pad - dx, y2)
    ctx.fillStyle = rgba(p.col, 0.4 * glitch)
    ctx.fillText(hero, g.crt.x + pad + dx, y2)
  }
  ctx.save()
  ctx.shadowColor = rgba(p.dat, 0.7 * B)
  ctx.shadowBlur = 16 * u
  ctx.fillStyle = stale ? rgba(p.alm, 1) : ink(1)
  ctx.fillText(hero, g.crt.x + pad, y2)
  ctx.restore()
  const heroW = ctx.measureText(hero).width
  ctx.font = `${Math.max(12, heroF * 0.36).toFixed(1)}px "VT323", ui-monospace, monospace`
  ctx.fillStyle = ink(0.75)
  ctx.fillText(' TOK/S', g.crt.x + pad + heroW + 4, y2)

  // readout lines: model / engine, tokens, ttft
  const modelS = stale ? lastSeen.model || 'NO MODEL' : lock.model || 'NO MODEL'
  const inS = lock.inT != null ? grp(lock.inT) : '—'
  const outS = lock.outT != null ? grp(lock.outT) : '—'
  const ttftV = stale ? lastSeen.ttft : lock.ttft != null ? Math.round(lock.ttft) : null
  const p95S = lock.p95 != null ? Math.round(lock.p95) : null
  const rows = [
    `MODEL ${modelS} · ENG ${lock.engine || '—'}`,
    `PROMPT ${inS}T · COMPLETION ${outS}T · Q ${lock.queue != null ? Math.round(lock.queue) : '—'}`,
    `TTFT ${ttftV != null ? ttftV : '—'} MS · P95 ${p95S != null ? p95S : '—'} MS`,
  ]
  let y3 = y2 + Math.max(6, g.crt.h * 0.045) + lineF
  ctx.font = `${lineF.toFixed(1)}px "VT323", ui-monospace, monospace`
  for (const row of rows) {
    ctx.fillStyle = ink(0.92)
    ctx.fillText(row, g.crt.x + pad, y3)
    if (stale || !locking) {
      // cursor tick after the last row while decoding
      if (row === rows[rows.length - 1] && !stale && anim) {
        const ex = ctx.measureText(row).width
        const blink = Math.sin(t * 2.4) > -0.2 ? 0.8 : 0.2
        ctx.fillStyle = ink(0.8 * blink)
        ctx.fillRect(g.crt.x + pad + ex + 3, y3 - lineF * 0.62, lineF * 0.4, lineF * 0.66)
      }
    }
    y3 += lineF * 1.08
  }

  // the TTFT bar: the newest request's time to first token against 1 s
  if (ttftV != null && y3 + lineF < g.crt.y + g.crt.h - pad) {
    const bx0 = g.crt.x + pad
    const bx1 = g.crt.x + g.crt.w - pad
    const bh = Math.max(3, lineF * 0.3)
    const ym = y3 - lineF * 0.1
    ctx.strokeStyle = ink(0.3)
    ctx.lineWidth = 1
    ctx.strokeRect(bx0 + 0.5, ym - bh + 0.5, bx1 - bx0, bh)
    for (let i = 1; i < 4; i++) {
      const tx = lerp(bx0, bx1, i / 4)
      ctx.fillStyle = ink(0.3)
      ctx.fillRect(tx, ym - bh - 2, 1, 2)
    }
    const fill = clamp01(ttftV / 1000)
    ctx.fillStyle = rgba(p.acc, 0.85)
    ctx.fillRect(bx0 + 1, ym - bh + 1, (bx1 - bx0 - 2) * fill, bh - 1)
    ctx.fillStyle = ink(0.6)
    ctx.font = `${hdrF.toFixed(1)}px "VT323", ui-monospace, monospace`
    ctx.fillText('TTFT / 1S', bx0, ym - bh - 3)
  }

  // the footer: ledger size and arrival rate
  const yf = g.crt.y + g.crt.h - pad * 0.9
  if (g.crt.h > 150) {
    const reqs = ((snap && snap.requests) || []).length
    const k = (snap && snap.kpi) || {}
    ctx.font = `${hdrF.toFixed(1)}px "VT323", ui-monospace, monospace`
    ctx.fillStyle = ink(0.55)
    ctx.fillText(`LEDGER ${reqs} RECORDS · ${k.rpm != null ? Math.round(k.rpm) : '—'} REQ/MIN`, g.crt.x + pad, yf)
  }

  // the lock-in sweep: a bar of light dropping down the face on arrival
  if (locking) {
    const sy = g.crt.y + g.crt.h * Math.max(0, Math.min(1, 1 - kick))
    const sg = ctx.createLinearGradient(0, sy - 16 * u, 0, sy + 4 * u)
    sg.addColorStop(0, rgba(p.dat, 0))
    sg.addColorStop(0.8, rgba(p.dat, 0.22))
    sg.addColorStop(1, rgba(p.dat, 0))
    ctx.fillStyle = sg
    ctx.fillRect(g.crt.x, sy - 16 * u, g.crt.w, 20 * u)
  }

  // glitch slivers: bright displaced strips across the face while an
  // anomaly or a vram_pressure crossing is fresh
  if (glitch > 0 && anim) {
    for (let i = 0; i < 3; i++) {
      const gy = g.crt.y + det(Math.floor(t * 24) * 3.3 + i) * g.crt.h
      const gh = 2 + det(Math.floor(t * 24) * 7.1 + i) * 5
      const goff = (det(Math.floor(t * 24) + i * 11) - 0.5) * 26 * glitch
      ctx.fillStyle = rgba(p.dat, 0.18 * glitch)
      ctx.fillRect(g.crt.x, gy, g.crt.w, gh)
      ctx.fillStyle = rgba(p.alm, 0.22 * glitch)
      ctx.fillRect(g.crt.x + goff, gy, g.crt.w * 0.24, gh)
    }
  }

  // scanlines on the face, then the tube's corners
  ctx.fillStyle = rgba(p.dat, 0.045)
  for (let y = g.crt.y + 2; y < g.crt.y + g.crt.h; y += 3) ctx.fillRect(g.crt.x, y, g.crt.w, 1)
  const vg = ctx.createRadialGradient(cx, cy, g.crt.w * 0.3, cx, cy, g.crt.w * 0.78)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.5)')
  ctx.fillStyle = vg
  ctx.fillRect(g.crt.x, g.crt.y, g.crt.w, g.crt.h)
  ctx.restore()

  // the lock lamp: amber with a request in flight, violet when the engine
  // set is down; held dim while the feed is stale (never dark).
  const rail = queueRail(snap)
  const L = stale ? 0.16 : rail.down ? 0.85 : 0.75
  const ln = g.lens
  const col = rail.down ? p.col : p.acc
  ctx.save()
  rrPath(ctx, g.head.x, g.head.y, g.head.w, g.head.h, g.head.r)
  ctx.clip()
  const hx = ln.x + ln.w / 2
  const hy = ln.y + ln.h / 2
  const halo = ctx.createRadialGradient(hx, hy, 0, hx, hy, ln.w * 0.62)
  halo.addColorStop(0, rgba(col, 0.22 + 0.45 * L))
  halo.addColorStop(1, rgba(col, 0))
  ctx.fillStyle = halo
  ctx.fillRect(g.head.x, g.head.y, g.head.w, g.head.h)
  ctx.restore()
  ctx.save()
  rrPath(ctx, ln.x, ln.y, ln.w, ln.h, ln.r)
  ctx.clip()
  ctx.fillStyle = 'rgba(0,0,0,0.7)'
  ctx.fillRect(ln.x, ln.y, ln.w, ln.h)
  ctx.fillStyle = rgba(col, 0.55 + 0.45 * L)
  ctx.fillRect(ln.x, ln.y, ln.w, ln.h)
  const lc = ctx.createLinearGradient(0, ln.y, 0, ln.y + ln.h)
  lc.addColorStop(0, rgba(col, 0))
  lc.addColorStop(0.5, `rgba(255,250,240,${0.18 + 0.3 * L})`)
  lc.addColorStop(1, rgba(col, 0))
  ctx.fillStyle = lc
  ctx.fillRect(ln.x, ln.y, ln.w, ln.h)
  if (L > 0.45) {
    const core = ctx.createRadialGradient(hx, hy, 0, hx, hy, ln.w * 0.45)
    core.addColorStop(0, `rgba(255,250,242,${Math.min(1, 1.5 * (L - 0.45))})`)
    core.addColorStop(0.55, `rgba(255,250,242,${0.5 * (L - 0.45)})`)
    core.addColorStop(1, 'rgba(255,250,242,0)')
    ctx.fillStyle = core
    ctx.fillRect(ln.x, ln.y, ln.w, ln.h)
  }
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  for (let x = ln.x + 6 * u; x < ln.x + ln.w; x += 7 * u) ctx.fillRect(x, ln.y, Math.max(1, 1.2 * u), ln.h)
  ctx.fillStyle = 'rgba(255,248,244,0.08)'
  ctx.fillRect(ln.x, ln.y, ln.w, Math.max(1, 2 * u))
  ctx.restore()

  // the lamp's light on the body at the lock-in moment (one-shot wash)
  if (locking) {
    const a = Math.min(1, (1 - Math.abs(kick - 0.7) / 0.3) * 0.9)
    if (a > 0.02) {
      const wash = ctx.createRadialGradient(hx, hy, 0, hx, hy, g.body.w * 0.9)
      wash.addColorStop(0, rgba(col, 0.2 * a))
      wash.addColorStop(1, rgba(col, 0))
      ctx.fillStyle = wash
      ctx.fillRect(0, 0, w, h)
    }
  }
}

// ---------------------------------------------------------------------------
// THE FORGE — tok/s over time. One canvas: the decode series (acc, left
// axis), the p95 latency band (col, right axis), the queue-depth underlay,
// burst markers where the arrival rate jumps, a decode-scan band walking the
// window, and the NOW marker held in the alarm colour. The series is
// kpiHist.tps / p95 / queue / rpm — nothing decorative.
// ---------------------------------------------------------------------------

export function paintForge(ctx, w, h, c) {
  if (w < 120 || h < 60) return
  const p = c.palette
  const t = c.t
  const anim = !c.reduced
  const snap = c.snap
  const hist = (((snap && snap.kpiHist && snap.kpiHist.tps) || [])).slice()
  const p95 = (((snap && snap.kpiHist && snap.kpiHist.p95) || [])).slice()
  const qH = (((snap && snap.kpiHist && snap.kpiHist.queue) || [])).slice()
  const rpm = (((snap && snap.kpiHist && snap.kpiHist.rpm) || [])).slice()
  if (hist.length < 4) return
  const k = (snap && snap.kpi) || {}
  const cur = k.tps != null ? k.tps : hist[hist.length - 1]

  const mL = 34
  const mR = w - 52
  const mT = 18
  const mB = h - 16
  const plotW = mR - mL
  const ph = mB - mT

  // tok/s scale (left)
  let lo = Infinity
  let hi = -Infinity
  for (const v of hist) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  if (!isFinite(lo) || !isFinite(hi) || hi - lo < 1) {
    lo = Math.min(lo, cur - 2)
    hi = Math.max(hi, cur + 2)
  }
  const padY = (hi - lo) * 0.12
  const yLo = lo - padY
  const yHi = hi + padY
  const yOf = (v) => mT + (1 - clamp01((v - yLo) / (yHi - yLo))) * ph

  // p95 scale (right), ms
  let plo = Infinity
  let phi = -Infinity
  for (const v of p95) {
    if (v == null) continue
    if (v < plo) plo = v
    if (v > phi) phi = v
  }
  if (!isFinite(plo) || !isFinite(phi)) { plo = 0; phi = 1000 }
  const ppad = (phi - plo) * 0.15
  const pyLo = Math.max(0, plo - ppad)
  const pyHi = phi + ppad
  const pyOf = (v) => mT + (1 - clamp01((v - pyLo) / (pyHi - pyLo))) * ph

  // queue scale (own max, underlay)
  const qMax = Math.max(4, ...qH) * 1.15
  const qyOf = (v) => mB - clamp01(v / qMax) * ph * 0.5

  const n = hist.length
  const xOf = (i) => mL + (i / (n - 1)) * plotW

  // plot ground + grid
  const bg = ctx.createLinearGradient(0, mT, 0, mB)
  bg.addColorStop(0, rgba(p.dat, 0.03))
  bg.addColorStop(1, rgba(p.dat, 0))
  ctx.fillStyle = bg
  ctx.fillRect(mL, mT, plotW, ph)
  const step = niceStep((yHi - yLo) / 5)
  const p0 = Math.ceil(yLo / step) * step
  ctx.font = '500 9px Rubik, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'right'
  for (let v = p0; v <= yHi; v += step) {
    const y = Math.round(yOf(v)) + 0.5
    ctx.strokeStyle = rgba(p.dat, Math.round(v / step) % 2 === 0 ? 0.1 : 0.05)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(mL, y)
    ctx.lineTo(mR, y)
    ctx.stroke()
    if (Math.round(v / step) % 2 === 0) {
      ctx.fillStyle = rgba(p.dat, 0.6)
      ctx.fillText(String(Math.round(v)), mL - 6, y)
    }
  }

  // x labels: minutes before now
  ctx.textBaseline = 'top'
  for (let back = 60; back < n; back += 60) {
    const i = n - 1 - back
    if (i < 1) break
    const x = Math.round(xOf(i)) + 0.5
    ctx.strokeStyle = rgba(p.dat, 0.06)
    ctx.beginPath()
    ctx.moveTo(x, mT)
    ctx.lineTo(x, mB)
    ctx.stroke()
    ctx.fillStyle = rgba(p.dat, 0.55)
    ctx.textAlign = 'center'
    ctx.fillText(`−${Math.round(back / 60)}M`, x, mB + 4)
  }
  ctx.textAlign = 'right'
  ctx.fillStyle = rgba(p.dat, 0.7)
  ctx.fillText('NOW', mR, mB + 4)
  ctx.strokeStyle = rgba(p.dat, 0.25)
  ctx.beginPath()
  ctx.moveTo(mL, mB + 0.5)
  ctx.lineTo(mR, mB + 0.5)
  ctx.stroke()

  // queue-depth underlay: violet fill rising from the base line
  ctx.beginPath()
  ctx.moveTo(xOf(0), qyOf(qH[0] || 0))
  for (let i = 1; i < n; i++) ctx.lineTo(xOf(i), qyOf(qH[i] || 0))
  ctx.lineTo(xOf(n - 1), mB)
  ctx.lineTo(xOf(0), mB)
  ctx.closePath()
  ctx.fillStyle = rgba(p.col, 0.14)
  ctx.fill()

  // p95 band: a translucent violet envelope around the latency line
  if (p95.length === n && phi > plo) {
    ctx.beginPath()
    ctx.moveTo(xOf(0), pyOf(p95[0]))
    for (let i = 1; i < n; i++) ctx.lineTo(xOf(i), pyOf(p95[i]))
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(xOf(i), pyOf(p95[i] * 1.25 + 40))
    ctx.closePath()
    ctx.fillStyle = rgba(p.col, 0.09)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(xOf(0), pyOf(p95[0]))
    for (let i = 1; i < n; i++) ctx.lineTo(xOf(i), pyOf(p95[i]))
    ctx.strokeStyle = rgba(p.col, 0.55)
    ctx.lineWidth = 1
    ctx.setLineDash([4, 3])
    ctx.stroke()
    ctx.setLineDash([])
  }

  // burst markers: where the arrival rate jumps, the ledger took a surge
  // (skip a marker that lands on the tail of the previous one)
  ctx.font = '600 9px Rubik, system-ui, sans-serif'
  let burstN = 0
  let lastBx = -Infinity
  for (let i = Math.max(1, n - 150); i < n; i++) {
    if ((rpm[i - 1] || 0) > 0 && (rpm[i] || 0) - (rpm[i - 1] || 0) >= 30) {
      const x = Math.round(xOf(i)) + 0.5
      if (x - lastBx < 14) continue
      lastBx = x
      burstN++
      ctx.strokeStyle = rgba(p.alm, 0.5)
      ctx.setLineDash([2, 3])
      ctx.beginPath()
      ctx.moveTo(x, mT)
      ctx.lineTo(x, mB)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = rgba(p.alm, 0.85)
      ctx.textAlign = 'left'
      ctx.fillText('ARR', x + 2, mT + 8 + ((burstN % 2) * 9))
    }
  }

  // the decode series, with body
  ctx.beginPath()
  ctx.moveTo(xOf(0), yOf(hist[0]))
  for (let i = 1; i < n; i++) ctx.lineTo(xOf(i), yOf(hist[i]))
  ctx.save()
  ctx.lineTo(xOf(n - 1), mB)
  ctx.lineTo(xOf(0), mB)
  ctx.closePath()
  const yl = ctx.createLinearGradient(0, mT, 0, mB)
  yl.addColorStop(0, rgba(p.acc, 0.3))
  yl.addColorStop(0.45, rgba(p.acc, 0.07))
  yl.addColorStop(1, rgba(p.acc, 0.02))
  ctx.fillStyle = yl
  ctx.fill()
  ctx.restore()

  // glitch flare: pass the line twice, displaced, while an anomaly is fresh
  const glitch = Math.max(0, 1 - flareAge(c, ['anomaly', 'vram_pressure']) / 0.8)
  const drawLine = (dx, colr, alpha, lw) => {
    ctx.beginPath()
    ctx.moveTo(xOf(0) + dx, yOf(hist[0]))
    for (let i = 1; i < n; i++) ctx.lineTo(xOf(i) + dx, yOf(hist[i]))
    ctx.strokeStyle = rgba(colr, alpha)
    ctx.lineWidth = lw
    ctx.stroke()
  }
  if (glitch > 0 && anim) {
    drawLine(-3 * glitch, p.alm, 0.35 * glitch, 1.5)
    drawLine(3 * glitch, p.col, 0.35 * glitch, 1.5)
  }
  ctx.save()
  ctx.shadowColor = rgba(p.acc, 0.7)
  ctx.shadowBlur = 6
  drawLine(0, p.acc, 0.95, 1.6)
  ctx.restore()

  // the NOW marker, held in the alarm colour (never blinked)
  const lastY = yOf(cur)
  ctx.save()
  ctx.shadowColor = rgba(p.alm, 1)
  ctx.shadowBlur = 10
  ctx.strokeStyle = rgba(p.alm, 1)
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(xOf(n - 4), lastY)
  ctx.lineTo(xOf(n - 1), lastY)
  ctx.stroke()
  ctx.fillStyle = rgba(p.alm, 1)
  ctx.fillRect(xOf(n - 1) - 2.5, lastY - 2.5, 5, 5)
  ctx.restore()
  ctx.fillStyle = 'rgba(255,253,240,0.9)'
  ctx.fillRect(xOf(n - 1) - 1, lastY - 1, 2, 2)

  // NOW chip
  const tick0 = Math.max(0, Math.floor((snap && snap.t) || 0))
  const nowS = `NOW ${hmOf(snap, 0)} · ${Math.round(cur)} TOK/S`
  ctx.font = '600 10px Rubik, system-ui, sans-serif'
  const nw = ctx.measureText(nowS).width
  const nx = Math.max(mL + 4, Math.min(mR - nw - 4, xOf(n - 1) - nw / 2))
  const ny = Math.min(mB - 12, lastY + 14)
  ctx.fillStyle = 'rgba(0,0,0,0.8)'
  ctx.fillRect(nx - 3, ny - 7, nw + 6, 14)
  ctx.fillStyle = rgba(p.dat, 0.95)
  ctx.fillText(nowS, nx, ny + 3)
  ctx.strokeStyle = rgba(p.dat, 0.25)
  ctx.beginPath()
  ctx.moveTo(Math.round(xOf(n - 1)) + 0.5, lastY + 4)
  ctx.lineTo(Math.round(xOf(n - 1)) + 0.5, ny - 7)
  ctx.stroke()

  // the decode scan: a band walking the window at the decode rate; the
  // series under it re-strokes bright. Settled frame rests mid-band.
  const bandRate = decode01(snap)
  const bandPh = anim && bandRate > 0 ? (t * 0.055 * bandRate) % 1 : 0.45
  const xh = mL + bandPh * plotW
  const bw = Math.max(9, plotW * 0.035)
  const cg = ctx.createLinearGradient(xh - 2 * bw, 0, xh + 2 * bw, 0)
  cg.addColorStop(0, rgba(p.dat, 0))
  cg.addColorStop(0.3, rgba(p.dat, 0.06))
  cg.addColorStop(0.5, rgba(p.dat, 0.13))
  cg.addColorStop(0.7, rgba(p.dat, 0.06))
  cg.addColorStop(1, rgba(p.dat, 0))
  ctx.fillStyle = cg
  ctx.fillRect(xh - 2 * bw, mT, 4 * bw, ph)
  ctx.lineJoin = 'round'
  const i0 = Math.max(0, Math.floor(((xh - 2.5 * bw - mL) / plotW) * n))
  const i1 = Math.min(n - 1, Math.ceil(((xh + 2.5 * bw - mL) / plotW) * n))
  ctx.lineWidth = 1.6
  for (let i = i0; i < i1; i++) {
    const xa = xOf(i)
    const kk = 1 - Math.max(0, Math.min(1, Math.abs(xa - xh) / (2.5 * bw)))
    ctx.strokeStyle = rgba(p.dat, 0.9 * kk)
    ctx.beginPath()
    ctx.moveTo(xa, yOf(hist[i]))
    ctx.lineTo(xOf(i + 1), yOf(hist[i + 1]))
    ctx.stroke()
  }
  ctx.fillStyle = rgba(p.dat, 0.35)
  ctx.fillRect(Math.round(xh), mT, 1, ph)

  // right axis: the p95 labels in the cool role
  ctx.font = '500 9px Rubik, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const ps = niceStep((pyHi - pyLo) / 4)
  for (let v = Math.ceil(pyLo / ps) * ps; v <= pyHi; v += ps) {
    ctx.fillStyle = rgba(p.col, 0.6)
    ctx.fillText(String(Math.round(v)), mR + 5, pyOf(v))
  }
  void tick0
}

function niceStep(x) {
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1e-6, x))))
  const r = x / mag
  const m = r >= 5 ? 5 : r >= 2 ? 2 : 1
  return m * mag
}

// Feed clock for index i seconds before the current tick.
function hmOf(snap, backSec) {
  const total = 9 * 3600 + 52 * 60 + Math.max(0, Math.floor((snap && snap.t) || 0)) - backSec
  const hh = Math.floor(total / 3600) % 24
  const mm = Math.floor(total / 60) % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// THE REQUEST TAPE — VT323 tape of the newest requests, newest at the right,
// crawling on the master clock at the decode rate. Under reduced motion the
// tape holds still.
// ---------------------------------------------------------------------------

export function paintTape(ctx, w, h, c) {
  if (w < 60 || h < 12) return
  const p = c.palette
  const t = c.t
  const anim = !c.reduced
  const snap = c.snap
  const reqs = ((snap && snap.requests) || []).slice(0, 12)

  const font = Math.max(13, Math.min(18, h * 0.66))
  ctx.font = `${font}px "VT323", ui-monospace, monospace`
  const gap = font * 1.6

  // rebuild the item list (widths measured) — newest at the right edge
  const items = []
  let x = w - 12
  for (let i = reqs.length - 1; i >= 0; i--) {
    const r = reqs[i]
    if (!r) continue
    const hash = hexFrom(r.id || `req-${i}`, 6)
    const s = `IN ${grp(r.prompt || 0)}T OUT ${grp(r.output || 0)}T · ${Math.round(r.decode_tps || 0)} TOK/S · ${hash}`
    const sw = ctx.measureText(s).width
    x -= sw
    items.unshift({ key: r.id, x, w: sw, s, hot: i === 0 })
    x -= gap
    if (x < -sw - gap) break
  }
  // the tape runs on the decode rate: full run at full decode, held still
  // on a stale feed (a held feed prints a held tape).
  const rate = decode01(snap)
  const shift = anim && rate > 0 ? (t * 24 * rate) % (w * 2 + 200) : 0

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  const y = h / 2 + 0.5
  for (const it of items) {
    const x2 = it.x - shift
    if (x2 > w || x2 + it.w < -40) continue
    ctx.fillStyle = it.hot ? rgba(p.col, 1) : rgba(p.dat, 0.8)
    ctx.fillText(it.s, x2, y)
    ctx.fillStyle = rgba(p.dat, 0.18)
    ctx.fillRect(x2 + it.w + font * 0.75, y - font * 0.28, 1, font * 0.56)
  }
  // edge fades + the tape badge
  const fw = Math.min(40, w * 0.05)
  const gl = ctx.createLinearGradient(0, 0, fw, 0)
  gl.addColorStop(0, 'rgba(0,0,0,0.95)')
  gl.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gl
  ctx.fillRect(0, 0, fw, h)
  const gr = ctx.createLinearGradient(w - fw, 0, w, 0)
  gr.addColorStop(0, 'rgba(0,0,0,0)')
  gr.addColorStop(1, 'rgba(0,0,0,0.95)')
  ctx.fillStyle = gr
  ctx.fillRect(w - fw, 0, fw, h)
  ctx.fillStyle = 'rgba(0,0,0,0.92)'
  ctx.fillRect(0, 0, 44, h)
  ctx.fillStyle = rgba(p.dat, 1)
  ctx.font = `600 9px Rubik, system-ui, sans-serif`
  ctx.fillText('REQ 1', 6, y)
}

// ---------------------------------------------------------------------------
// SERVED CELLS — the 25x8 grid: one cell is 1,000 tokens served, filled from
// the integral of the decode rate over the covered window. The re-fill head
// walks column by column (settled: the head rests at the left).
// ---------------------------------------------------------------------------

const CELLS = 200
const TOK_PER_CELL = 1000

export function paintCells(ctx, w, h, c) {
  if (w < 40 || h < 16) return
  const p = c.palette
  const snap = c.snap
  const served = servedTokens(snap)
  const t = c.t
  const anim = !c.reduced
  const cols = 25
  const rows = 8
  const cell = Math.min((w - 1) / cols, (h - 1) / rows)
  const gp = Math.max(1, cell * 0.2)
  const s = cell - gp
  const ox = 0.5
  const oy = (h - rows * cell) / 2 + 0.5
  const full = (served.tokens / TOK_PER_CELL) % CELLS
  for (let i = 0; i < cols * rows; i++) {
    const x = ox + (i % cols) * cell
    const y = oy + Math.floor(i / cols) * cell
    const a = Math.max(0, Math.min(1, full - i))
    const ph = anim ? (t * 0.12) % 1.6 : 0
    const d = ph - (i % cols) * 0.06
    const wf = d >= 0 && d < 0.35 ? Math.pow(1 - d / 0.35, 1.7) : 0
    ctx.strokeStyle = rgba(p.dat, 0.12 + 0.3 * wf)
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, s, s)
    if (a > 0.01) {
      ctx.fillStyle = rgba(p.dat, 0.55 + 0.4 * a)
      ctx.fillRect(x + 0.5, y + 0.5, s - 1, s - 1)
    }
  }
}

// ---------------------------------------------------------------------------
// QUEUE BOARD — the queue-depth step chart. Drain marks drop where the
// queue visibly drained; the head dot is held in the alarm colour.
// ---------------------------------------------------------------------------

export function paintQueueSteps(ctx, w, h, c) {
  if (w < 40 || h < 16) return
  const p = c.palette
  const snap = c.snap
  const hist = (((snap && snap.kpiHist && snap.kpiHist.queue) || [])).slice(-90)
  if (hist.length < 2) return
  const n = hist.length
  const mx = Math.max(4, ...hist) * 1.1
  const xOf = (i) => (i / (n - 1)) * (w - 2) + 1
  const yOf = (v) => h - 1 - (v / mx) * (h - 3)
  ctx.strokeStyle = rgba(p.dat, 0.08)
  ctx.lineWidth = 1
  for (let v = 4; v < mx; v += 4) {
    const y = Math.round(yOf(v)) + 0.5
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
  // the steps, with body under them
  ctx.beginPath()
  ctx.moveTo(xOf(0), yOf(hist[0]))
  let pv = hist[0]
  for (let i = 1; i < n; i++) {
    const x = xOf(i)
    ctx.lineTo(x, yOf(pv))
    ctx.lineTo(x, yOf(hist[i]))
    pv = hist[i]
  }
  ctx.lineTo(xOf(n - 1), yOf(pv))
  ctx.save()
  ctx.lineTo(xOf(n - 1), h)
  ctx.lineTo(xOf(0), h)
  ctx.closePath()
  const sg = ctx.createLinearGradient(0, 0, 0, h)
  sg.addColorStop(0, rgba(p.dat, 0.4))
  sg.addColorStop(1, rgba(p.dat, 0.03))
  ctx.fillStyle = sg
  ctx.fill()
  ctx.restore()
  ctx.beginPath()
  ctx.moveTo(xOf(0), yOf(hist[0]))
  pv = hist[0]
  for (let i = 1; i < n; i++) {
    const x = xOf(i)
    ctx.lineTo(x, yOf(pv))
    ctx.lineTo(x, yOf(hist[i]))
    pv = hist[i]
  }
  ctx.lineTo(xOf(n - 1), yOf(pv))
  ctx.save()
  ctx.shadowColor = rgba(p.dat, 0.85)
  ctx.shadowBlur = 7
  ctx.strokeStyle = rgba(p.dat, 1)
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.restore()
  // drain marks: the queue visibly dropping
  ctx.fillStyle = rgba(p.dat, 0.7)
  for (let i = 4; i < n; i += 12) {
    if (hist[i] < hist[Math.max(0, i - 4)] - 3) {
      const x = xOf(i)
      ctx.beginPath()
      ctx.moveTo(x - 2.5, 0)
      ctx.lineTo(x + 2.5, 0)
      ctx.lineTo(x, 4)
      ctx.closePath()
      ctx.fill()
      ctx.fillRect(x - 0.5, 0, 1, h * 0.45)
    }
  }
  ctx.fillStyle = rgba(p.alm, 1)
  ctx.fillRect(xOf(n - 1) - 1.5, yOf(pv) - 1.5, 3, 3)
}

// ---------------------------------------------------------------------------
// VRAM POOL — the tank: kpi.vram against gpu.vramTotal, GB scale on the
// right, a pressure tick when the pool runs past 75%.
// ---------------------------------------------------------------------------

export function paintPool(ctx, w, h, c) {
  if (w < 14 || h < 24) return
  const p = c.palette
  const snap = c.snap
  const st = vramStats(snap, snap && snap.gpu)
  const total = st.total || 24
  const level = st.gb != null ? clamp01(st.gb / total) : 0
  const x = 3
  const ww = w - 14
  const y = 2
  const hh = h - 4
  const r = Math.min(6, ww * 0.25)
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  rrPath(ctx, x, y, ww, hh, r)
  ctx.fill()
  const ly = y + hh - level * hh
  ctx.save()
  rrPath(ctx, x, y, ww, hh, r)
  ctx.clip()
  const wg = ctx.createLinearGradient(0, ly, 0, y + hh)
  wg.addColorStop(0, rgba(p.col, 0.85))
  wg.addColorStop(1, rgba(p.col, 0.45))
  ctx.fillStyle = wg
  ctx.fillRect(x, ly, ww, y + hh - ly)
  ctx.fillStyle = 'rgba(255,250,244,0.9)'
  ctx.fillRect(x, ly, ww, 1.3)
  ctx.restore()
  ctx.strokeStyle = rgba(p.dat, 0.35)
  ctx.lineWidth = 1
  rrPath(ctx, x + 0.5, y + 0.5, ww - 1, hh - 1, r)
  ctx.stroke()
  // GB scale ticks
  for (let gb = total / 4; gb < total; gb += total / 4) {
    const ty = Math.round(y + hh - (gb / total) * hh) + 0.5
    ctx.beginPath()
    ctx.moveTo(x + ww, ty)
    ctx.lineTo(x + ww + 5, ty)
    ctx.stroke()
  }
  // the pressure tick: pool past 75%, tick in the alarm colour
  if (level >= 0.75) {
    const ty = y + hh - 0.75 * hh
    ctx.fillStyle = rgba(p.alm, 1)
    ctx.fillRect(x + ww + 3, ty, 6, 6)
  }
}

// ---------------------------------------------------------------------------
// SPARKS — one factory, two surfaces: the decode spark (kpiHist.tps) and the
// gpu-draw plate trace. Each normalises to its own peak so a quiet feed
// still reads.
// ---------------------------------------------------------------------------

export function paintSpark(ctx, w, h, c, series, tone) {
  if (w < 40 || h < 10) return
  const p = c.palette
  const col = tone === 'col' ? p.col : tone === 'alm' ? p.alm : p.acc
  const s = (series || []).slice(-60)
  if (s.length < 2) return
  let peak = 0
  let base = Infinity
  for (const v of s) {
    if (v > peak) peak = v
    if (v < base) base = v
  }
  if (!isFinite(base)) base = 0
  if (peak - base < 1e-6) {
    peak = base + 1
  }
  const n = s.length
  const xOf = (i) => (i / (n - 1)) * (w - 2) + 1
  const yOf = (v) => h - 2 - ((v - base) / (peak - base)) * (h - 5)
  // grid
  ctx.strokeStyle = rgba(p.dat, 0.06)
  ctx.lineWidth = 1
  for (let i = 1; i < 4; i++) {
    const y = Math.round((i / 4) * h) + 0.5
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(xOf(0), yOf(s[0]))
  for (let i = 1; i < n; i++) ctx.lineTo(xOf(i), yOf(s[i]))
  ctx.save()
  ctx.lineTo(xOf(n - 1), h)
  ctx.lineTo(xOf(0), h)
  ctx.closePath()
  const ag = ctx.createLinearGradient(0, 0, 0, h)
  ag.addColorStop(0, rgba(col, 0.35))
  ag.addColorStop(0.6, rgba(col, 0.08))
  ag.addColorStop(1, rgba(col, 0.02))
  ctx.fillStyle = ag
  ctx.fill()
  ctx.restore()
  ctx.beginPath()
  ctx.moveTo(xOf(0), yOf(s[0]))
  for (let i = 1; i < n; i++) ctx.lineTo(xOf(i), yOf(s[i]))
  ctx.save()
  ctx.shadowColor = rgba(col, 0.85)
  ctx.shadowBlur = 6
  ctx.strokeStyle = rgba(col, 1)
  ctx.lineWidth = 1.4
  ctx.stroke()
  ctx.restore()
  // the head
  const lv = s[n - 1]
  ctx.fillStyle = rgba(col, 1)
  ctx.fillRect(xOf(n - 1) - 1.5, yOf(lv) - 1.5, 3, 3)
}

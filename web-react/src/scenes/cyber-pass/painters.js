// Cyber-pass canvas painters. Registered through SceneCanvas; every one is a
// pure function of the conductor (master clock, latest snapshot, active
// palette). No timers, no wall clock, no per-painter accumulators: every
// phase derives from c.t, so a held feed freezes cleanly and reduced motion
// settles on one valid frame of the latest data.
//
// The reference's 13 canvases, grouped by surface:
//   paintBulbRail   rail-cv          the bare-bulb wire (14 sockets)
//   paintDevBody    dv-body          the handheld: metal, lens housing, keys,
//                                    plate, grip, coiled cord, callout leaders
//   paintDevLive    dv-live          CRT face (hum scope, SOS/model face,
//                                    lamp word, reading bar), the lamp lens,
//                                    pressed key
//   paintChart      ch-cv + ch-fx    the posted-price chart: the year of closes
//                                    (acc) across the break to today's steps
//                                    (dat), the held NOW marker, the TIN line,
//                                    the DAYS marginal, the precedent-scan band
//   paintTicker     tk-cv            the tap tape (VT323, newest at the right)
//   paintTin        tin-cv           the declared tin as a 25×8 button grid
//   paintBox        sb-cv            the strongbox step chart, runner marks
//   paintCistern    cs-cv            the cistern tank (vram used-window)
//   paintSpark      t-cv/ld-cv       assays spark + generator load trace
//   paintTally      tm-cv            stoops as tally marks
//   paintWeather    wx-cv            wind vane + cinder-fall bins (decorative)
//
// Colours come from c.palette ("R G B" channels); neutral shading uses plain
// black/white alphas (no hue); the only hard-coded colour is the absolute
// alarm red (ALM) where severity, not palette, is the meaning.

import { genStats, priceStats, readingOf, talliesOf, assayLamp, docketOf, tinSpentOf, staleOf, decode01, activeModelOf } from './shared'

const chan = (s) => String(s || '0 0 0').trim().split(/\s+/).map(Number)
const clamp01 = (a) => (a < 0 ? 0 : a > 1 ? 1 : a)
const rgba = (s, a) => `rgba(${chan(s).join(',')},${clamp01(a)})`
const lerp = (a, b, t) => a + (b - a) * t
const det = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
const grp = (n) => Math.round(n).toLocaleString('en-US')

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
// BULB RAIL — one wire, fourteen bare bulbs on GEN-1. Lit level follows the
// generator bus (load from host cpu + gpu power); dead sockets are the down
// engines (offline: all dark). Shimmer is a slow deterministic drift seeded
// on the master clock, gated on the decode rate; stale and reduced motion
// hold the frame still.
// ---------------------------------------------------------------------------

export function paintBulbRail(ctx, w, h, c) {
  if (w < 24 || h < 12) return
  const p = c.palette
  const t = c.t
  const anim = !c.reduced
  const snap = c.snap
  const g = genStats(snap, snap && snap.gpu, snap && snap.host)
  const volt = 230 - 6 * (g.kw / 3) - g.load * 8
  const base = Math.pow(Math.max(0, volt) / 230, 3.4)

  const x0 = w * 0.13
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

  // the wire: faint cable + a warm catch-light along its top
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
  const deadSet = new Set(g.dead)
  const held = staleOf(snap)
  for (let i = 0; i < 14; i++) {
    const x = lerp(x0, x1, (i + 0.5) / 14)
    const cord = 0.08 + 0.12 * det(i * 7.7)
    const wy = wireY(x)
    const sy = wy + h * cord
    const L = deadSet.has(i) ? 0 : base * (anim && !held ? 0.86 + 0.14 * Math.sin(t * (0.7 + det(i * 3.1) * 0.6) + i * 2.1) : 1)
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
    if (L > 0) {
      const halo = ctx.createRadialGradient(x, cy, 0, x, cy, h * 1.15)
      halo.addColorStop(0, rgba(p.dat, 0.55 * L))
      halo.addColorStop(1, rgba(p.dat, 0))
      ctx.fillStyle = halo
      ctx.fillRect(x - h * 1.2, cy - h * 1.2, 2.4 * h, 2.4 * h)
      const gg = ctx.createRadialGradient(x, cy - ry * 0.25, 0, x, cy, ry)
      gg.addColorStop(0, `rgba(255,250,242,${0.3 + 0.7 * L})`)
      gg.addColorStop(0.55, rgba(p.dat, 0.25 + 0.7 * L))
      gg.addColorStop(1, rgba(p.acc, 0.25 + 0.5 * L))
      ctx.fillStyle = gg
      ctx.beginPath()
      ctx.ellipse(x, cy, r, ry, 0, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.beginPath()
      ctx.ellipse(x, cy, r, ry, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = rgba(p.acc, 0.3)
      ctx.lineWidth = 0.8
      ctx.stroke()
      ctx.strokeStyle = rgba(p.dat, 0.35)
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
// THE ASSAY DEVICE — two stacked canvases, as the reference's dv-body /
// dv-live. One pure layout for both: the device is scaled into the canvas
// (62 % width when the co-card column is shown, full width when it is not).
// ---------------------------------------------------------------------------

const devGeo = new Map()
function devLayout(w, h) {
  const key = `${w}x${h}`
  const hit = devGeo.get(key)
  if (hit) return hit
  const short = h < 300
  const noCo = w < 320
  const gripU = short ? 34 : 96
  const totU = 72 + 318 + gripU + 4
  const u = Math.max(0.2, Math.min((w * (noCo ? 0.94 : 0.6)) / 380, (h - 4) / totU))
  const X = noCo ? Math.round((w - 380 * u) / 2) : Math.round(Math.min(10, w * 0.03))
  const Y = Math.round(Math.max(2, (h - totU * u) / 2))
  const g = {
    w, h, u, X, Y, noCo,
    head: { x: X + 38 * u, y: Y + 2 * u, w: 304 * u, h: 64 * u, r: 12 * u },
    lens: { x: X + 64 * u, y: Y + 18 * u, w: 252 * u, h: 32 * u, r: 5 * u },
    body: { x: X, y: Y + 72 * u, w: 380 * u, h: 318 * u, r: 24 * u },
    bezel: { x: X + 15 * u, y: Y + 89 * u, w: 350 * u, h: 214 * u, r: 14 * u },
    crt: { x: X + 24 * u, y: Y + 98 * u, w: 332 * u, h: 196 * u, r: 10 * u },
    plate: { x: X + 34 * u, y: Y + 357 * u, w: 312 * u, h: 22 * u, r: 3 * u },
    grip: { x: X + 124 * u, y: Y + 388 * u, w: 132 * u, h: gripU * u },
    right: X + 380 * u,
  }
  const kw = 78 * u
  const kg = 9 * u
  const kx0 = X + (380 * u - (4 * kw + 3 * kg)) / 2
  g.keys = [0, 1, 2, 3].map((i) => ({ x: kx0 + i * (kw + kg), y: Y + 314 * u, w: kw, h: 34 * u, r: 5 * u, i }))
  // co-card leader anchors (the cards are DOM, positioned by Scene)
  g.leaders = [
    { ay: g.lens.y + g.lens.h / 2, fy: 0.09 },
    { ay: g.crt.y + g.crt.h * 0.5, fy: 0.36 },
    { ay: g.keys[0].y + g.keys[0].h / 2, fy: 0.62 },
    { ay: g.plate.y + g.plate.h / 2, fy: 0.8 },
  ]
  if (devGeo.size > 24) devGeo.clear()
  devGeo.set(key, g)
  return g
}

function gripPath(ctx, g) {
  const gr = g.grip
  const u = g.u
  const r = Math.min(26 * u, gr.h * 0.5)
  ctx.beginPath()
  ctx.moveTo(gr.x, gr.y)
  ctx.lineTo(gr.x + gr.w, gr.y)
  ctx.lineTo(gr.x + gr.w - 6 * u, gr.y + gr.h - r)
  ctx.quadraticCurveTo(gr.x + gr.w - 6 * u, gr.y + gr.h, gr.x + gr.w - 6 * u - r, gr.y + gr.h)
  ctx.lineTo(gr.x + 6 * u + r, gr.y + gr.h)
  ctx.quadraticCurveTo(gr.x + 6 * u, gr.y + gr.h, gr.x + 6 * u, gr.y + gr.h - r)
  ctx.closePath()
}

// The boot-key chips keep the reference's four ranks, re-tuned onto tokens:
// GREY takes the cool role, TAN the data cream, RED the held alarm, BLACK a
// dark ringed chip.
const BOOT_CHIP = [
  (p) => rgba(p.col, 0.55),
  (p) => rgba(p.dat, 0.85),
  (p) => rgba(p.alm, 0.8),
  (p) => rgba(p.acc, 0.22),
]

export function paintDevBody(ctx, w, h, c) {
  if (w < 60 || h < 60) return
  const g = devLayout(w, h)
  const p = c.palette
  const u = g.u

  // cast shadow on the plate
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
  gripPath(ctx, g)
  ctx.fill()
  ctx.restore()

  // oxidised steel: dark fill, accent wash, edge light from the bulbs above
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
    // rust bloom: deterministic speckles tinted by the accent
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

  // grip with knurling
  const grip = () => gripPath(ctx, g)
  metal(grip, g.grip.x, g.grip.y, g.grip.x + g.grip.w, g.grip.y + g.grip.h)
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'
  ctx.lineWidth = Math.max(1, 1.6 * u)
  for (let y = g.grip.y + 10 * u; y < g.grip.y + g.grip.h - 12 * u; y += 9 * u) {
    ctx.beginPath()
    ctx.moveTo(g.grip.x + 14 * u, y)
    ctx.lineTo(g.grip.x + g.grip.w - 14 * u, y)
    ctx.stroke()
    ctx.strokeStyle = rgba(p.dat, 0.07)
    ctx.beginPath()
    ctx.moveTo(g.grip.x + 14 * u, y + 1.2)
    ctx.lineTo(g.grip.x + g.grip.w - 14 * u, y + 1.2)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
  }

  metal(bodyPath, g.body.x, g.body.y, g.body.x + g.body.w, g.body.y + g.body.h)
  metal(headPath, g.head.x, g.head.y, g.head.x + g.head.w, g.head.y + g.head.h)

  // lens housing recess
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

  // the four boot keys (the officer enters the boots by hand)
  const kf = Math.max(8, 11 * u)
  g.keys.forEach((k, i) => {
    const kg = ctx.createLinearGradient(0, k.y, 0, k.y + k.h)
    kg.addColorStop(0, 'rgba(0,0,0,0.5)')
    kg.addColorStop(1, 'rgba(0,0,0,0.72)')
    ctx.fillStyle = kg
    rrPath(ctx, k.x, k.y, k.w, k.h, k.r)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.strokeStyle = rgba(p.dat, 0.1)
    ctx.beginPath()
    ctx.moveTo(k.x + k.r, k.y + 1)
    ctx.lineTo(k.x + k.w - k.r, k.y + 1)
    ctx.stroke()
    const sw = Math.max(4, 10 * u)
    ctx.fillStyle = BOOT_CHIP[i](p)
    ctx.fillRect(k.x + 7 * u, k.y + k.h * 0.26, sw, k.h * 0.48)
    if (i === 3) {
      ctx.strokeStyle = rgba(p.dat, 0.4)
      ctx.strokeRect(k.x + 7 * u + 0.5, k.y + k.h * 0.26 + 0.5, sw - 1, k.h * 0.48 - 1)
    }
    if (u >= 0.5) {
      ctx.font = `600 ${kf.toFixed(1)}px Rubik, system-ui, sans-serif`
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(p.dat, 0.72)
      const labels = ['GREY', 'TAN', 'RED', 'BLACK']
      ctx.fillText(labels[i], k.x + 7 * u + sw + 5 * u, k.y + k.h / 2 + 0.5)
    }
  })

  // the engraved plate
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
  const long = 'ASSAY · SERIAL 0061-K · 61 YR · NO MANUAL'
  const shortT = '0061-K · 61 YR · NO MANUAL'
  const txt = ctx.measureText(long).width < pl.w - 10 * u ? long : shortT
  ctx.fillStyle = 'rgba(0,0,0,0.8)'
  ctx.fillText(txt, pl.x + pl.w / 2, pl.y + pl.h / 2 + 1)
  ctx.fillStyle = rgba(p.dat, 0.5)
  ctx.fillText(txt, pl.x + pl.w / 2, pl.y + pl.h / 2)

  // head legend + lanyard ring
  if (u >= 0.45) {
    ctx.font = `600 ${Math.max(8, 9.5 * u).toFixed(1)}px Rubik, system-ui, sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = rgba(p.dat, 0.34)
    ctx.fillText('LAMP', g.head.x + 26 * u, g.head.y + g.head.h - 8 * u)
  }
  ctx.strokeStyle = rgba(p.acc, 0.4)
  ctx.lineWidth = Math.max(1.2, 3 * u)
  ctx.beginPath()
  ctx.arc(g.grip.x + g.grip.w / 2, g.grip.y + g.grip.h + 5 * u, 7 * u, Math.PI * 0.1, Math.PI * 0.9, true)
  ctx.stroke()

  // the coiled cord: the device is tethered to the post terminal
  const gx1 = g.grip.x + g.grip.w - 8 * u
  const gy1 = g.grip.y + g.grip.h - 14 * u
  if (w - gx1 > 60 && g.grip.h > 50) {
    const p0 = [gx1, gy1]
    const p3 = [w + 8, h - 3]
    const sagY = Math.max(p0[1], p3[1]) + Math.max(6, (h - gy1) * 0.35)
    const p1 = [p0[0] + 26 * u, sagY]
    const p2 = [p3[0] - (p3[0] - p0[0]) * 0.45, sagY]
    const bez = (tt, i) => {
      const m = 1 - tt
      return m * m * m * p0[i] + 3 * m * m * tt * p1[i] + 3 * m * tt * tt * p2[i] + tt * tt * tt * p3[i]
    }
    const loops = 16
    const rad = Math.max(2.5, 6 * u)
    ctx.lineCap = 'round'
    for (const [col, lw, dy] of [
      ['rgba(0,0,0,0.55)', Math.max(2.2, 3.4 * u), 1.5],
      ['rgba(0,0,0,0.35)', Math.max(1.6, 2.6 * u), 0],
      [rgba(p.dat, 0.16), Math.max(0.6, 0.9 * u), -0.8],
    ]) {
      ctx.strokeStyle = col
      ctx.lineWidth = lw
      ctx.beginPath()
      for (let i = 0; i <= 480; i++) {
        const tt = i / 480
        const x = bez(tt, 0)
        const y = bez(tt, 1)
        const dx = bez(Math.min(1, tt + 0.002), 0) - bez(Math.max(0, tt - 0.002), 0)
        const dy2 = bez(Math.min(1, tt + 0.002), 1) - bez(Math.max(0, tt - 0.002), 1)
        const L = Math.hypot(dx, dy2) || 1
        const nx = -dy2 / L
        const ny = dx / L
        const ph = tt * loops * Math.PI * 2
        const px = x + nx * rad * Math.sin(ph) + (dx / L) * rad * 0.55 * Math.cos(ph)
        const py = y + ny * rad * Math.sin(ph) + (dy2 / L) * rad * 0.55 * Math.cos(ph) + dy
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
    }
    ctx.lineCap = 'butt'
  }

  // callout leaders to the DOM co-cards
  if (!g.noCo) {
    ctx.lineWidth = 1
    ctx.strokeStyle = rgba(p.dat, 0.5)
    ctx.fillStyle = rgba(p.dat, 0.85)
    for (const L of g.leaders) {
      const y = L.fy * h
      ctx.beginPath()
      ctx.moveTo(L.ay, g.right)
      ctx.lineTo(g.right + 18, y)
      ctx.stroke()
      ctx.fillRect(L.ay - 1.5, g.right - 3, 3, 3)
    }
  }
}

// ---------------------------------------------------------------------------
// dv-live: the CRT face, the lamp lens, the pressed key. The lamp word lands
// after the assay inrush (helix.kick from request_arrived): while the kick is
// high the face reads ASSAYING and a warm bar sweeps; settled (reduced
// motion) the face shows the final lamp straight.
// ---------------------------------------------------------------------------

export function paintDevLive(ctx, w, h, c) {
  if (w < 60 || h < 60) return
  const g = devLayout(w, h)
  const p = c.palette
  const u = g.u
  const t = c.t
  const anim = !c.reduced
  const snap = c.snap
  const stale = staleOf(snap)
  const lamp = assayLamp(snap, c.alert)
  const rd = readingOf(c, snap)
  const act = activeModelOf(snap)
  // the booth remembers the last assayed model across a held feed: a plain
  // scene-local hold (no store), read back by the SOS face below.
  if (!stale) {
    if (act.model) lastSeen.model = act.model
    if (act.tps != null) lastSeen.tps = Math.round(act.tps)
    if (act.temp != null) lastSeen.temp = Math.round(act.temp)
  }
  const kick = anim && !stale ? Math.max(0, c.helix.kick || 0) : 0
  const warming = kick > 0.3
  const word = warming ? null : lamp === 'A' ? 'AMBER' : 'VIOLET'
  const B = stale ? 0.42 : warming ? 0.5 + 0.4 * (1 - kick) : 0.85

  const tickSec = Math.max(0, Math.floor((snap && snap.t) || 0))
  const hm = `${String(Math.floor((9 * 3600 + 52 * 60 + tickSec) / 3600) % 24).padStart(2, '0')}:${String(Math.floor(((9 * 3600 + 52 * 60 + tickSec) / 60) % 60) % 60).padStart(2, '0')}`

  const tallies = talliesOf(snap)
  const g2 = genStats(snap, snap && snap.gpu, snap && snap.host)
  const dk = docketOf(snap)

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

  // GEN-1's hum: a soft band of extra beam current rolling up the face
  const phBand = anim ? (t * 0.2) % 1 : 0.35
  const sBand = g.crt.h * 0.13
  const yc = lerp(g.crt.y + g.crt.h + 2.4 * sBand, g.crt.y - 2.4 * sBand, phBand)
  const hg = ctx.createLinearGradient(0, yc - 2.4 * sBand, 0, yc + 2.4 * sBand)
  hg.addColorStop(0, rgba(p.dat, 0))
  hg.addColorStop(0.5, rgba(p.dat, 0.06))
  hg.addColorStop(1, rgba(p.dat, 0))
  ctx.fillStyle = hg
  ctx.fillRect(g.crt.x, yc - 2.4 * sBand, g.crt.w, 4.8 * sBand)

  const pad = Math.max(5, g.crt.h * 0.06)
  const hdrF = Math.min(14, Math.max(10, g.crt.h * 0.082))
  const lineF = Math.min(19, Math.max(11, g.crt.h * 0.105))
  const wordF = Math.min(58, g.crt.w * 0.26, g.crt.h * 0.42)
  const ink = (a) => rgba(p.dat, a * (0.35 + 0.65 * B))

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  const y1 = g.crt.y + pad + hdrF * 0.62
  ctx.font = `${hdrF.toFixed(1)}px "VT323", ui-monospace, monospace`
  ctx.fillStyle = ink(0.62)
  const hdrL = stale ? `0061-K · SOS · ${hm}` : `0061-K · ${warming ? 'ASSAY IN PROGRESS' : lamp === 'A' ? 'SEQ ' + dk : 'RE-ASSAY'} · ${hm}`
  ctx.fillText(hdrL, g.crt.x + pad, y1)
  const rdTxt = `READ ${rd.toFixed(3)}`
  ctx.textAlign = 'right'
  ctx.fillText(rdTxt, g.crt.x + g.crt.w - pad, y1)
  ctx.textAlign = 'left'

  // the lamp word (the only large type on the face)
  const y2 = y1 + Math.max(4, g.crt.h * 0.045) + wordF * 0.6
  ctx.font = `${wordF.toFixed(1)}px "VT323", ui-monospace, monospace`
  if (stale) {
    // SOS broadcast face: held alarm styling, steady — the alarm never blinks.
    ctx.save()
    ctx.shadowColor = rgba(p.alm, 0.7 * B)
    ctx.shadowBlur = 14 * u
    ctx.fillStyle = rgba(p.alm, 1)
    ctx.fillText('SOS', g.crt.x + pad, y2)
    ctx.restore()
  } else if (warming) {
    const dots = '·'.repeat(1 + Math.floor((1 - kick) * 5))
    ctx.fillStyle = ink(0.75)
    ctx.fillText('ASSAYING ' + dots, g.crt.x + pad, y2 - wordF * 0.18)
  } else if (word) {
    ctx.save()
    ctx.shadowColor = rgba(p.dat, 0.7 * B)
    ctx.shadowBlur = 14 * u
    ctx.fillStyle = ink(1)
    ctx.fillText(word, g.crt.x + pad, y2)
    ctx.restore()
  }

  // the hum scope (right of the widest lamp word, VIOLET)
  const sx0 = g.crt.x + pad + ctx.measureText('VIOLET').width + Math.max(8, g.crt.w * 0.035)
  const sx1 = g.crt.x + g.crt.w - pad
  const sy0 = y1 + Math.max(4, g.crt.h * 0.05)
  const sy1 = y2 + 2
  if (sx1 - sx0 > 30 && sy1 - sy0 > 16) {
    const sym = (sy0 + sy1) / 2
    ctx.strokeStyle = ink(0.16)
    ctx.lineWidth = 1
    ctx.strokeRect(sx0 + 0.5, sy0 + 0.5, sx1 - sx0 - 1, sy1 - sy0 - 1)
    for (let i = 1; i < 4; i++) {
      const yy = lerp(sy0, sy1, i / 4)
      ctx.beginPath()
      ctx.moveTo(sx0, yy)
      ctx.lineTo(sx1, yy)
      ctx.stroke()
    }
    ctx.strokeStyle = ink(0.85)
    ctx.lineWidth = Math.max(1, 1.3 * u)
    ctx.beginPath()
    const N = 48
    const alertA = Math.min(1, c.alert)
    for (let i = 0; i <= N; i++) {
      const tt = i / N
      let v = 0.5 + 0.18 * Math.sin(2 * Math.PI * 0.8 * t + tt * 9) + 0.12 * Math.sin(2 * Math.PI * 0.23 * t + tt * 4 + 1.3)
      v += alertA * 0.25 * Math.sin(2 * Math.PI * 6 * t + tt * 14)
      const x = lerp(sx0 + 1, sx1 - 1, tt)
      const y = lerp(sy1 - 2, sy0 + 2, Math.max(0, Math.min(1, v)))
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.font = `${Math.max(10, hdrF * 0.86).toFixed(1)}px "VT323", ui-monospace, monospace`
    ctx.fillStyle = ink(0.5)
    ctx.fillText('HUM ' + g2.hz + ' HZ', sx0 + 3, sy1 - 3)
  }

  // the assay readout, as the device prints it: the active model with live
  // tok/s + temp in booth voice; held last-model SOS face when the feed is
  // stale (boots/stoops dressing removed — the screen names the inference).
  const y3 = y2 + Math.max(5, g.crt.h * 0.06) + lineF * 0.62
  const y4 = y3 + lineF * 1.02
  ctx.font = `${lineF.toFixed(1)}px "VT323", ui-monospace, monospace`
  ctx.fillStyle = ink(0.92)
  const tpsS = !stale && act.tps != null ? `${Math.round(act.tps)} TOK/S` : stale && lastSeen.tps != null ? `${lastSeen.tps} TOK/S` : '— TOK/S'
  const tempS = !stale && act.temp != null ? `${Math.round(act.temp)}°C` : stale && lastSeen.temp != null ? `${lastSeen.temp}°C` : '—'
  const lineB = stale
    ? `SOS · HOLDING LAST MODEL · ${lastSeen.model || 'NO MODEL'}`
    : warming ? `${dk} · ····· · STAMPING ···` : `${act.model || 'NO MODEL'} · ${tpsS} · ${tempS}`
  ctx.fillText(lineB, g.crt.x + pad, y3)
  const lineC = stale
    ? `HELD · ${tpsS} · ${tempS}`
    : warming ? `SEQ ${dk} · PROBING ···` : `SEQ ${dk} · LAMP ${word} · Q ${act.queue != null ? Math.round(act.queue) : '—'} · P95 ${act.p95 != null ? Math.round(act.p95) : '—'}`
  ctx.fillStyle = ink(0.92)
  ctx.fillText(lineC, g.crt.x + pad, y4)
  if (!warming && !stale) {
    const ex = ctx.measureText(lineC).width
    ctx.fillStyle = ink(0.8)
    ctx.fillRect(g.crt.x + pad + ex + 2, y4 - lineF * 0.55, lineF * 0.4, lineF * 0.6)
  }

  // the reading bar and the footer
  const y5 = y4 + lineF * 1.05
  if (y5 + lineF * 0.3 < g.crt.y + g.crt.h - pad - hdrF * 1.1) {
    const bx0 = g.crt.x + pad + lineF * 2.2
    const bx1 = g.crt.x + g.crt.w * 0.62
    const bh = Math.max(3, lineF * 0.34)
    const ym = y5 - bh / 2
    ctx.font = `${hdrF.toFixed(1)}px "VT323", ui-monospace, monospace`
    ctx.fillStyle = ink(0.55)
    ctx.fillText('READ', g.crt.x + pad, y5)
    ctx.strokeStyle = ink(0.3)
    ctx.lineWidth = 1
    ctx.strokeRect(bx0 + 0.5, y5 - bh - 0.5, bx1 - bx0, bh)
    for (let i = 1; i < 4; i++) {
      const tx = lerp(bx0, bx1, i / 4)
      ctx.fillStyle = ink(0.3)
      ctx.fillRect(tx, y5 - bh - 2.5, 1, 2)
    }
    ctx.fillStyle = ink(0.78)
    ctx.fillRect(bx0 + 1, y5 - bh, (bx1 - bx0 - 1) * Math.max(0, rd), bh - 1)
    ctx.fillStyle = ink(0.6)
    ctx.fillText(`${rd.toFixed(3)} · STAMPED`, bx1 + 6, y5)
  }
  const yf = g.crt.y + g.crt.h - pad
  if (g.crt.h > 108) {
    ctx.font = `${hdrF.toFixed(1)}px "VT323", ui-monospace, monospace`
    ctx.fillStyle = ink(0.42)
    ctx.fillText(`TODAY ${grp(tallies.stoops)} STAMPED · AMBER ${tallies.amb} · VIOLET ${tallies.vio}`, g.crt.x + pad, yf)
  }

  // the warm-up sweep: the lamp charging, a bar of light down the face
  if (warming) {
    const sy = g.crt.y + g.crt.h * Math.max(0, Math.min(1, 1 - kick))
    const sg = ctx.createLinearGradient(0, sy - 16 * u, 0, sy + 4 * u)
    sg.addColorStop(0, rgba(p.dat, 0))
    sg.addColorStop(0.8, rgba(p.dat, 0.22))
    sg.addColorStop(1, rgba(p.dat, 0))
    ctx.fillStyle = sg
    ctx.fillRect(g.crt.x, sy - 16 * u, g.crt.w, 20 * u)
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

  // the lamp lens: amber when the set is up, violet when any engine is down;
  // held dim while the feed is stale (dormant booth: HELD, never dark).
  const L = stale ? 0.16 : lamp === 'A' ? 0.75 : 0.85
  const ln = g.lens
  const col = lamp === 'A' ? p.acc : p.col
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

  // the entered key stays down through the inrush
  if (warming) {
    const k = g.keys[lamp === 'A' ? 1 : 0]
    ctx.save()
    rrPath(ctx, k.x, k.y, k.w, k.h, k.r)
    ctx.clip()
    ctx.fillStyle = rgba(p.dat, 0.16 * kick)
    ctx.fillRect(k.x, k.y, k.w, k.h)
    ctx.restore()
    ctx.strokeStyle = rgba(p.dat, 0.45 * kick)
    ctx.lineWidth = 1
    rrPath(ctx, k.x, k.y, k.w, k.h, k.r)
    ctx.stroke()
  }

  // the lamp's light on the plate at the moment it lights (one-shot wash)
  if (warming) {
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

// The booth's held memory: the last assayed model + figures, read back by
// the SOS face while the feed is stale. Scene-local (this module only),
// never a store; the device screen is the only reader.
const lastSeen = { model: null, tps: null, temp: null }

// A stable hash of the snapshot's docket inputs, for deterministic dressing.
function hashCodeId(snap) {
  const k = snap && snap.kpi
  const s = `${k && k.tps != null ? Math.round(k.tps) : 0}:${(snap && snap.t) || 0}`
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

// ---------------------------------------------------------------------------
// THE EXCHANGE CHART — one canvas carries the reference's ch-cv + ch-fx:
// a year of closes (acc) across the axis break to today's posted steps (dat),
// the hatched future, the held NOW marker in the alarm colour, the violet TIN
// declaration line, the marginal DAYS histogram and the precedent-scan band
// that walks the year after each re-post. The series is kpiHist.vram — the
// overflow phase is the reference's spike.
// ---------------------------------------------------------------------------

export function paintChart(ctx, w, h, c) {
  if (w < 120 || h < 60) return
  const p = c.palette
  const t = c.t
  const anim = !c.reduced
  const snap = c.snap
  const hist = (((snap && snap.kpiHist && snap.kpiHist.vram) || []) .slice())
  if (hist.length < 4) return
  const pr = priceStats(snap)
  const cur = pr.price != null ? pr.price : hist[hist.length - 1]

  const mL = 34
  const mR = w - 46
  const mT = 16
  const mB = h - 18
  const plotW = mR - mL
  const ph = mB - mT
  // the axis break: the year takes 55 % of the plot, today the rest
  const xBreak = mL + plotW * 0.55
  const breakGap = 6
  const x2 = xBreak + breakGap
  const x3 = mR
  const futureW = Math.max(6, plotW * 0.055)
  const xNow = x3 - futureW

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
  const yOf = (v) => mT + (1 - (v - yLo) / (yHi - yLo)) * ph

  const n = hist.length
  const split = Math.floor(n * 0.55)
  const year = hist.slice(0, split)
  const today = hist.slice(split)
  const xYear = (i) => mL + (i / (year.length - 1 || 1)) * (xBreak - mL)
  const xToday = (i) => x2 + (i / (today.length - 1 || 1)) * (xNow - x2)
  const xIdx = (i) => (i < split ? xYear(i) : xToday(i - split))

  // plot ground + grid
  const bg = ctx.createLinearGradient(0, mT, 0, mB)
  bg.addColorStop(0, rgba(p.dat, 0.03))
  bg.addColorStop(1, rgba(p.dat, 0))
  ctx.fillStyle = bg
  ctx.fillRect(mL, mT, mR - mL, ph)
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
    ctx.lineTo(xBreak, y)
    ctx.moveTo(x2, y)
    ctx.lineTo(x3, y)
    ctx.stroke()
    if (Math.round(v / step) % 2 === 0) {
      ctx.fillStyle = rgba(p.dat, 0.6)
      ctx.fillText(String(Math.round(v)), mL - 6, y)
    }
  }
  // x labels: the year in quarters, today by the hour
  ctx.textBaseline = 'top'
  const qs = [
    [0, '−12 MO'],
    [0.25, '−9'],
    [0.5, '−6'],
    [0.75, '−3'],
  ]
  for (const [f, s] of qs) {
    const x = Math.round(mL + f * (xBreak - mL)) + 0.5
    ctx.strokeStyle = rgba(p.dat, 0.06)
    ctx.beginPath()
    ctx.moveTo(x, mT)
    ctx.lineTo(x, mB)
    ctx.stroke()
    ctx.fillStyle = rgba(p.dat, 0.55)
    ctx.textAlign = f === 0 ? 'left' : 'center'
    ctx.fillText(s, x, mB + 4)
  }
  const tick0 = Math.max(0, Math.floor((snap && snap.t) || 0))
  for (let i = today.length; i >= 4; i -= Math.max(4, Math.ceil(today.length / 6))) {
    const x = Math.round(xToday(i - 1)) + 0.5
    ctx.strokeStyle = rgba(p.dat, 0.06)
    ctx.beginPath()
    ctx.moveTo(x, mT)
    ctx.lineTo(x, mB)
    ctx.stroke()
    const hh = 6 + Math.floor((tick0 - i) / 60) % 24
    const mm = Math.floor(((tick0 - i) % 60) / 60) * 60
    ctx.fillStyle = rgba(p.dat, 0.55)
    ctx.textAlign = 'center'
    ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, x, mB + 4)
  }
  ctx.strokeStyle = rgba(p.dat, 0.25)
  ctx.beginPath()
  ctx.moveTo(mL, mB + 0.5)
  ctx.lineTo(xBreak, mB + 0.5)
  ctx.moveTo(x2, mB + 0.5)
  ctx.lineTo(x3, mB + 0.5)
  ctx.stroke()
  // the axis break
  ctx.strokeStyle = rgba(p.dat, 0.45)
  ctx.lineWidth = 1
  for (const y of [mB, mT]) {
    ctx.beginPath()
    ctx.moveTo(xBreak + 2, y + 4)
    ctx.lineTo(xBreak + 6, y - 4)
    ctx.moveTo(x2 - 6, y + 4)
    ctx.lineTo(x2 - 2, y - 4)
    ctx.stroke()
  }
  // the future: hatched, not drawn
  if (x3 - xNow > 2) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(xNow, mT, x3 - xNow, ph)
    ctx.clip()
    ctx.strokeStyle = rgba(p.dat, 0.08)
    ctx.lineWidth = 1
    for (let x = xNow - ph; x < x3; x += 7) {
      ctx.beginPath()
      ctx.moveTo(x, mB)
      ctx.lineTo(x + ph, mT)
      ctx.stroke()
    }
    ctx.restore()
  }

  // twelve months of closes (acc), with body
  ctx.beginPath()
  ctx.moveTo(xYear(0), yOf(year[0]))
  for (let i = 1; i < year.length; i++) ctx.lineTo(xYear(i), yOf(year[i]))
  ctx.save()
  ctx.lineTo(xYear(year.length - 1), mB)
  ctx.lineTo(xYear(0), mB)
  ctx.closePath()
  const yl = ctx.createLinearGradient(0, mT, 0, mB)
  yl.addColorStop(0, rgba(p.acc, 0.3))
  yl.addColorStop(0.45, rgba(p.acc, 0.07))
  yl.addColorStop(1, rgba(p.acc, 0.02))
  ctx.fillStyle = yl
  ctx.fill()
  ctx.restore()
  ctx.beginPath()
  ctx.moveTo(xYear(0), yOf(year[0]))
  for (let i = 1; i < year.length; i++) ctx.lineTo(xYear(i), yOf(year[i]))
  ctx.save()
  ctx.shadowColor = rgba(p.acc, 0.7)
  ctx.shadowBlur = 6
  ctx.strokeStyle = rgba(p.acc, 0.95)
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.restore()
  // across the break: yesterday's close to this morning's open
  ctx.setLineDash([2, 3])
  ctx.strokeStyle = rgba(p.dat, 0.6)
  ctx.beginPath()
  ctx.moveTo(xBreak, yOf(year[year.length - 1]))
  ctx.lineTo(x2, yOf(today[0]))
  ctx.stroke()
  ctx.setLineDash([])

  // today: the posted price as steps, with body
  const pts = []
  let prevP = today[0]
  for (let i = 0; i < today.length; i++) {
    const x = xToday(i)
    pts.push([x, yOf(prevP)])
    if (i < today.length - 1) pts.push([x, yOf(today[i + 1])])
    prevP = today[i + 1]
  }
  pts.push([xNow, yOf(cur)])
  const tb = ctx.createLinearGradient(0, mT, 0, mB)
  tb.addColorStop(0, rgba(p.dat, 0.4))
  tb.addColorStop(0.5, rgba(p.dat, 0.14))
  tb.addColorStop(1, rgba(p.dat, 0.03))
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (const q of pts) ctx.lineTo(q[0], q[1])
  ctx.lineTo(xNow, mB)
  ctx.lineTo(pts[0][0], mB)
  ctx.closePath()
  ctx.fillStyle = tb
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length - 1; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.save()
  ctx.shadowColor = rgba(p.dat, 0.9)
  ctx.shadowBlur = 8
  ctx.strokeStyle = rgba(p.dat, 1)
  ctx.lineWidth = 1.8
  ctx.stroke()
  ctx.restore()
  // the NOW marker, held in the alarm colour (never blinked)
  const lastY = yOf(cur)
  ctx.save()
  ctx.shadowColor = rgba(p.alm, 1)
  ctx.shadowBlur = 10
  ctx.strokeStyle = rgba(p.alm, 1)
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(pts[pts.length - 2][0], lastY)
  ctx.lineTo(xNow, lastY)
  ctx.stroke()
  ctx.fillStyle = rgba(p.alm, 1)
  ctx.fillRect(xNow - 2.5, lastY - 2.5, 5, 5)
  ctx.restore()
  ctx.fillStyle = 'rgba(255,253,240,0.9)'
  ctx.fillRect(xNow - 1, lastY - 1, 2, 2)

  // the declaration: the latest single-step spike (the tin on the table)
  let spikeI = -1
  for (let i = Math.max(1, today.length - 30); i < today.length; i++) {
    if (today[i] - today[i - 1] > (yHi - yLo) * 0.02) spikeI = i
  }
  if (spikeI > 0) {
    const xd = Math.round(xToday(spikeI)) + 0.5
    ctx.setLineDash([3, 3])
    ctx.strokeStyle = rgba(p.col, 0.95)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(xd, mT - 2)
    ctx.lineTo(xd, mB)
    ctx.stroke()
    ctx.setLineDash([])
    const lf = 10
    ctx.font = `600 ${lf}px Rubik, system-ui, sans-serif`
    const chip = 'QUEUE OF 2,000 · ' + hmAt(snap, today.length - 1 - spikeI)
    const cw = ctx.measureText(chip).width
    const cx0 = Math.min(xd + 4, x3 - cw - 4)
    ctx.fillStyle = rgba(p.col, 0.9)
    ctx.fillText(chip, cx0, mT + lf * 0.7)
  }

  // the rise, measured: a dimension bracket from the open up to the posted
  const yA = yOf(today[0])
  const bx = Math.min(x3 - 8, xNow + 14)
  ctx.strokeStyle = rgba(p.dat, 0.4)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(bx - 4, yA + 0.5)
  ctx.lineTo(bx + 4, yA + 0.5)
  ctx.moveTo(bx + 0.5, yA)
  ctx.lineTo(bx + 0.5, lastY)
  ctx.moveTo(bx - 4, lastY + 0.5)
  ctx.lineTo(bx + 4, lastY + 0.5)
  ctx.stroke()
  if (pr.pct != null && pr.pct > 0.5) {
    const dl = `+${pr.delta.toFixed(2)} · +${pr.pct.toFixed(1)}%`
    ctx.font = `600 11px Rubik, system-ui, sans-serif`
    const dw = ctx.measureText(dl).width
    const dx = bx + 8 + dw < x3 ? bx + 8 : bx - 8 - dw
    ctx.fillStyle = 'rgba(0,0,0,0.85)'
    ctx.fillRect(dx - 3, (yA + lastY) / 2 - 8, dw + 6, 16)
    ctx.fillStyle = rgba(p.alm, 1)
    ctx.textBaseline = 'middle'
    ctx.fillText(dl, dx, (yA + lastY) / 2)
    ctx.textBaseline = 'alphabetic'
  }

  // NOW chip
  const nowS = `NOW ${hmAt(snap, 0)} · ${cur.toFixed(2)} B/L`
  ctx.font = '600 10px Rubik, system-ui, sans-serif'
  const nw = ctx.measureText(nowS).width
  const nx = Math.max(x2 + 4, Math.min(x3 - nw - 4, xNow - nw / 2))
  const ny = Math.min(mB - 12, lastY + 14)
  ctx.fillStyle = 'rgba(0,0,0,0.8)'
  ctx.fillRect(nx - 3, ny - 7, nw + 6, 14)
  ctx.fillStyle = rgba(p.dat, 0.95)
  ctx.fillText(nowS, nx, ny + 3)
  ctx.strokeStyle = rgba(p.dat, 0.25)
  ctx.beginPath()
  ctx.moveTo(Math.round(xNow) + 0.5, lastY + 4)
  ctx.lineTo(Math.round(xNow) + 0.5, ny - 7)
  ctx.stroke()

  // the precedent scan: a band walking the year with the decode rate; the
  // closes under it re-stroke bright. Settled frame rests mid-band.
  const bandRate = decode01(snap)
  const bandPh = anim && bandRate > 0 ? (t * 0.055 * bandRate) % 1 : 0.45
  const xh = mL + bandPh * (xBreak - mL)
  const bw = Math.max(9, (xBreak - mL) * 0.035)
  const cg = ctx.createLinearGradient(xh - 2 * bw, 0, xh + 2 * bw, 0)
  cg.addColorStop(0, rgba(p.dat, 0))
  cg.addColorStop(0.3, rgba(p.dat, 0.06))
  cg.addColorStop(0.5, rgba(p.dat, 0.13))
  cg.addColorStop(0.7, rgba(p.dat, 0.06))
  cg.addColorStop(1, rgba(p.dat, 0))
  ctx.fillStyle = cg
  ctx.fillRect(xh - 2 * bw, mT, 4 * bw, ph)
  ctx.lineWidth = 1.6
  ctx.lineJoin = 'round'
  const i0 = Math.max(0, Math.floor(((xh - 2.5 * bw - mL) / (xBreak - mL)) * year.length))
  const i1 = Math.min(year.length - 1, Math.ceil(((xh + 2.5 * bw - mL) / (xBreak - mL)) * year.length))
  for (let i = i0; i < i1; i++) {
    const xa = xYear(i)
    const k = 1 - Math.max(0, Math.min(1, Math.abs(xa - xh) / (2.5 * bw)))
    ctx.strokeStyle = rgba(p.dat, 0.9 * k)
    ctx.beginPath()
    ctx.moveTo(xa, yOf(year[i]))
    ctx.lineTo(xYear(i + 1), yOf(year[i + 1]))
    ctx.stroke()
  }
  ctx.fillStyle = rgba(p.dat, 0.35)
  ctx.fillRect(Math.round(xh), mT, 1, ph)

  // marginal histogram: days at each price bin, with the held days-count
  const mx0 = mR + 4
  const mx1 = w - 6
  const mw = mx1 - mx0
  if (mw > 20) {
    const NB = 14
    const bins = new Array(NB).fill(0)
    for (const v of hist) {
      const b = Math.max(0, Math.min(NB - 1, Math.floor(((v - yLo) / (yHi - yLo)) * NB)))
      bins[b]++
    }
    let maxB = 1
    for (const b of bins) maxB = Math.max(maxB, b)
    for (let i = 0; i < NB; i++) {
      if (!bins[i]) continue
      const y0 = yOf(yLo + (i + 1) * ((yHi - yLo) / NB))
      const y1 = yOf(yLo + i * ((yHi - yLo) / NB))
      const len = (bins[i] / maxB) * mw
      ctx.fillStyle = rgba(p.dat, 0.9)
      ctx.fillRect(mx0, y0 + 0.5, len, Math.max(1, y1 - y0 - 1))
    }
    ctx.strokeStyle = rgba(p.dat, 0.2)
    ctx.beginPath()
    ctx.moveTo(mx0 - 0.5, mT)
    ctx.lineTo(mx0 - 0.5, mB)
    ctx.stroke()
    ctx.fillStyle = rgba(p.dat, 0.6)
    ctx.font = '500 9px Rubik, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText('DAYS', mx0, mT - 4)
    let days = 0
    const bw2 = (yHi - yLo) / NB
    for (const v of hist) if (Math.abs(v - cur) < Math.max(0.125, bw2 * 0.7)) days++
    ctx.setLineDash([2, 2])
    ctx.strokeStyle = rgba(p.alm, 0.8)
    const ly = Math.round(lastY) + 0.5
    ctx.beginPath()
    ctx.moveTo(mx0, ly)
    ctx.lineTo(mx1, ly)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = rgba(p.alm, 1)
    ctx.textBaseline = 'bottom'
    ctx.fillText(`${days} D`, mx0 + 2, lastY - 2)
  }
}

function niceStep(x) {
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1e-6, x))))
  const r = x / mag
  const m = r >= 5 ? 5 : r >= 2 ? 2 : 1
  return m * mag
}

// The post clock for index i seconds before the current tick (the reference's
// hour labels on the today axis).
function hmAt(snap, backSec) {
  const total = 9 * 3600 + 52 * 60 + Math.max(0, Math.floor((snap && snap.t) || 0)) - backSec
  const hh = Math.floor(total / 3600) % 24
  const mm = Math.floor(total / 60) % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// THE TAP TICKER — VT323 tape of the newest trades, newest at the right,
// crawling on the master clock. Items are the request stream dressed as tap
// sales at the posted price; under reduced motion the tape holds still.
// ---------------------------------------------------------------------------

export function paintTicker(ctx, w, h, c) {
  if (w < 60 || h < 12) return
  const p = c.palette
  const t = c.t
  const anim = !c.reduced
  const snap = c.snap
  const pr = priceStats(snap)
  const price = pr.price != null ? pr.price : 14.2
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
    const dk = 3900 + (hashCodeId(snap) + i * 7) % 40
    const litres = ((r.output || 40) / Math.max(1, price / 14.2) / 10).toFixed(2)
    const s = `${grp(dk)} W ${litres} L @ ${price.toFixed(2)}`
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
  // edge fades + the TAP 1 badge
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
  ctx.fillText('TAP 1', 6, y)
}

// ---------------------------------------------------------------------------
// THE BOARD: TIN (a 25×8 grid of the declared buttons, re-set as it spends),
// STRONGBOX (the post's step chart with runner marks) and CISTER (the tank:
// vram used-window, tick scale, pump mark while load is high).
// ---------------------------------------------------------------------------

export function paintTin(ctx, w, h, c) {
  if (w < 40 || h < 16) return
  const p = c.palette
  const snap = c.snap
  const pr = priceStats(snap)
  const tin = tinSpentOf(snap, pr.price)
  const cols = 25
  const rows = 8
  const cell = Math.min((w - 1) / cols, (h - 1) / rows)
  const gp = Math.max(1, cell * 0.2)
  const s = cell - gp
  const ox = 0.5
  const oy = (h - rows * cell) / 2 + 0.5
  const full = (tin / 10) % 200
  const t = c.t
  const anim = !c.reduced
  for (let i = 0; i < cols * rows; i++) {
    const x = ox + (i % cols) * cell
    const y = oy + Math.floor(i / cols) * cell
    const a = Math.max(0, Math.min(1, full - i))
    // the re-print head walks column by column after each spend (settled:
    // the head rests at the left)
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

export function paintBox(ctx, w, h, c) {
  if (w < 40 || h < 16) return
  const p = c.palette
  const snap = c.snap
  const hist = (((snap && snap.kpiHist && snap.kpiHist.queue) || []) .slice(-90))
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
  // runner marks: the queue draining is the runner going out
  ctx.fillStyle = rgba(p.dat, 0.7)
  ctx.font = '600 9px Rubik, system-ui, sans-serif'
  for (let i = 4; i < n; i += 12) {
    if (hist[i] < hist[Math.max(0, i - 4)] - 3) {
      const x = xOf(i)
      ctx.fillRect(x - 0.5, 0, 1, h * 0.5)
      ctx.fillText('R', x + 2, 0)
    }
  }
  ctx.fillStyle = rgba(p.alm, 1)
  ctx.fillRect(xOf(n - 1) - 1.5, yOf(pv) - 1.5, 3, 3)
}

export function paintCistern(ctx, w, h, c) {
  if (w < 14 || h < 24) return
  const p = c.palette
  const snap = c.snap
  const g = (snap && snap.gpu) || null
  const k = (snap && snap.kpi) || {}
  const v = k.vram != null ? k.vram : g && g.vram != null ? g.vram : null
  const total = g && g.vramTotal != null ? g.vramTotal : 24
  const level = v != null ? Math.max(0, Math.min(1, v / total)) : 0
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
  for (let v2 = 1000; v2 < 4000; v2 += 1000) {
    const ty = Math.round(y + hh - (v2 / 4000) * hh) + 0.5
    ctx.beginPath()
    ctx.moveTo(x + ww, ty)
    ctx.lineTo(x + ww + 5, ty)
    ctx.stroke()
  }
  const load = genStats(snap, g, snap && snap.host).load
  if (load > 0.6) {
    ctx.fillStyle = rgba(p.dat, 0.8)
    ctx.fillRect(x + ww + 3, y + hh - 7, 6, 6)
  }
}

// ---------------------------------------------------------------------------
// SPARKS — one factory, three surfaces: the assays spark (kpi tps), the
// generator load trace (kpiHist: tps blended with host cpu) and the tallies
// spark (queue). Each normalises to its own peak so a quiet feed still reads.
// ---------------------------------------------------------------------------

export function paintSpark(ctx, w, h, c, series, tone) {
  if (w < 40 || h < 10) return
  const p = c.palette
  const col = tone === 'vio' ? p.col : tone === 'alm' ? p.alm : p.acc
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

// ---------------------------------------------------------------------------
// TALLY MARKS — the stoops performed, as the reference's hand-inked groups of
// five (four strokes, one diagonal), jittered deterministically.
// ---------------------------------------------------------------------------

export function paintTally(ctx, w, h, c) {
  if (w < 30 || h < 14) return
  const p = c.palette
  const snap = c.snap
  const n = Math.min(56, talliesOf(snap).stoops)
  const groups = Math.ceil(n / 5)
  let gh = Math.min(h - 2, 30)
  let gw = 0
  let gx = 0
  let cols = 1
  let rowsN = 1
  for (;;) {
    gw = gh * 0.95
    gx = gh * 0.42
    cols = Math.max(1, Math.floor((w + gx) / (gw + gx)))
    rowsN = Math.max(1, Math.floor((h + 3) / (gh + 3)))
    if (cols * rowsN >= groups || gh <= 7) break
    gh -= 1
  }
  ctx.lineCap = 'round'
  for (let m = 0; m < n; m++) {
    const gi = Math.floor(m / 5)
    const j = m % 5
    const colI = gi % cols
    const rowI = Math.floor(gi / cols)
    if (rowI >= rowsN) break
    const x0 = colI * (gw + gx) + 1
    const y0 = rowI * (gh + 3) + 1
    const jit = (det(m * 5.3) - 0.5) * gh * 0.08
    const jit2 = (det(m * 9.1) - 0.5) * gh * 0.1
    ctx.strokeStyle = rgba(p.dat, 0.8)
    ctx.lineWidth = Math.max(1.1, gh * 0.075)
    ctx.beginPath()
    if (j < 4) {
      const x = x0 + (j + 0.5) * (gw / 4.2) + jit
      ctx.moveTo(x, y0 + gh * 0.08 + jit2)
      ctx.lineTo(x + jit * 0.4, y0 + gh * 0.08 + gh * 0.84)
    } else {
      ctx.moveTo(x0 - gw * 0.04, y0 + gh * 0.8 + jit2)
      ctx.lineTo(x0 - gw * 0.04 + gw * 1.05, y0 + gh * 0.8 + jit2 - gh * 0.62)
    }
    ctx.stroke()
  }
}

// ---------------------------------------------------------------------------
// WEATHER — decorative (flagged in the report): the wind vane swings on the
// master clock (still under reduced motion) and the cinder-fall bins are
// filled from the flow scalar, the last bin (now) reading brightest.
// ---------------------------------------------------------------------------

export function paintWeather(ctx, w, h, c) {
  if (w < 60 || h < 30) return
  const p = c.palette
  const t = c.t
  const anim = !c.reduced
  const snap = c.snap
  const flow = Math.max(0, Math.min(1, c.flow))
  const heat = Math.max(0, Math.min(1, c.heat))
  const wind = 12.5 + heat * 6
  const dir = 287 + heat * 24 + (anim ? (Math.sin(2 * Math.PI * 0.11 * t + 0.4) + Math.sin(2 * Math.PI * 0.27 * t + 1.9)) * 6 : 0)

  // the vane
  const r = Math.min(h * 0.44, w * 0.16)
  const cx = r + 4
  const cy = h / 2
  ctx.strokeStyle = rgba(p.dat, 0.22)
  ctx.lineWidth = 1
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    const l = i % 4 === 0 ? 0.24 : 0.12
    ctx.beginPath()
    ctx.moveTo(cx + Math.sin(a) * r, cy - Math.cos(a) * r)
    ctx.lineTo(cx + Math.sin(a) * r * (1 - l), cy - Math.cos(a) * r * (1 - l))
    ctx.stroke()
  }
  const to = ((dir + 180) * Math.PI) / 180
  const len = r * Math.max(0.5, Math.min(0.95, 0.45 + wind / 40))
  const tx = cx + Math.sin(to) * len
  const ty = cy - Math.cos(to) * len
  const bx = cx - Math.sin(to) * len * 0.7
  const by = cy + Math.cos(to) * len * 0.7
  ctx.strokeStyle = rgba(p.dat, 0.9)
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(bx, by)
  ctx.lineTo(tx, ty)
  ctx.stroke()
  ctx.fillStyle = rgba(p.dat, 0.9)
  ctx.beginPath()
  ctx.moveTo(tx, ty)
  ctx.lineTo(tx - Math.sin(to - 0.45) * r * 0.3, ty + Math.cos(to - 0.45) * r * 0.3)
  ctx.lineTo(tx - Math.sin(to + 0.45) * r * 0.3, ty + Math.cos(to + 0.45) * r * 0.3)
  ctx.closePath()
  ctx.fill()
  ctx.font = '600 9px Rubik, system-ui, sans-serif'
  ctx.fillStyle = rgba(p.dat, 0.6)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  if (cy - r > 9) ctx.fillText('N', cx, cy - r - 1)

  // cinder fall: 36 bins of 10 min, the last 6 h
  const x0 = cx + r + 12
  const x1 = w - 2
  const NB = 36
  const bw = (x1 - x0) / NB
  if (bw > 1.2) {
    const yb = h - 11
    const ht = yb - 3
    const mx = 4
    ctx.strokeStyle = rgba(p.dat, 0.05)
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let v = 1; v < mx; v++) {
      const y = Math.round(yb - (v / mx) * ht) + 0.5
      ctx.moveTo(x0, y)
      ctx.lineTo(x1, y)
    }
    for (let i = 6; i < NB; i += 6) {
      const x = Math.round(x0 + i * bw) + 0.5
      ctx.moveTo(x, yb - ht)
      ctx.lineTo(x, yb)
    }
    ctx.stroke()
    for (let i = 0; i < NB; i++) {
      const v = Math.max(0, 1.2 + flow * 2.2 + (det(i * 3.7 + Math.floor(t / 60)) - 0.5) * 0.9)
      const bh = Math.max(0, Math.min(1, v / mx)) * ht
      const x = x0 + i * bw
      ctx.fillStyle = i === NB - 1 ? 'rgba(255,252,244,0.95)' : rgba(p.acc, 0.85)
      ctx.fillRect(x + 0.5, yb - bh, Math.max(1, bw - 1), bh)
      ctx.fillStyle = i === NB - 1 ? 'rgba(255,252,244,1)' : rgba(p.dat, 0.9)
      ctx.fillRect(x + 0.5, yb - bh, Math.max(1, bw - 1), 1.2)
    }
    ctx.strokeStyle = rgba(p.dat, 0.2)
    ctx.beginPath()
    ctx.moveTo(x0, yb + 0.5)
    ctx.lineTo(x1, yb + 0.5)
    ctx.stroke()
    ctx.textBaseline = 'top'
    ctx.fillStyle = rgba(p.dat, 0.6)
    ctx.textAlign = 'left'
    ctx.fillText('−6 H', x0, yb + 2)
    ctx.textAlign = 'right'
    ctx.fillText('MM/H · NOW', x1, yb + 2)
  }
  void snap
}

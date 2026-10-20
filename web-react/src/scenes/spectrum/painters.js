// Logit Spectrum canvas painters. Registered through SceneCanvas; every one
// is a pure function of (ctx, w, h, c) — the conductor carries the clock,
// the latest snapshot and the active palette. No timers, no React state;
// per-row write state lives in the ring buffer below the way the foundry
// holds its bay layout. Under reduced motion the conductor settles each
// canvas on one static frame via paintSettled.
//
// Canvases:
//   paintSpectrogram  hero    the token spectrogram: time falls toward NOW,
//                             a row's brightness profile is three lobes
//                             (think / decode / mtp), anomalies burn streaks
//   paintPhaseSpec    left    the phase slice: the live lobe profile as bars
//   paintSeries       rails   a generic kpiHist sparkline (p95, mtp)
//   paintEngines      right   per-engine decode tok/s bars
//
// Colours come from c.palette ("R G B" channels); neutral shading uses plain
// black/white alphas (no hue); the only hard-coded colour is the absolute
// alarm red (ALM in scene/conductor.js) where severity, not palette, is the
// meaning.

import { ALM } from '../../scene/conductor'
import { det, engineLevels, heatRamp, lanesOf, staleOf } from './shared'

const chan = (s) => String(s || '0 0 0').trim().split(/\s+/).map(Number)
const clamp01 = (a) => (a < 0 ? 0 : a > 1 ? 1 : a)
const rgba = (s, a) => `rgba(${chan(s).join(',')},${clamp01(a)})`
const lerp = (a, b, t) => a + (b - a) * t

// Seconds since the most recent matching conductor event (Infinity if none).
// The streak burn reads this: a fresh anomaly or vram_pressure crossing
// burns the rows that land while it is fresh, then the frame heals.
function flareAge(c, types) {
  let a = Infinity
  for (const ev of c.events || []) {
    if (types.includes(ev.type)) a = Math.min(a, c.t - ev.t)
  }
  return a
}

// ---------------------------------------------------------------------------
// THE TOKEN SPECTROGRAM — one 2D canvas on the shared clock. A ring buffer
// holds the recent time rows; each frame the history shifts UP (time falls
// toward NOW at the bottom) and the newest rows are written along the bottom
// edge, then the buffer blits stretched over the viewport.
//
// A row's value across the bins is three Gaussian lobes over the spectrum:
//   think   centred 0.22, narrow,   amp = think-lane activity
//   decode  centred 0.50, broad,    amp = decode tok/s
//   mtp     centred 0.78, narrow,   amp = mtp acceptance
// on a dark noise floor with deterministic grain. A row written while an
// anomaly flare is fresh burns: it lifts and tints toward the alarm channel,
// so the streak scrolls away with the history.
// ---------------------------------------------------------------------------

const BINS = 128 // spectrum bins across the tube
const ROWS = 192 // time rows down the tube (NOW is the bottom row)
const ROWS_PER_SEC = 26

const sp = { cv: null, lastT: -1, acc: 0 }

const LOBES = [
  { c: 0.22, s: 0.075 },
  { c: 0.5, s: 0.16 },
  { c: 0.78, s: 0.08 },
]

const ALM_RGB = chan(ALM)

// One time row: the lobe profile over the bins, on the noise floor. The
// harmonic term inside each lobe gives the grain a real spectrogram has;
// the seed carries the buffer row so two rows of one tick differ.
function spRow(lanes, y) {
  const row = new Float32Array(BINS)
  const amps = [lanes.think, lanes.decode, lanes.mtp]
  for (let x = 0; x < BINS; x++) {
    const pos = x / (BINS - 1)
    let v = 0.06 + det(x * 1.93 + y * 1.13) * 0.1
    for (let l = 0; l < 3; l++) {
      const d = (pos - LOBES[l].c) / LOBES[l].s
      const env = Math.exp(-d * d)
      v += amps[l] * env * (0.62 + 0.38 * det(x * 7.7 + y * 3.7))
    }
    row[x] = clamp01(v)
  }
  return row
}

// Sample the ramp as channels (the burn tint mixes in RGB space).
function rampChannels(ramp, v) {
  const x = Math.min(1, Math.max(0, v))
  let i = 1
  while (i < ramp.length - 1 && ramp[i].v < x) i++
  const lo = ramp[i - 1]
  const hi = ramp[i]
  const t = hi.v === lo.v ? 0 : (x - lo.v) / (hi.v - lo.v)
  const c = [
    Math.round(lo.c[0] + (hi.c[0] - lo.c[0]) * t),
    Math.round(lo.c[1] + (hi.c[1] - lo.c[1]) * t),
    Math.round(lo.c[2] + (hi.c[2] - lo.c[2]) * t),
  ]
  return { c, a: lo.a + (hi.a - lo.a) * t }
}

// Write one row into the buffer. `glitch` is the flare strength at write
// time; rows written inside the short flare window go near-full alarm and
// ride up as thin streaks, so an anomaly reads as a glitch line, not a red
// flood over the whole tube.
function writeRow(b, y, lanes, glitch, ramp) {
  const row = spRow(lanes, y)
  const burn = 0.85 * glitch
  for (let x = 0; x < BINS; x++) {
    const { c, a } = rampChannels(ramp, row[x])
    if (burn > 0.02) {
      const m = Math.min(1, burn)
      const r = Math.round(c[0] + (ALM_RGB[0] - c[0]) * m)
      const g = Math.round(c[1] + (ALM_RGB[1] - c[1]) * m)
      const bb = Math.round(c[2] + (ALM_RGB[2] - c[2]) * m)
      b.fillStyle = `rgb(${r} ${g} ${bb} / ${a.toFixed(3)})`
    } else {
      b.fillStyle = `rgb(${c[0]} ${c[1]} ${c[2]} / ${a.toFixed(3)})`
    }
    b.fillRect(x, y, 1, 1)
  }
}

export function paintSpectrogram(ctx, w, h, c) {
  const snap = c.snap
  const pal = c.palette || { acc: '125 184 196', dat: '91 232 114', col: '255 176 0', alm: '232 84 63' }
  const ramp = heatRamp(pal)
  if (!sp.cv || sp.cv.width !== BINS || sp.cv.height !== ROWS) {
    sp.cv = document.createElement('canvas')
    sp.cv.width = BINS
    sp.cv.height = ROWS
    sp.lastT = -1
    sp.acc = 0
  }
  const b = sp.cv.getContext('2d')
  const flare = clamp01(1 - flareAge(c, ['anomaly', 'vram_pressure']) / 0.35)
  const glitch = staleOf(snap) ? 0 : flare
  if (sp.lastT < 0) {
    // first / settled frame: fill the whole history deterministically, the
    // oldest row at the top, NOW at the bottom; only rows young enough to
    // have landed during a fresh flare burn
    for (let y = 0; y < ROWS; y++) {
      const age = (ROWS - 1 - y) / ROWS_PER_SEC
      writeRow(b, y, lanesOf(snap, c), glitch > 0 && age < 0.35 ? glitch * (1 - age / 0.35) : 0, ramp)
    }
    sp.lastT = c.t
  } else if (c.running) {
    let adv = (c.t - sp.lastT) * ROWS_PER_SEC + sp.acc
    let n = Math.floor(adv)
    sp.acc = adv - n
    n = Math.min(n, ROWS)
    if (n > 0) {
      // shift the history up, then write the newest rows along the bottom
      b.drawImage(sp.cv, 0, n, BINS, ROWS - n, 0, 0, BINS, ROWS - n)
      for (let i = 0; i < n; i++) writeRow(b, ROWS - n + i, lanesOf(snap, c), glitch, ramp)
    }
    sp.lastT = c.t
  }
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(sp.cv, 0, 0, w, h)

  // anomaly streak glow over the live rows, so the burn reads even at the
  // tube's dark floor
  if (glitch > 0.02) {
    const rows = Math.min(ROWS, Math.ceil(glitch * ROWS_PER_SEC * 0.9))
    const y0 = h - (rows / ROWS) * h
    const g = ctx.createLinearGradient(0, y0, 0, h)
    g.addColorStop(0, `rgb(${ALM} / 0)`)
    g.addColorStop(1, `rgb(${ALM} / ${(0.16 * glitch).toFixed(3)})`)
    ctx.fillStyle = g
    ctx.fillRect(0, y0, w, h - y0)
  }

  // lane hairlines + labels: think / decode / mtp across the spectrum
  ctx.lineWidth = 1
  ctx.font = '500 9px Rubik, system-ui, sans-serif'
  ctx.textBaseline = 'top'
  for (const [lane, name] of [[LOBES[0], 'THINK'], [LOBES[1], 'DECODE'], [LOBES[2], 'MTP']]) {
    const x = Math.round(lane.c * w) + 0.5
    ctx.strokeStyle = rgba(pal.acc, 0.14)
    ctx.beginPath()
    ctx.moveTo(x, h)
    ctx.lineTo(x, h - 26)
    ctx.stroke()
    ctx.save()
    // a dark chip behind the label keeps it legible over a bright column
    ctx.font = '500 9px Rubik, system-ui, sans-serif'
    ctx.textAlign = 'center'
    const tw = ctx.measureText(name).width
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(lane.c * w - tw / 2 - 3, h - 14, tw + 6, 11)
    ctx.fillStyle = rgba(pal.acc, 0.8)
    ctx.fillText(name, lane.c * w, h - 13)
    ctx.restore()
  }

  // time gridlines: one per second of history, faint
  for (let s = 1; s * ROWS_PER_SEC < ROWS; s++) {
    const y = Math.round(h - (s * ROWS_PER_SEC * h) / ROWS) + 0.5
    ctx.strokeStyle = rgba(pal.acc, 0.05)
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }

  // the scan sweep: a band of light walking down the tube with the rows,
  // speed on the decode lane; a stale feed rests it mid-tube
  const anim = !c.reduced
  const flow = clamp01(c.flow || 0)
  if (anim && !staleOf(snap) && flow > 0) {
    const ph = (c.t * 0.09 * (0.4 + flow)) % 1.4
    const sy = lerp(-40, h + 40, ph)
    const sw = Math.max(8, h * 0.05)
    const sg = ctx.createLinearGradient(0, sy - sw, 0, sy + sw)
    sg.addColorStop(0, rgba(pal.dat, 0))
    sg.addColorStop(0.5, rgba(pal.dat, 0.08))
    sg.addColorStop(1, rgba(pal.dat, 0))
    ctx.fillStyle = sg
    ctx.fillRect(0, sy - sw, w, 2 * sw)
  }

  // lock-on brackets: four corner Ls around the tube. On request_arrived
  // they snap in tight (the helix kick), then relax; under reduced motion
  // they sit closed.
  const kick = anim && !staleOf(snap) ? Math.max(0, c.helix.kick || 0) : 0
  const inset = lerp(10, 3, Math.min(1, kick * 1.6))
  const arm = Math.max(12, w * 0.045)
  const bA = 0.45 + 0.35 * Math.min(1, kick) + (flow > 0 ? 0.12 * Math.sin(c.t * 1.7) : 0)
  ctx.save()
  ctx.shadowColor = rgba(pal.acc, 0.8)
  ctx.shadowBlur = 7
  ctx.strokeStyle = rgba(pal.acc, Math.min(1, bA))
  ctx.lineWidth = 2
  for (const [cx, cy, dx, dy] of [
    [inset, inset, 1, 1],
    [w - inset, inset, -1, 1],
    [inset, h - inset, 1, -1],
    [w - inset, h - inset, -1, -1],
  ]) {
    ctx.beginPath()
    ctx.moveTo(cx + dx * arm, cy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx, cy + dy * arm)
    ctx.stroke()
  }
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Phase slice 140×28: the live lobe profile as one bar row — think / decode
// / mtp amplitudes over the bins, breathing with the shimmer term.
// ---------------------------------------------------------------------------

export function paintPhaseSpec(ctx, w, h, c) {
  const tick = c.tick
  const snap = c.snap
  const pal = c.palette || { acc: '125 184 196', dat: '91 232 114', col: '255 176 0', alm: '232 84 63' }
  const lanes = lanesOf(snap, c)
  const amps = [lanes.think, lanes.decode, lanes.mtp]
  const n = 48
  const bw = w / n
  for (let i = 0; i < n; i++) {
    const pos = i / (n - 1)
    let v = 0.1
    for (let l = 0; l < 3; l++) {
      const d = (pos - LOBES[l].c) / LOBES[l].s
      v += amps[l] * Math.exp(-d * d) * 0.85
    }
    v = clamp01(v + (det(i * 7.3 + Math.floor(tick) * 0.91) - 0.5) * 0.14)
    const bh = Math.max(1, v * h)
    const hot = !staleOf(snap) && lanes.spike > 0.25 && Math.abs(pos - 0.5) < 0.06
    ctx.fillStyle = hot
      ? `rgb(${pal.col} / 0.95)`
      : v > 0.6
        ? `rgb(${pal.dat} / 0.9)`
        : `rgb(${pal.acc} / ${0.35 + v * 0.5})`
    ctx.fillRect(i * bw + 0.5, h - bh, Math.max(1, bw - 1), bh)
  }
}

// ---------------------------------------------------------------------------
// Series spark: a kpiHist key as a sparkline. Samples accumulate with the
// feed, so the line is stable under reduced motion and a held feed.
// ---------------------------------------------------------------------------

const sparkHist = new Map()
const SPARK_CAP = 60

export function paintSeries(ctx, w, h, c, key, channel = 'dat') {
  const snap = c.snap
  const pal = c.palette
  const ch = pal[channel] || pal.acc
  // the per-key tick memo lets two sparks on one frame each take their sample
  const tickKey = key + '·tick'
  if (snap && snap.mode !== 'offline' && c.tick != null && sparkHist.get(tickKey) !== c.tick) {
    sparkHist.set(tickKey, c.tick)
    const v = ((snap.kpiHist || {})[key] || []).at(-1)
    let arr = sparkHist.get(key)
    if (!arr) {
      arr = []
      sparkHist.set(key, arr)
    }
    arr.push(v != null ? v : 0)
    if (arr.length > SPARK_CAP) arr.splice(0, arr.length - SPARK_CAP)
  }
  const arr = sparkHist.get(key) || []
  const max = Math.max(1e-6, ...arr) * 1.15
  ctx.strokeStyle = rgba(ch, 0.25)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, h - 0.5)
  ctx.lineTo(w, h - 0.5)
  ctx.stroke()
  if (arr.length < 2) return
  // the line stretches to the full width as it fills, so a young spark
  // still reads as a trace rather than a stub at the left edge
  const span = Math.max(1, arr.length - 1)
  ctx.strokeStyle = rgba(ch, 0.95)
  ctx.lineWidth = 1.2
  ctx.beginPath()
  for (let i = 0; i < arr.length; i++) {
    const x = (i / span) * w
    const y = h - 2 - (arr[i] / max) * (h - 4)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  const lx = w
  const ly = h - 2 - (arr[arr.length - 1] / max) * (h - 4)
  ctx.fillStyle = rgba(pal.col, 1)
  ctx.fillRect(lx - 2, ly - 1, 2.5, 2.5)
}

// ---------------------------------------------------------------------------
// Engine bars: one vertical bar per engine, height = the engine's own
// decode rate; an engine down holds its slot in alarm tint.
// ---------------------------------------------------------------------------

export function paintEngines(ctx, w, h, c) {
  const snap = c.snap
  const pal = c.palette || { acc: '125 184 196', dat: '91 232 114', col: '255 176 0', alm: '232 84 63' }
  const engines = engineLevels(snap)
  const n = Math.max(1, engines.length)
  const bw = w / n
  // one engine must not paint a slab: the bar caps at a lamp width
  const barW = Math.min(bw * 0.56, 22)
  for (let i = 0; i < n; i++) {
    const e = engines[i]
    const v = e ? e.load : 0
    const up = e ? e.up : false
    const bh = Math.max(2, v * (h - 8))
    const x = i * bw + bw * 0.22
    ctx.fillStyle = rgba(pal.acc, 0.18)
    ctx.fillRect(x, 4, barW, h - 8)
    if (v > 0) {
      ctx.fillStyle = !up ? rgba(pal.alm, 0.7) : v > 0.8 ? rgba(pal.col, 0.9) : rgba(pal.dat, 0.85)
      ctx.fillRect(x, 4 + (h - 8 - bh), barW, bh)
    }
  }
}

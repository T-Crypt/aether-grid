// Logit Spectrum canvas painters. Registered through SceneCanvas; every one
// is a pure function of (ctx, w, h, c): the conductor carries the clock,
// the latest snapshot and the active palette. No timers, no React state;
// per-row write state lives in the ring buffer below the way the foundry
// holds its bay layout. Under reduced motion the conductor settles each
// canvas on one static frame via paintSettled.
//
// Canvases:
//   paintSpectrogram  hero    the token spectrogram: time falls toward NOW,
//                             every bin carries a live noise floor, the three
//                             channel lobes ride think / decode / mtp with
//                             harmonics, and anomalies burn short streaks
//   paintPhaseSpec    left    the phase slice: the live profile as bars
//   paintTrace        rails   a kpiHist trace, range-fitted, area-filled,
//                             with the current value as a big numeral
//   paintEngines      right   per-engine decode tok/s bars, value-labelled
//
// Colours come from c.palette ("R G B" channels); neutral shading uses plain
// black/white alphas (no hue); the only hard-coded colour is the absolute
// alarm red (ALM in scene/conductor.js) where severity, not palette, is the
// meaning.

import { ALM } from '../../scene/conductor'
import { det, engineLevels, heatRamp, lanesOf, rampChannels, staleOf, thinkRate } from './shared'

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
// A row's profile across the bins: a live noise floor on every bin, three
// channel lobes (think 0.22, decode 0.50, mtp 0.78) whose width and height
// track their own metric, a harmonic and a side lobe apiece, and a minor
// carrier between the channels. Everything jitters off det(), so the frame
// is dense from edge to edge and the past stays textured as it scrolls up.
// ---------------------------------------------------------------------------

const BINS = 128 // spectrum bins across the tube
const ROWS = 192 // time rows down the tube (NOW is the bottom row)
const ROWS_PER_SEC = 26

const sp = { cv: null, bloom: null, lastT: -1, acc: 0, burnT: -10 }

// Channel lobes: centre, base width, and the metric each one rides.
const LOBES = [
  { c: 0.22, s: 0.06, name: 'THINK' },
  { c: 0.5, s: 0.13, name: 'DECODE' },
  { c: 0.78, s: 0.07, name: 'MTP' },
]

const ALM_RGB = chan(ALM)

// One row's value profile over the bins, 0..1.
function profileOf(lanes, seed) {
  const amps = [lanes.think, lanes.decode, lanes.mtp]
  const row = new Float32Array(BINS)
  for (let x = 0; x < BINS; x++) {
    const pos = x / (BINS - 1)
    // live noise floor on every bin: a fixed instrument profile plus a
    // per-row shimmer, so the frame is textured edge to edge
    let v = 0.1 + det(x * 3.1) * 0.16 + det(x * 11.7 + seed * 0.83) * 0.1
    for (let l = 0; l < 3; l++) {
      const amp = amps[l]
      // the lobe widens as it brightens
      const s = LOBES[l].s * (0.75 + 0.55 * amp)
      const d = (pos - LOBES[l].c) / s
      v += amp * Math.exp(-d * d) * 0.72
      // harmonic above the carrier and a side lobe below it
      const h1 = (pos - LOBES[l].c - 0.055 - amp * 0.02) / (s * 0.45)
      v += amp * 0.3 * Math.exp(-h1 * h1)
      const h2 = (pos - LOBES[l].c + 0.075) / (s * 0.55)
      v += amp * 0.18 * Math.exp(-h2 * h2)
    }
    // two minor carriers between the channels, fed by their neighbours
    const minor = 0.22 * (amps[0] + amps[1] + amps[2]) / 3
    for (const mc of [0.36, 0.64]) {
      const d = (pos - mc) / 0.025
      v += minor * Math.exp(-d * d)
    }
    row[x] = clamp01(v)
  }
  return row
}

// Write one row into the buffer. `burn` is the streak strength at write
// time and `strong` names the strongest channel: the tint only hits the
// bins around that channel's lobe, so an anomaly reads as a short bright
// flame on the active lane that decays with the pulse, never a full-width
// band.
function writeRow(b, y, lanes, burn, ramp, strong) {
  const row = profileOf(lanes, y)
  const amps = [lanes.think, lanes.decode, lanes.mtp]
  const lobe = LOBES[strong != null ? strong : 0]
  const half = lobe.s * (0.75 + 0.55 * amps[strong != null ? strong : 0])
  const m = Math.min(1, 0.85 * burn)
  for (let x = 0; x < BINS; x++) {
    const { c, a } = rampChannels(ramp, row[x])
    if (m > 0.02) {
      const pos = x / (BINS - 1)
      const inLobe = Math.abs(pos - lobe.c) < half
      if (inLobe) {
        const r = Math.round(c[0] + (ALM_RGB[0] - c[0]) * m)
        const g = Math.round(c[1] + (ALM_RGB[1] - c[1]) * m)
        const bb = Math.round(c[2] + (ALM_RGB[2] - c[2]) * m)
        b.fillStyle = `rgb(${r} ${g} ${bb} / ${a.toFixed(3)})`
      } else {
        b.fillStyle = `rgb(${c[0]} ${c[1]} ${c[2]} / ${a.toFixed(3)})`
      }
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
    sp.bloom = document.createElement('canvas')
    sp.bloom.width = BINS >> 2
    sp.bloom.height = ROWS >> 2
    sp.lastT = -1
    sp.acc = 0
  }
  const b = sp.cv.getContext('2d')
  const stale = staleOf(snap)
  const lanes = lanesOf(snap, c)
  const amps = [lanes.think, lanes.decode, lanes.mtp]
  let strong = 0
  for (let l = 1; l < 3; l++) if (amps[l] > amps[strong]) strong = l
  // anomaly streaks: one short pulse per fresh event, throttled so a
  // sustained alert state produces distinct streaks instead of a band
  const age = flareAge(c, ['anomaly', 'vram_pressure'])
  if (!stale && age < 0.12 && c.t - sp.burnT > 1.4) sp.burnT = c.t
  const pulseT = c.t - sp.burnT
  const burn = stale || pulseT > 0.3 ? 0 : 1 - pulseT / 0.3
  if (sp.lastT < 0) {
    // first / settled frame: fill the whole history deterministically, the
    // oldest row at the top, NOW at the bottom
    for (let y = 0; y < ROWS; y++) {
      writeRow(b, y, lanes, 0, ramp, strong)
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
      for (let i = 0; i < n; i++) writeRow(b, ROWS - n + i, lanes, burn, ramp, strong)
    }
    sp.lastT = c.t
  }

  // phosphor bloom: blit the buffer into a quarter-size canvas, then draw
  // it back stretched and screen-blended; the upscale smoothing is the blur
  const anim = !c.reduced
  const flow = clamp01(c.flow || 0)
  const bloomCtx = sp.bloom.getContext('2d')
  bloomCtx.clearRect(0, 0, sp.bloom.width, sp.bloom.height)
  bloomCtx.drawImage(sp.cv, 0, 0, sp.bloom.width, sp.bloom.height)
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = 0.18 + 0.12 * flow
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(sp.bloom, 0, 0, w, h)
  ctx.restore()

  // the buffer itself on top, crisp
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(sp.cv, 0, 0, w, h)

  // the scan line: a bright core with a soft skirt, walking down the tube
  // with the rows; speed on the decode lane, resting mid-tube when stale
  if (anim && !stale) {
    const ph = flow > 0 ? (c.t * 0.09 * (0.4 + flow)) % 1.4 : 0.5
    const sy = lerp(-40, h + 40, ph)
    const sw = Math.max(8, h * 0.045)
    const sg = ctx.createLinearGradient(0, sy - sw, 0, sy + sw)
    sg.addColorStop(0, rgba(pal.dat, 0))
    sg.addColorStop(0.5, rgba(pal.dat, 0.07))
    sg.addColorStop(1, rgba(pal.dat, 0))
    ctx.fillStyle = sg
    ctx.fillRect(0, sy - sw, w, 2 * sw)
    ctx.strokeStyle = rgba(pal.dat, 0.5)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, Math.round(sy) + 0.5)
    ctx.lineTo(w, Math.round(sy) + 0.5)
    ctx.stroke()
  }

  // faint time gridlines: one per second of history
  for (let s = 1; s * ROWS_PER_SEC < ROWS; s++) {
    const y = Math.round(h - (s * ROWS_PER_SEC * h) / ROWS) + 0.5
    ctx.strokeStyle = rgba(pal.acc, 0.05)
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }

  // lane hairlines under each channel centre, meeting the top ruler
  ctx.lineWidth = 1
  for (const lane of LOBES) {
    const x = Math.round(lane.c * w) + 0.5
    ctx.strokeStyle = rgba(pal.acc, 0.12)
    ctx.beginPath()
    ctx.moveTo(x, h)
    ctx.lineTo(x, h - 26)
    ctx.stroke()
  }

  // LOCK-ON RETICLE: a bracket box over the strongest channel's band in the
  // recent rows, with that channel's live value on the box. On a fresh
  // request arrival it snaps tight, then relaxes; reduced motion sits it.
  const kick = anim && !stale ? Math.max(0, c.helix.kick || 0) : 0
  const lobe = LOBES[strong]
  const rcx = lobe.c * w
  const rcy = h * 0.27
  const rdx = w * (0.05 + 0.05 * amps[strong]) * (1 - 0.4 * Math.min(1, kick))
  const rdy = h * 0.09
  const rA = 0.55 + 0.3 * Math.min(1, kick) + (amps[strong] > 0 ? 0.12 * Math.sin(c.t * 2.1) : 0)
  ctx.save()
  ctx.shadowColor = rgba(pal.acc, 0.8)
  ctx.shadowBlur = 8
  ctx.strokeStyle = rgba(pal.acc, Math.min(1, rA))
  ctx.lineWidth = 1.6
  const armX = Math.max(8, rdx * 0.5)
  const armY = Math.max(6, rdy * 0.45)
  for (const [cx, cy, dx, dy] of [
    [rcx - rdx, rcy - rdy, 1, 1],
    [rcx + rdx, rcy - rdy, -1, 1],
    [rcx - rdx, rcy + rdy, 1, -1],
    [rcx + rdx, rcy + rdy, -1, -1],
  ]) {
    ctx.beginPath()
    ctx.moveTo(cx + dx * armX, cy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx, cy + dy * armY)
    ctx.stroke()
  }
  ctx.restore()
  // the live value on the reticle, on a dark chip so it reads over anything
  const k = (snap && snap.kpi) || {}
  const r = (snap && snap.reasoning) || {}
  const tRate = thinkRate(snap).rate
  const val =
    strong === 0
      ? tRate != null
        ? `${Math.round(tRate)} T/S`
        : '—'
      : strong === 1
        ? k.tps != null
          ? `${Math.round(k.tps)} T/S`
          : '—'
        : (() => {
            const m = r.mtp_accept_pct != null ? r.mtp_accept_pct : k.mtp
            return m != null ? `${Math.round(m)} %` : '—'
          })()
  const label = `${lobe.name} ${val}`
  ctx.font = '600 10px Rubik, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lw = ctx.measureText(label).width
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(rcx - lw / 2 - 4, rcy - rdy - 16, lw + 8, 14)
  ctx.fillStyle = rgba(pal.col, 0.95)
  ctx.fillText(label, rcx, rcy - rdy - 9)

  // corner brackets: four Ls hugging the tube frame; they pull in on a
  // request arrival and sit closed under reduced motion
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
// Phase slice 140×28: the live profile as one bar row, breathing with the
// shimmer term, the decode lane hot while the alert scalar is up.
// ---------------------------------------------------------------------------

export function paintPhaseSpec(ctx, w, h, c) {
  const snap = c.snap
  const pal = c.palette || { acc: '125 184 196', dat: '91 232 114', col: '255 176 0', alm: '232 84 63' }
  const tick = c.tick || 0
  const lanes = lanesOf(snap, c)
  const prof = profileOf(lanes, Math.floor(tick))
  const n = 48
  const bw = w / n
  for (let i = 0; i < n; i++) {
    const x0 = Math.floor((i / n) * BINS)
    const x1 = Math.max(x0 + 1, Math.floor(((i + 1) / n) * BINS))
    let v = 0
    for (let x = x0; x < x1; x++) v = Math.max(v, prof[x])
    const bh = Math.max(1, v * h)
    const pos = i / (n - 1)
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
// TRACE: a kpiHist key as a range-fitted trace. The y axis fits the data
// range (12% pad, widened when flat), the area under the line fills in the
// channel colour, min and max print as tick labels, and the current value
// is the big numeral at the right edge. Straight off the snapshot history,
// so a fresh page shows a full trace and a held feed holds it.
// ---------------------------------------------------------------------------

export function paintTrace(ctx, w, h, c, key, channel = 'dat', unit = '') {
  const snap = c.snap
  const pal = c.palette
  const ch = pal[channel] || pal.acc
  const data = (((snap && snap.kpiHist) || {})[key] || []).slice(-60).filter((v) => v != null && isFinite(v))
  ctx.strokeStyle = rgba(ch, 0.14)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, h - 0.5)
  ctx.lineTo(w, h - 0.5)
  ctx.stroke()
  if (data.length < 2) {
    ctx.font = '500 9px Rubik, system-ui, sans-serif'
    ctx.fillStyle = rgba(ch, 0.5)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('NO TRACE · FEED HELD', 6, h / 2)
    return
  }
  let lo = Infinity
  let hi = -Infinity
  for (const v of data) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  if (hi - lo < 1e-6) {
    lo -= 1
    hi += 1
  }
  const pad = (hi - lo) * 0.12
  const yLo = lo - pad
  const yHi = hi + pad
  const mT = 10
  const mB = h - 4
  const mL = 6
  const mR = w - 52
  const span = data.length - 1
  const xOf = (i) => mL + (i / span) * (mR - mL)
  const yOf = (v) => mT + (1 - clamp01((v - yLo) / (yHi - yLo))) * (mB - mT)

  // the area under the line
  ctx.beginPath()
  ctx.moveTo(xOf(0), yOf(data[0]))
  for (let i = 1; i < data.length; i++) ctx.lineTo(xOf(i), yOf(data[i]))
  ctx.lineTo(xOf(span), mB)
  ctx.lineTo(xOf(0), mB)
  ctx.closePath()
  const ag = ctx.createLinearGradient(0, mT, 0, mB)
  ag.addColorStop(0, rgba(ch, 0.28))
  ag.addColorStop(1, rgba(ch, 0.03))
  ctx.fillStyle = ag
  ctx.fill()

  // the line
  ctx.strokeStyle = rgba(ch, 0.95)
  ctx.lineWidth = 1.3
  ctx.beginPath()
  ctx.moveTo(xOf(0), yOf(data[0]))
  for (let i = 1; i < data.length; i++) ctx.lineTo(xOf(i), yOf(data[i]))
  ctx.stroke()

  // min / max tick labels on the left edge
  ctx.font = '500 7px Rubik, system-ui, sans-serif'
  ctx.fillStyle = rgba(ch, 0.55)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillText(fmtTick(hi), 2, mT + 2)
  ctx.textBaseline = 'top'
  ctx.fillText(fmtTick(lo), 2, mB - 2)

  // the current value as the big numeral, glowing, at the right edge
  const cur = data[data.length - 1]
  ctx.font = `${Math.min(h * 0.6, 26).toFixed(1)}px "VT323", ui-monospace, monospace`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.save()
  ctx.shadowColor = rgba(ch, 0.7)
  ctx.shadowBlur = 9
  ctx.fillStyle = rgba(ch, 1)
  ctx.fillText(fmtTick(cur), w - 4, h / 2 + 1)
  ctx.restore()
  if (unit) {
    ctx.font = '500 7px Rubik, system-ui, sans-serif'
    ctx.fillStyle = rgba(ch, 0.7)
    ctx.textAlign = 'right'
    ctx.fillText(unit, w - 4, h / 2 + Math.min(h * 0.32, 15))
  }
}

function fmtTick(v) {
  if (v >= 1000) return String(Math.round(v))
  if (v >= 100) return v.toFixed(0)
  if (v >= 10) return v.toFixed(1)
  return v.toFixed(2)
}

// ---------------------------------------------------------------------------
// Engine bars: one vertical bar per engine, height = the engine's own
// decode rate, the value printed beside the bar; an engine down holds its
// slot in alarm tint.
// ---------------------------------------------------------------------------

export function paintEngines(ctx, w, h, c) {
  const snap = c.snap
  const pal = c.palette || { acc: '125 184 196', dat: '91 232 114', col: '255 176 0', alm: '232 84 63' }
  const engines = engineLevels(snap)
  const n = Math.max(1, engines.length)
  const bw = w / n
  // one engine must not paint a slab: the bar caps at a lamp width
  const barW = Math.min(bw * 0.56, 26)
  ctx.font = '600 9px Rubik, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  for (let i = 0; i < n; i++) {
    const e = engines[i]
    const v = e ? e.load : 0
    const up = e ? e.up : false
    const bh = Math.max(2, v * (h - 12))
    const x = i * bw + bw * 0.18
    ctx.fillStyle = rgba(pal.acc, 0.18)
    ctx.fillRect(x, 2, barW, h - 12)
    if (v > 0) {
      ctx.fillStyle = !up ? rgba(pal.alm, 0.7) : v > 0.8 ? rgba(pal.col, 0.9) : rgba(pal.dat, 0.85)
      ctx.fillRect(x, h - 10 - bh, barW, bh)
    }
    // the value beside the bar, level with its top
    ctx.fillStyle = !up ? rgba(pal.alm, 0.95) : rgba(pal.dat, 0.95)
    ctx.fillText(e ? (e.tps != null && e.up ? `${Math.round(e.tps)} T/S` : 'DOWN') : '—', x + barW + 3, h - 10 - bh + 1)
  }
}

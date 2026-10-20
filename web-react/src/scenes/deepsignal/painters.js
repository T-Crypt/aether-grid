// Deepsignal canvas painters. Registered through SceneCanvas; every one is a
// pure function of (ctx, w, h, conductor) — no timers, no React state. They
// read colour from conductor.palette channels, never hard-coded values,
// except the absolute alarm red. Under reduced motion the conductor settles
// each canvas on one static frame via paintSettled.

import { det, heatRamp, rampColor, staleOf } from './shared'

// ---------------------------------------------------------------------------
// Hero waterfall: scrolling time×frequency heat. A small offscreen ring
// buffer holds the recent columns; each frame advances it by the conductor
// clock and blits it stretched over the viewport canvas. New column heat
// comes from the thinking-token rate + token flow; the amber candidate band
// rides the alert scalar at a fixed frequency row.
// ---------------------------------------------------------------------------

const WF_COLS = 220 // time history depth
const WF_ROWS = 96 // frequency bins
const COLS_PER_SEC = 26

const wf = { cv: null, lastT: -1, acc: 0 }

function wfColumn(snap, c, rows) {
  const k = (snap && snap.kpi) || {}
  const r = (snap && snap.reasoning) || {}
  const stale = staleOf(snap)
  const thinkRaw = stale ? 0 : r.thinking_tokens != null ? r.thinking_tokens : c.reason * 400
  const think = Math.round(Math.min(1, thinkRaw / 400) * 20) / 20
  const base = stale ? 0.06 : 0.2 + think * 0.45 + c.flow * 0.3
  const spike = stale ? 0 : c.alert
  const bandRow = Math.floor(rows * 0.38) // the 1420 MHz candidate lane
  const col = new Float32Array(rows)
  for (let y = 0; y < rows; y++) {
    const pos = y / (rows - 1)
    const shape = 0.5 + 0.5 * Math.sin(pos * Math.PI * 3 + 1.2)
    col[y] = Math.min(1, base * (0.35 + shape * 0.5) + det(wf.acc * 13.7 + y * 1.93) * 0.22)
  }
  // amber spike: a hot lane a few rows wide around the candidate frequency
  if (spike > 0.02) {
    for (let d = -2; d <= 2; d++) {
      const y = bandRow + d
      if (y >= 0 && y < rows) col[y] = Math.min(1, col[y] + spike * (d === 0 ? 0.95 : 0.5))
    }
  }
  void k
  return col
}

function wfColor(v, spike, pal, ramp) {
  // alarm spike lane stays outside the ramp; everything else samples the
  // palette-derived perceptual scale
  if (spike > 0.55 && v > 0.62) return `rgb(${pal.alm} / ${0.35 + v * 0.65})`
  return rampColor(ramp, v)
}

export function paintWaterfall(ctx, w, h, c) {
  const snap = c.snap
  const pal = c.palette || { acc: '125 184 196', dat: '91 232 114', col: '255 176 0', alm: '232 84 63' }
  const ramp = heatRamp(pal)
  if (!wf.cv || wf.cv.width !== WF_COLS || wf.cv.height !== WF_ROWS) {
    wf.cv = document.createElement('canvas')
    wf.cv.width = WF_COLS
    wf.cv.height = WF_ROWS
    wf.lastT = -1
    wf.acc = 0
  }
  const b = wf.cv.getContext('2d')
  if (wf.lastT < 0) {
    // first / settled frame: fill the whole history deterministically
    for (let x = 0; x < WF_COLS; x++) {
      wf.acc = x / COLS_PER_SEC
      const col = wfColumn(snap, { ...c, alert: c.alert }, WF_ROWS)
      for (let y = 0; y < WF_ROWS; y++) {
        b.fillStyle = wfColor(col[y], c.alert, pal, ramp)
        b.fillRect(x, y, 1, 1)
      }
    }
    wf.lastT = c.t
  } else if (c.running) {
    wf.acc += 0
    let adv = (c.t - wf.lastT) * COLS_PER_SEC + wf.acc
    let n = Math.floor(adv)
    wf.acc = adv - n
    n = Math.min(n, WF_COLS)
    if (n > 0) {
      b.drawImage(wf.cv, n, 0, WF_COLS - n, WF_ROWS, 0, 0, WF_COLS - n, WF_ROWS)
      for (let x = 0; x < n; x++) {
        wf.acc += 0.001
        const col = wfColumn(snap, c, WF_ROWS)
        for (let y = 0; y < WF_ROWS; y++) {
          b.fillStyle = wfColor(col[y], c.alert, pal, ramp)
          b.fillRect(WF_COLS - n + x, y, 1, 1)
        }
      }
    }
    wf.lastT = c.t
  }
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(wf.cv, 0, 0, w, h)
  // frequency gridlines + the candidate lane marker
  ctx.strokeStyle = `rgb(${pal.acc} / 0.16)`
  ctx.lineWidth = 1
  for (let i = 1; i < 4; i++) {
    const y = Math.round((h * i) / 4) + 0.5
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
  if (!staleOf(snap) && c.alert > 0.25) {
    const y = h * (1 - 0.38)
    ctx.strokeStyle = `rgb(${pal.col} / 0.8)`
    ctx.setLineDash([6, 4])
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

// ---------------------------------------------------------------------------
// Mini spectrum 140×28: one static-ish bar row from the band shape + heat.
// ---------------------------------------------------------------------------

export function paintMiniSpec(ctx, w, h, c) {
  const snap = c.snap
  const pal = c.palette || { acc: '125 184 196', dat: '91 232 114', col: '255 176 0', alm: '232 84 63' }
  const tick = (snap && snap.tick != null ? snap.tick : c.tick) || 0
  const stale = staleOf(snap)
  const heat = stale ? 0.1 : 0.25 + c.flow * 0.5 + c.reason * 0.25
  const n = 48
  const bw = w / n
  for (let i = 0; i < n; i++) {
    const pos = i / (n - 1)
    const shape = 0.5 + 0.5 * Math.sin(pos * Math.PI * 3 + 1.2)
    const v = Math.min(1, 0.12 + shape * 0.3 + heat * 0.5 + (det(i * 7.3 + Math.floor(tick) * 0.91) - 0.5) * 0.14)
    const bh = Math.max(1, v * h)
    const hot = !stale && Math.abs(pos - 0.62) < 0.03 && c.alert > 0.25
    ctx.fillStyle = hot
      ? `rgb(${pal.col} / 0.95)`
      : v > 0.6
        ? `rgb(${pal.dat} / 0.9)`
        : `rgb(${pal.acc} / ${0.35 + v * 0.5})`
    ctx.fillRect(i * bw + 0.5, h - bh, Math.max(1, bw - 1), bh)
  }
}

// ---------------------------------------------------------------------------
// Latency spark 240×16: recent queue-depth history as a sparkline. Samples
// accumulate per feed tick so the line is stable under reduced motion.
// ---------------------------------------------------------------------------

const sparkHist = []
let sparkTick = -1

export function paintLatencySpark(ctx, w, h, c) {
  const snap = c.snap
  const pal = c.palette || { acc: '125 184 196', dat: '91 232 114', col: '255 176 0', alm: '232 84 63' }
  const tick = (snap && snap.tick != null ? snap.tick : c.tick) || 0
  const k = (snap && snap.kpi) || {}
  if (tick !== sparkTick && snap && snap.mode !== 'offline') {
    sparkTick = tick
    sparkHist.push(k.p95 != null ? k.p95 : k.queue != null ? k.queue : 0.47)
    if (sparkHist.length > 60) sparkHist.splice(0, sparkHist.length - 60)
  }
  const max = Math.max(1, ...sparkHist) * 1.15
  ctx.strokeStyle = `rgb(${pal.acc} / 0.25)`
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, h - 0.5)
  ctx.lineTo(w, h - 0.5)
  ctx.stroke()
  if (sparkHist.length < 2) return
  ctx.strokeStyle = `rgb(${pal.dat} / 0.95)`
  ctx.lineWidth = 1.2
  ctx.beginPath()
  for (let i = 0; i < sparkHist.length; i++) {
    const x = (i / 59) * w
    const y = h - 2 - (sparkHist[i] / max) * (h - 4)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  const lx = ((sparkHist.length - 1) / 59) * w
  const ly = h - 2 - (sparkHist[sparkHist.length - 1] / max) * (h - 4)
  ctx.fillStyle = `rgb(${pal.col} / 1)`
  ctx.fillRect(lx - 1, ly - 1, 2.5, 2.5)
}

// ---------------------------------------------------------------------------
// Dish bars: D-01..06 array levels as one canvas row of vertical bars.
// ---------------------------------------------------------------------------

export function paintDishes(ctx, w, h, c) {
  const snap = c.snap
  const pal = c.palette || { acc: '125 184 196', dat: '91 232 114', col: '255 176 0', alm: '232 84 63' }
  const engines = (snap && snap.engines) || []
  const n = 6
  const bw = w / n
  for (let i = 0; i < n; i++) {
    const e = engines.length ? engines[i % engines.length] : null
    const up = e ? e.up !== false : false
    const share = e && e.rates && e.rates.decode_tps != null ? e.rates.decode_tps : null
    const v = share != null ? Math.min(1, Math.max(0.06, share / 60)) : up ? 0.42 : 0
    const bh = Math.max(2, v * (h - 8))
    const x = i * bw + bw * 0.22
    ctx.fillStyle = `rgb(${pal.acc} / 0.18)`
    ctx.fillRect(x, 4, bw * 0.56, h - 8)
    if (v > 0) {
      ctx.fillStyle = !up ? `rgb(${pal.alm} / 0.7)` : v > 0.8 ? `rgb(${pal.col} / 0.9)` : `rgb(${pal.dat} / 0.85)`
      ctx.fillRect(x, 4 + (h - 8 - bh), bw * 0.56, bh)
    }
  }
}

// Inference Intercept canvas painters. Registered through SceneCanvas; every
// one is a pure function of the conductor (master clock, latest snapshot,
// active palette). No timers, no wall clock, no per-painter accumulators:
// derive every phase from c.t so a held feed freezes cleanly and reduced
// motion settles on one valid frame of the latest data.
//
// Colours come from c.palette ("R G B" channels); the only hard-coded colour
// is the absolute alarm red (ALM), per the conductor contract.

import { ALM } from '../../scene/conductor'
import { decodeOf, lockedEngine, upEngines, sessionFill, meanPrompt } from './shared'

const chan = (s) => String(s || '0 0 0').trim().split(/\s+/).map(Number)
const rgba = (s, a) => `rgba(${chan(s).join(',')},${a})`

// Deterministic hash noise in [0,1): stable per argument, no RNG state.
function det(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function bracket(ctx, bx, by, dx, dy, armW, armH) {
  ctx.beginPath()
  ctx.moveTo(bx + dx * armW, by)
  ctx.lineTo(bx, by)
  ctx.lineTo(bx, by + dy * armH)
  ctx.stroke()
}

// ---------------------------------------------------------------------------
// paintEngines — the engine lock view. Each engine is a target on a load
// lattice: x spreads the engines across the panel, y is the engine's queue
// load (queue depth / 16), and a fill bar under each target restates the
// same figure as a bar. The locked engine (the first up engine decoding)
// gets full lock-on brackets, an amber bullseye and a pulsing lock ring;
// the rest sit under lighter brackets. The desk sweep runs on the decode
// rate and parks mid-sweep while dormant. Ghost: none up, dashed rings.
// ---------------------------------------------------------------------------

export function paintEngines(ctx, w, h, c) {
  const p = c.palette
  const snap = c.snap
  const engines = ((snap && snap.engines) || []).filter((e) => e && e.key)
  const up = engines.filter((e) => e.up !== false)
  const locked = lockedEngine(snap)
  const decode = decodeOf(snap)
  const live = locked && snap && snap.mode !== 'offline' && snap.mode !== 'boot' && decode > 0
  const alarm = c.alert > 0.6
  const sweepRate = 0.02 + Math.min(1, decode / 280) * 0.05

  // Base wash: cool radial bloom, token-driven.
  const base = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, Math.max(w, h) * 0.55)
  base.addColorStop(0, rgba(p.acc, 0.14))
  base.addColorStop(0.6, rgba(p.acc, 0.05))
  base.addColorStop(1, rgba(p.acc, 0))
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)

  // Load lattice: five load lines with a percent scale on the left rail.
  ctx.strokeStyle = rgba(p.acc, 0.1)
  ctx.fillStyle = rgba(p.acc, 0.45)
  ctx.lineWidth = 1
  ctx.font = '8px ui-monospace, monospace'
  ctx.textAlign = 'left'
  for (let i = 0; i <= 4; i++) {
    const f = 1 - i / 4
    const y = Math.round(10 + f * (h - 26)) + 0.5
    ctx.beginPath()
    ctx.moveTo(30, y)
    ctx.lineTo(w, y)
    ctx.stroke()
    ctx.fillText(`${i * 25}`, 6, y + 2.5)
  }

  // Sparse keyed dot field: atmosphere dots seeded by the lattice, so the
  // frame reads as depth without inventing imagery.
  const nDots = Math.max(240, Math.floor((w * h) / 9000))
  for (let i = 0; i < nDots; i++) {
    const x = det(i * 1.31) * w
    const y = det(i * 2.71) * h
    const bri = 0.05 + det(i * 7.77) * 0.22
    ctx.fillStyle = rgba(p.col, bri.toFixed(3))
    ctx.fillRect(x, y, 1, 1)
  }

  // Session field: one dot per live session, y is the session's context
  // fill on the same lattice scale, x cycles the sessions across the span.
  // Warm past the watch line, alarm red past the hot line. Stale sessions
  // (a held feed) just stop where the feed stopped.
  const sessions = (((snap && snap.sessions) || []) || []).slice(0, 40)
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i]
    const win = s.window || 0
    const fill = win ? Math.min(1, (s.used || 0) / win) : null
    if (fill == null) continue
    const sx = 30 + ((i + 0.5) / sessions.length) * (w - 30)
    const sy = 10 + (1 - fill) * (h - 26)
    const tint = fill >= 0.85 ? ALM : fill >= 0.6 ? p.dat : p.acc
    ctx.fillStyle = rgba(tint, fill >= 0.6 ? 0.8 : 0.45)
    ctx.fillRect(sx, sy, 2, 2)
  }

  // Coarse engineering grid.
  ctx.strokeStyle = rgba(p.acc, 0.07)
  const step = 56
  for (let x = 0; x <= w; x += step) {
    ctx.beginPath()
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, h)
    ctx.stroke()
  }
  for (let y = 0; y <= h; y += step) {
    ctx.beginPath()
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(w, y + 0.5)
    ctx.stroke()
  }

  // Desk scan on the decode rate, parked mid-sweep while dormant.
  const sweepX = live && !c.reduced ? ((((c.t * sweepRate + 0.5) % 1) + 1) % 1) * w : w * 0.5
  const band = ctx.createLinearGradient(sweepX - 44, 0, sweepX, 0)
  band.addColorStop(0, rgba(p.acc, 0))
  band.addColorStop(1, rgba(p.acc, 0.12))
  ctx.fillStyle = band
  ctx.fillRect(Math.max(0, sweepX - 44), 0, Math.min(44, sweepX), h)
  ctx.strokeStyle = rgba(p.acc, 0.5)
  ctx.beginPath()
  ctx.moveTo(sweepX + 0.5, 0)
  ctx.lineTo(sweepX + 0.5, h)
  ctx.stroke()

  // Targets: x spreads the shown engines, y is queue load.
  const shown = engines.slice(0, 6)
  const n = Math.max(1, shown.length)
  const padL = 40
  const padR = 20
  const xAt = (i) => (n === 1 ? w * 0.5 : padL + (i / (n - 1)) * (w - padL - padR))
  const yAt = (load) => 10 + (1 - Math.min(1, Math.max(0, load))) * (h - 26)

  for (let i = 0; i < shown.length; i++) {
    const e = shown[i]
    const isLock = locked && e.key === locked.key
    const load = (e.queue != null ? Math.min(1, e.queue / 16) : 0)
    const x = xAt(i)
    const y = yAt(load)
    const half = isLock ? Math.min(26, w / (n * 2.2)) : Math.min(18, w / (n * 3))
    const tint = alarm && isLock ? ALM : isLock ? p.dat : p.acc
    const alpha = e.up === false ? 0.3 : isLock ? 0.95 : 0.6

    // load bar under the target
    const barW = half * 2.4
    ctx.fillStyle = rgba(p.acc, 0.18)
    ctx.fillRect(x - barW / 2, y + half + 6, barW, 3)
    ctx.fillStyle = rgba(tint, alpha * 0.9)
    ctx.fillRect(x - barW / 2, y + half + 6, barW * load, 3)

    // brackets
    ctx.strokeStyle = rgba(tint, alpha)
    ctx.lineWidth = isLock ? 1.6 : 1
    bracket(ctx, x - half, y - half, 1, 1, half * 0.55, half * 0.55)
    bracket(ctx, x + half, y - half, -1, 1, half * 0.55, half * 0.55)
    bracket(ctx, x - half, y + half, 1, -1, half * 0.55, half * 0.55)
    bracket(ctx, x + half, y + half, -1, -1, half * 0.55, half * 0.55)

    // cross ticks
    ctx.strokeStyle = rgba(tint, alpha * 0.7)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x - 10, y + 0.5)
    ctx.lineTo(x + 10, y + 0.5)
    ctx.moveTo(x + 0.5, y - 10)
    ctx.lineTo(x + 0.5, y + 10)
    ctx.stroke()

    if (e.up === false) {
      // down engine: hollow dashed ring, no lock
      ctx.setLineDash([3, 3])
      ctx.strokeStyle = rgba(p.acc, 0.4)
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      continue
    }

    if (isLock) {
      // amber bullseye + pulsing lock ring on the locked engine
      ctx.strokeStyle = rgba(p.dat, 0.95)
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = rgba(p.dat, 0.85)
      ctx.beginPath()
      ctx.arc(x, y, 1.6, 0, Math.PI * 2)
      ctx.fill()
      if (!c.reduced) {
        const ring = (c.t * 0.7) % 1
        ctx.strokeStyle = rgba(p.dat, (0.55 * (1 - ring)).toFixed(3))
        ctx.beginPath()
        ctx.arc(x, y, 5 + ring * 22, 0, Math.PI * 2)
        ctx.stroke()
      }
      // leader toward the dossier card (bottom right)
      ctx.setLineDash([2, 3])
      ctx.strokeStyle = rgba(p.dat, 0.6)
      ctx.beginPath()
      ctx.moveTo(x + half, y + half)
      ctx.lineTo(w - 178, h - 34)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // engine tag + rate under the target
    ctx.fillStyle = rgba(isLock ? p.dat : p.col, isLock ? 0.95 : 0.75)
    ctx.textAlign = 'center'
    ctx.font = '8px ui-monospace, monospace'
    const key = String(e.key || e.label || `eng-${i}`).toUpperCase()
    const r = e.rates && e.rates.decode_tps
    ctx.fillText(key.slice(0, 10), x, y + half + 18)
    ctx.fillText(r != null && isFinite(r) ? `${Math.round(r)} TOK/S` : '—', x, y + half + 28)
  }
}

// ---------------------------------------------------------------------------
// paintTrace — the two intercept scopes. A factory: the decode trace plots
// kpiHist.tps (the real decode history, tokens per second); the prefill
// trace plots arrivals (kpiHist.rpm) times the mean prompt size of the
// newest requests, spread out per second. Both normalise against their own
// peak so a quiet feed still reads. When `alert` > 0.6 the trace takes the
// absolute alarm tint; the live edge dot and the scan cursor ride the
// master clock and park under reduced motion or a held feed.
// ---------------------------------------------------------------------------

const TRACE_WIN = 120

export function paintTrace(kind) {
  const voice = kind === 'a' // a = decode, b = prefill
  return function drawTrace(ctx, w, h, c) {
    const p = c.palette
    const t = c.t
    const stale = !c.snap || c.snap.mode === 'offline' || c.snap.mode === 'boot'
    const k = (c.snap && c.snap.kpi) || {}
    const hist = (c.snap && c.snap.kpiHist) || {}

    // The series this scope plots, tokens per second for both.
    let series
    if (!voice) {
      const mp = meanPrompt(c.snap && c.snap.requests) || 0
      series = (hist.rpm || []).slice(-TRACE_WIN).map((v) => (v / 60) * mp)
    } else {
      series = (hist.tps || []).slice(-TRACE_WIN)
    }
    const head = voice ? (k.tps != null && isFinite(k.tps) ? k.tps : null) : series.length ? series[series.length - 1] : null
    const alarm = c.alert > 0.6
    const tint = alarm ? ALM : voice ? p.dat : p.acc

    // Faint scope grid: 4 horizontal divisions, 8 vertical, center line.
    ctx.strokeStyle = rgba(p.acc, 0.1)
    ctx.lineWidth = 1
    for (let i = 1; i < 4; i++) {
      const y = Math.round((h * i) / 4) + 0.5
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }
    for (let i = 1; i < 8; i++) {
      const x = Math.round((w * i) / 8) + 0.5
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }

    // Scale: the decode scope plots against the fixed 0..300 tok/s ruler
    // its DOM scale prints (clipped); the prefill scope normalises against
    // its own peak, so its ruler reads as percent of peak.
    let peak = 0
    for (const v of series) if (v > peak) peak = v
    if (head != null && head > peak) peak = head
    if (peak <= 0) peak = 1
    const span = voice ? 300 : peak

    const n = series.length
    const xAt = (i) => (n <= 1 ? w : ((i - (TRACE_WIN - n)) / (TRACE_WIN - 1)) * w)
    const yAt = (v) => h - 2 - (Math.min(span, Math.max(0, v)) / span) * (h - 6)

    if (n >= 2) {
      // filled envelope under the crisp trace
      ctx.beginPath()
      ctx.moveTo(xAt(0), h)
      for (let i = 0; i < n; i++) ctx.lineTo(xAt(i), yAt(series[i]))
      ctx.lineTo(xAt(n - 1), h)
      ctx.closePath()
      ctx.fillStyle = rgba(tint, 0.16)
      ctx.fill()

      // soft glow under the crisp trace
      ctx.beginPath()
      for (let i = 0; i < n; i++) {
        const px = xAt(i)
        const py = yAt(series[i])
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.strokeStyle = rgba(tint, 0.2)
      ctx.lineWidth = 4
      ctx.stroke()

      // crisp trace
      ctx.beginPath()
      for (let i = 0; i < n; i++) {
        const px = xAt(i)
        const py = yAt(series[i])
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.strokeStyle = rgba(tint, 0.95)
      ctx.lineWidth = 1.2
      ctx.stroke()
    }

    // peak tick: the running maximum of the visible window
    if (n >= 2) {
      let pk = 0
      let pkI = 0
      for (let i = 0; i < n; i++) if (series[i] > pk) { pk = series[i]; pkI = i }
      ctx.strokeStyle = rgba(p.col, 0.7)
      ctx.lineWidth = 1
      ctx.setLineDash([2, 3])
      ctx.beginPath()
      ctx.moveTo(xAt(pkI) + 0.5, yAt(pk))
      ctx.lineTo(w, yAt(pk))
      ctx.stroke()
      ctx.setLineDash([])
      // the peak figure on the dashed line, clear of the header readout
      if (yAt(pk) > 22) {
        ctx.fillStyle = rgba(p.col, 0.85)
        ctx.font = '7px ui-monospace, monospace'
        ctx.textAlign = 'right'
        ctx.fillText(`${Math.round(pk)}`, w - 3, yAt(pk) + 8)
      }
    }

    // live head dot on the newest sample, riding the clock
    if (!c.reduced && !stale && head != null) {
      const hx = n >= 2 ? xAt(n - 1) : w - 2
      const hy = yAt(head)
      const pulse = Math.sin(t * 5.2) * 0.5 + 0.5
      ctx.fillStyle = rgba(tint, (0.4 + pulse * 0.55).toFixed(3))
      ctx.beginPath()
      ctx.arc(hx, hy, 2.2 + pulse * 1.2, 0, Math.PI * 2)
      ctx.fill()
    }

    // Scan cursor: soft alarm-red sweep while live, parked mid-trace dormant.
    const scanX = (c.reduced || stale ? 0.5 : ((((t * (voice ? 0.22 : 0.29)) % 1) + 1) % 1)) * w
    ctx.strokeStyle = rgba(ALM, 0.5)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(scanX + 0.5, 0)
    ctx.lineTo(scanX + 0.5, h)
    ctx.stroke()
  }
}

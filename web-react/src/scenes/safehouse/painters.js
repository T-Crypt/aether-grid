// Safehouse canvas painters. Registered through SceneCanvas; every one is a
// pure function of the conductor (master clock, latest snapshot, active
// palette). No timers, no wall clock, no per-painter accumulators: derive
// every phase from c.t so a held feed freezes cleanly and reduced motion
// settles on one valid frame of the latest data.
//
// Colours come from c.palette ("R G B" channels); the only hard-coded colour
// is the absolute alarm red (ALM), per the conductor contract.

import { ALM } from '../../scene/conductor'

const chan = (s) => String(s || '0 0 0').trim().split(/\s+/).map(Number)
const rgba = (s, a) => `rgba(${chan(s).join(',')},${a})`

// Deterministic hash noise in [0,1): stable per argument, no RNG state.
function det(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// ---------------------------------------------------------------------------
// paintSat — procedural satellite field for the signal-tracking module.
//
// The dot terrain is position-derived (hash noise), so it is static per
// position and reduced motion shows a valid aerial frame. The slow scan
// sweep and the reticle pulse ride the master clock. The target reticle
// locks on the first engine that is up; with none up it renders as a ghost
// (hollow, no bullseye) to match the panel's "no source" state.
// ---------------------------------------------------------------------------

// Static dot field, cached per canvas size: positions are hash-derived, so
// the cache only avoids re-deriving thousands of points on resize.
let satCache = { key: '', dots: [] }
function satField(w, h) {
  const key = `${w}x${h}`
  if (satCache.key === key) return satCache.dots
  const n = Math.max(700, Math.floor((w * h) / 4500))
  const dots = []
  for (let i = 0; i < n; i++) {
    const x = det(i * 1.31) * w
    const y = det(i * 2.71) * h
    const u = x / w
    const v = y / h
    // Fake terrain: low-frequency cosine sums, like a sparse recon photo.
    const terrain = 0.5 + 0.32 * Math.cos(u * 6 + v * 1.3) + 0.18 * Math.cos(u * 13 + v * 5.1 + 1.7)
    let bri = Math.min(1, Math.max(0.05, terrain * 0.8 + (det(i * 7.77) - 0.5) * 0.45))
    bri *= 0.85 // bias dark: it is a night recon image
    dots.push({ x, y, bri, s: 0.6 + det(i * 3.31) * 1.6 })
  }
  satCache = { key, dots }
  return dots
}

function bracket(ctx, bx, by, dx, dy, armW, armH) {
  ctx.beginPath()
  ctx.moveTo(bx + dx * armW, by)
  ctx.lineTo(bx, by)
  ctx.lineTo(bx, by + dy * armH)
  ctx.stroke()
}

export function paintSat(ctx, w, h, c) {
  const p = c.palette
  const snap = c.snap
  const engines = (snap && snap.engines) || []
  const locked = engines.find((e) => e && e.up)
  // The desk scan runs on decode: sweep speed tracks the serving decode
  // rate and parks mid-sweep while dormant (no lock, held feed, offline).
  // Brightness follows activity; the bullseye follows lock alone.
  const decode = engines
    .filter((e) => e && e.up !== false)
    .reduce((a, e) => a + (e && e.rates && e.rates.decode_tps != null ? e.rates.decode_tps : 0), 0)
  const live = locked && snap && snap.mode !== 'offline' && snap.mode !== 'boot' && decode > 0
  const sweepRate = 0.02 + Math.min(1, decode / 280) * 0.05

  // Base wash: cool radial bloom, token-driven.
  const base = ctx.createRadialGradient(w * 0.5, h * 0.55, 0, w * 0.5, h * 0.55, Math.max(w, h) * 0.55)
  base.addColorStop(0, rgba(p.acc, 0.14))
  base.addColorStop(0.6, rgba(p.acc, 0.05))
  base.addColorStop(1, rgba(p.acc, 0))
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)

  // Aerial dot field (cool role = the reference's bluish-white imagery).
  for (const d of satField(w, h)) {
    ctx.fillStyle = rgba(p.col, (d.bri * 0.38).toFixed(3))
    ctx.fillRect(d.x, d.y, d.s, d.s)
  }

  // Coarse engineering grid.
  ctx.strokeStyle = rgba(p.acc, 0.07)
  ctx.lineWidth = 1
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

  // Scan sweep on the decode rate. Phase offset 0.5 so the parked
  // (dormant / reduced-motion / held-feed) frame reads mid-sweep.
  const sweepX = live && !c.reduced ? (((c.t * sweepRate + 0.5) % 1) + 1) % 1 : 0.5
  const sx = sweepX * w
  const band = ctx.createLinearGradient(sx - 44, 0, sx, 0)
  band.addColorStop(0, rgba(p.acc, 0))
  band.addColorStop(1, rgba(p.acc, 0.12))
  ctx.fillStyle = band
  ctx.fillRect(Math.max(0, sx - 44), 0, Math.min(44, sx), h)
  ctx.strokeStyle = rgba(p.acc, 0.5)
  ctx.beginPath()
  ctx.moveTo(sx + 0.5, 0)
  ctx.lineTo(sx + 0.5, h)
  ctx.stroke()

  // Target reticle: the one "locked" engine, or a ghost when none is up.
  const cx = w * 0.5
  const cy = h * 0.55
  const halfW = w * 0.16
  const halfH = h * 0.2
  const pulse = c.reduced || !live ? 0.35 : Math.sin(c.t * 3.9) * 0.5 + 0.5
  const armW = Math.min(28, halfW * 0.6)
  const armH = Math.min(22, halfH * 0.6)

  const retAlpha = live ? 0.7 + pulse * 0.3 : 0.35
  ctx.strokeStyle = rgba(p.acc, retAlpha)
  ctx.lineWidth = 1.4
  bracket(ctx, cx - halfW, cy - halfH, 1, 1, armW, armH)
  bracket(ctx, cx + halfW, cy - halfH, -1, 1, armW, armH)
  bracket(ctx, cx - halfW, cy + halfH, 1, -1, armW, armH)
  bracket(ctx, cx + halfW, cy + halfH, -1, -1, armW, armH)

  ctx.strokeStyle = rgba(p.acc, locked ? 0.55 : 0.3)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cx - 18, cy)
  ctx.lineTo(cx + 18, cy)
  ctx.moveTo(cx, cy - 18)
  ctx.lineTo(cx, cy + 18)
  ctx.stroke()

  if (locked) {
    // Amber bullseye on the locked target.
    ctx.strokeStyle = rgba(p.dat, 0.95)
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(cx, cy, 5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = rgba(p.dat, 0.85)
    ctx.beginPath()
    ctx.arc(cx, cy, 1.6, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // Ghost: hollow dashed ring, no lock.
    ctx.setLineDash([3, 3])
    ctx.strokeStyle = rgba(p.acc, 0.45)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(cx, cy, 7, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

// ---------------------------------------------------------------------------
// paintWave — the two oscilloscope canvases. A factory: wave A tracks the
// `reason` scalar (Strata thinking rate) as a smooth mirrored voice
// envelope (data amber); wave B tracks `flow` (token rate) as packetized
// data stems (accent). Per-frame detail is a seeded pseudo-noise of the
// conductor clock, so a settled frame is deterministic. When `alert` > 0.6
// the trace takes the absolute alarm tint.
// ---------------------------------------------------------------------------

export function paintWave(kind) {
  const voice = kind === 'a'
  return function drawWave(ctx, w, h, c) {
    const p = c.palette
    const t = c.t
    // Dormant desk: a stale feed parks the trace at its floor (flat held
    // line behind the panel's NO SOURCE veil) and freezes the noise step.
    const stale = !c.snap || c.snap.mode === 'offline' || c.snap.mode === 'boot'
    const scalar = stale ? 0 : Math.min(1, voice ? c.reason : c.flow)
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
    ctx.strokeStyle = rgba(p.acc, 0.3)
    ctx.beginPath()
    ctx.moveTo(0, h / 2 + 0.5)
    ctx.lineTo(w, h / 2 + 0.5)
    ctx.stroke()

    const cy = h / 2
    const ampScale = h * 0.44
    const amp = 0.18 + 0.82 * scalar
    const samples = voice ? 160 : 96
    const frame = c.reduced || stale ? 0 : Math.floor(t * 8) // 8 Hz seeded noise step, deterministic in t

    // One sample per column, signed displacement in pixels.
    const y = new Array(samples + 1)
    for (let i = 0; i <= samples; i++) {
      const x = i / samples
      const nz = det(i * 12.9898 + frame * 78.233 + (voice ? 0 : 4096)) - 0.5
      let v
      if (voice) {
        // Smooth tonal voice envelope with a slow breath, harmonics and a
        // noise floor; amplitude and mid-band emphasis follow `reason`.
        const env = 0.55 + 0.45 * Math.sin(x * Math.PI * 3.2 + t * 0.5)
        v =
          env *
          (0.5 * Math.sin(x * Math.PI * 10 + t * 2.2) +
            0.2 * Math.sin(x * Math.PI * 20.4 + t * 1.3 + 1.1) +
            0.16 * nz)
      } else {
        // Packetized data stream: sawtooth bursts gated by a slow envelope,
        // chunkier noise, harsher edges.
        const gate = Math.sin(x * Math.PI * 4.6 + t * 1.7 + 1.7) > 0.1 ? 1 : 0.32
        const ph = x * 6.5
        const saw = 2 * (ph - Math.floor(ph + 0.5))
        v = gate * (0.55 * saw + 0.22 * Math.sin(x * Math.PI * 35.6 + 0.9) + 0.18 * nz)
      }
      y[i] = v * amp * ampScale
    }

    const xAt = (i) => (i / samples) * w

    if (voice) {
      // Filled waveform: envelope mirrored about the center line.
      const mag = (i) => Math.abs(y[i])
      ctx.beginPath()
      ctx.moveTo(0, cy - mag(0))
      for (let i = 1; i <= samples; i++) ctx.lineTo(xAt(i), cy - mag(i))
      for (let i = samples; i >= 0; i--) ctx.lineTo(xAt(i), cy + mag(i))
      ctx.closePath()
      ctx.fillStyle = rgba(tint, 0.28)
      ctx.fill()

      // Soft glow under the crisp trace.
      ctx.beginPath()
      for (let i = 0; i <= samples; i++) {
        const px = xAt(i)
        const py = cy - mag(i)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.strokeStyle = rgba(tint, 0.18)
      ctx.lineWidth = 4
      ctx.stroke()

      // Crisp top trace + mirrored bottom.
      ctx.beginPath()
      for (let i = 0; i <= samples; i++) {
        const px = xAt(i)
        const py = cy - mag(i)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.strokeStyle = rgba(tint, 0.95)
      ctx.lineWidth = 1.2
      ctx.stroke()

      ctx.beginPath()
      for (let i = 0; i <= samples; i++) {
        const px = xAt(i)
        const py = cy + mag(i)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.strokeStyle = rgba(tint, 0.42)
      ctx.lineWidth = 1
      ctx.stroke()
    } else {
      // Data stream: asymmetric stems rising or falling from the center
      // line, chunkier than the voice trace, with peak ticks on the cool
      // role for the packet markers.
      const stepX = w / samples
      const barW = Math.max(1.4, stepX * 0.62)
      const stem = (alpha) => {
        ctx.fillStyle = rgba(tint, alpha)
        for (let i = 0; i < samples; i++) {
          const top = y[i] >= 0 ? cy - y[i] : cy
          const height = Math.max(0.5, Math.abs(y[i]))
          ctx.fillRect(i * stepX + (stepX - barW) / 2, top, barW, height)
        }
      }
      stem(0.16)
      stem(0.8)
      ctx.fillStyle = rgba(p.col, 0.55)
      for (let i = 0; i < samples; i += 4) {
        if (Math.abs(y[i]) < ampScale * 0.3) continue
        const top = y[i] >= 0 ? cy - y[i] - 1 : cy + y[i]
        ctx.fillRect(i * stepX + (stepX - barW) / 2, top, barW + 1, 1)
      }
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

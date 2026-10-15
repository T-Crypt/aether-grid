// Bloom-Line canvas painters. Registered through SceneCanvas; every one is a
// pure function of the conductor (master clock, latest snapshot, active
// palette). No timers, no wall clock, no per-painter accumulators: derive
// every phase from c.t so a held feed freezes cleanly and reduced motion
// settles on one valid frame of the latest data.
//
// Colours come from c.palette ("R G B" channels); the only hard-coded colour
// is the absolute alarm red (ALM), per the conductor contract.

import { ALM } from '../../scene/conductor'
import { staleOf } from './shared'

const chan = (s) => String(s || '0 0 0').trim().split(/\s+/).map(Number)
const rgba = (s, a) => `rgba(${chan(s).join(',')},${a})`

// Deterministic hash noise in [0,1): stable per argument, no RNG state.
function det(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// Seeded LCG so the pre-generated micro filaments are identical on every
// load (module-level: built once, never re-seeded).
function lcg(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

// ---------------------------------------------------------------------------
// paintBioreactor — the hero schematic: orbital-greenhouse cutaway (12-tank
// ring around the hub, patch-cable network, drone bay arc, mirror array)
// whose density, glow and bloom hotspots follow `flow` and `heat`. All
// rotation/flow phases derive from c.t, so the settled frame is stable.
// ---------------------------------------------------------------------------

export function paintBioreactor(ctx, w, h, c) {
  const p = c.palette
  const t = c.t
  // Dormant loop: a stale feed (offline/boot/zero-tps) parks the scalars at
  // zero so glow, dots and drift settle — the greenhouse reads HELD in its
  // own voice (stage dim + swept callouts in Scene.jsx carry the DOM half).
  const stale = staleOf(c.snap)
  const flow = stale ? 0 : Math.min(1, c.flow)
  const heat = stale ? 0 : Math.min(1, c.reduced ? 0.5 : c.heat)
  const alert = stale ? 0 : Math.min(1, c.alert)
  const anim = !c.reduced && !stale
  // Nucleus reactivity: the bloom answers the inference load, not just the
  // conductor smoothing. MTP accept sets the pulse rate, the thinking-token
  // count sets the bloom density, tok/s runs the tank LEDs. A stale feed
  // parks all three at zero, so the loop settles to its dormant drift.
  const rs = (c.snap && c.snap.reasoning) || {}
  const mtp = stale ? 0 : rs.mtp_accept_pct != null ? Math.min(1, Math.max(0, rs.mtp_accept_pct / 100)) : Math.min(1, c.reason)
  const think = stale ? 0 : rs.thinking_tokens != null ? Math.min(1, Math.max(0, rs.thinking_tokens / 400)) : Math.min(1, c.reason)
  const tpsRate = stale ? 0 : Math.min(1, Math.max(0, ((c.snap && c.snap.kpi && c.snap.kpi.tps) || 0) / 280))
  const performing = !stale && think > 0.5

  const cx = w / 2
  const cy = h / 2
  const rmax = Math.min(w * 0.4, h * 0.46)
  if (rmax < 24) return

  // Per-tank data: engine KV fill per ring position (the card's tank mapping).
  const engines = (c.snap && c.snap.engines) || []
  const sessions = (c.snap && c.snap.sessions) || []
  const fills = []
  for (let i = 0; i < 12; i++) {
    const e = engines.length ? engines[i % engines.length] : null
    const sess = (e && e.sessions) || []
    let used = 0
    let win = 0
    for (const s of sess) {
      used += s.used || 0
      win += s.window || 0
    }
    fills.push(win > 0 ? Math.min(1, used / win) : e ? (e.up === false ? 0 : 0.4) : 0)
  }
  // The bloom tank: hottest fill; with no telemetry the reference's native
  // position (Z-06, P23) stays so the settled frame matches the reference.
  let bloomIdx = 5
  let best = -1
  for (let i = 0; i < 12; i++) {
    if (fills[i] > best) {
      best = fills[i]
      bloomIdx = i
    }
  }
  if (engines.length === 0) bloomIdx = 5

  // ---------- Background wash (subtle radial, token-driven) ----------
  const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rmax * 1.2)
  bgGrad.addColorStop(0, rgba(p.acc, 0.08 + heat * 0.06))
  bgGrad.addColorStop(0.55, rgba(p.acc, 0.02))
  bgGrad.addColorStop(1, rgba(p.acc, 0))
  ctx.fillStyle = bgGrad
  ctx.beginPath()
  ctx.arc(cx, cy, rmax * 1.2, 0, Math.PI * 2)
  ctx.fill()

  // ---------- Bloom hotspots: warm radial glows that grow with `heat` ----------
  // (live only: stale parks the loop at its settled glow; MTP accept hurries
  // the breathe and the thinking count feeds the glow).
  for (let k = 0; k < 3; k++) {
    const a = det(k * 7.31) * Math.PI * 2
    const rr = rmax * (0.3 + det(k * 3.17) * 0.4)
    const hx = cx + Math.cos(a) * rr
    const hy = cy + Math.sin(a) * rr
    const breathe = anim ? 0.9 + 0.1 * Math.sin(t * (0.9 + mtp * 1.8) + k * 2.1) : 1
    const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, rmax * (0.10 + heat * 0.16 + think * 0.06) * breathe)
    glow.addColorStop(0, rgba(p.dat, 0.10 + heat * 0.22 + think * 0.08))
    glow.addColorStop(1, rgba(p.dat, 0))
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(hx, hy, rmax * (0.1 + heat * 0.18 + think * 0.07) * breathe, 0, Math.PI * 2)
    ctx.fill()
  }

  // ---------- Outer module shell ----------
  ctx.strokeStyle = rgba(p.col, 0.42)
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.arc(cx, cy, rmax * 0.98, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = rgba(p.acc, 0.18)
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.arc(cx, cy, rmax * 1.04, 0, Math.PI * 2)
  ctx.stroke()

  // ---------- Hub ring (central walkway / habitat tube) ----------
  ctx.strokeStyle = rgba(p.acc, 0.4)
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.arc(cx, cy, rmax * 0.16, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = rgba(p.acc, 0.18)
  ctx.lineWidth = 0.7
  ctx.beginPath()
  ctx.arc(cx, cy, rmax * 0.1, 0, Math.PI * 2)
  ctx.stroke()
  const habAng = (20 * Math.PI) / 180
  ctx.fillStyle = rgba(p.dat, 0.45)
  ctx.fillRect(cx + Math.cos(habAng) * rmax * 0.16 - 3, cy + Math.sin(habAng) * rmax * 0.16 - 3, 6, 6)

  // ---------- Hydroponic loop (dashed ring; flow arrows turn with flow) ----------
  ctx.strokeStyle = rgba(p.col, 0.3)
  ctx.lineWidth = 0.8
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  ctx.arc(cx, cy, rmax * 0.5, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  const yaw = anim ? t * (0.1 + flow * 0.5 + mtp * 0.3) : Math.PI * 0.35
  ctx.strokeStyle = rgba(p.col, 0.55)
  ctx.lineWidth = 0.9
  const arrows = 4 + Math.round(flow * 6 + think * 3) // density follows flow + thinking
  for (let i = 0; i < arrows; i++) {
    const a = yaw * 0.4 + (i / arrows) * Math.PI * 2
    const ax = cx + Math.cos(a) * rmax * 0.5
    const ay = cy + Math.sin(a) * rmax * 0.5
    const tx = -Math.sin(a) * 5
    const ty = Math.cos(a) * 5
    ctx.beginPath()
    ctx.moveTo(ax - tx, ay - ty)
    ctx.lineTo(ax + tx, ay + ty)
    ctx.lineTo(ax + tx - Math.cos(a) * 3, ay + ty - Math.sin(a) * 3)
    ctx.stroke()
  }

  // ---------- Patch-cable network: seeded bezier looms + flow dots ----------
  const cables = []
  for (let i = 0; i < 12; i++) {
    const a = (-90 + (i / 12) * 360) * (Math.PI / 180)
    const x1 = cx + Math.cos(a) * rmax * 0.62
    const y1 = cy + Math.sin(a) * rmax * 0.62
    const sag = (det(i * 9.13) - 0.5) * rmax * 0.3
    cables.push({
      x1, y1,
      x2: cx, y2: cy,
      cx1: (x1 + cx) / 2 + Math.cos(a + Math.PI / 2) * sag,
      cy1: (y1 + cy) / 2 + Math.sin(a + Math.PI / 2) * sag,
      ph: det(i * 4.71),
    })
  }
  // a few cross-loom between opposite tanks
  for (let i = 0; i < 4; i++) {
    const a1 = (-90 + (i / 12) * 360) * (Math.PI / 180)
    const a2 = a1 + Math.PI
    const x1 = cx + Math.cos(a1) * rmax * 0.62
    const y1 = cy + Math.sin(a1) * rmax * 0.62
    const x2 = cx + Math.cos(a2) * rmax * 0.62
    const y2 = cy + Math.sin(a2) * rmax * 0.62
    const mid = det(i * 17.7) * Math.PI * 2
    cables.push({
      x1, y1, x2, y2,
      cx1: (x1 + x2) / 2 + Math.cos(mid) * rmax * 0.2,
      cy1: (y1 + y2) / 2 + Math.sin(mid) * rmax * 0.2,
      ph: 0.3 + det(i * 23.7) * 0.5,
    })
  }
  ctx.strokeStyle = rgba(p.acc, 0.16)
  ctx.lineWidth = 0.7
  for (const cb of cables) {
    ctx.beginPath()
    ctx.moveTo(cb.x1, cb.y1)
    ctx.quadraticCurveTo(cb.cx1, cb.cy1, cb.x2, cb.y2)
    ctx.stroke()
  }
  // Flow dots travel the cables; count and speed follow `flow`, MTP and the
  // thinking count (an accepting, thinking run reads visibly busier).
  const dots = 3 + Math.round(flow * 10 + think * 8)
  ctx.fillStyle = rgba(p.col, 0.8)
  for (let d = 0; d < dots; d++) {
    const cb = cables[d % cables.length]
    const u = anim ? (t * (0.05 + flow * 0.16 + mtp * 0.1) + cb.ph + d * 0.13) % 1 : 0.2 + cb.ph * 0.6
    const v = 1 - u
    const x = v * v * cb.x1 + 2 * v * u * cb.cx1 + u * u * cb.x2
    const y = v * v * cb.y1 + 2 * v * u * cb.cy1 + u * u * cb.y2
    ctx.beginPath()
    ctx.arc(x, y, 1.6, 0, Math.PI * 2)
    ctx.fill()
  }

  // ---------- Spokes (structural support to outer shell) ----------
  ctx.strokeStyle = rgba(p.acc, 0.16)
  ctx.lineWidth = 0.7
  for (let s = 0; s < 12; s++) {
    const a = (s / 12) * Math.PI * 2 - Math.PI / 2
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * rmax * 0.16, cy + Math.sin(a) * rmax * 0.16)
    ctx.lineTo(cx + Math.cos(a) * rmax * 0.95, cy + Math.sin(a) * rmax * 0.95)
    ctx.stroke()
  }

  // ---------- 12 hydroponic tanks (the ring) ----------
  const tankRingR = rmax * 0.62
  for (let i = 0; i < 12; i++) {
    const angDeg = -90 + (i / 12) * 360
    const angRad = angDeg * (Math.PI / 180)
    const tx = cx + Math.cos(angRad) * tankRingR
    const ty = cy + Math.sin(angRad) * tankRingR
    const fill = Math.min(1, fills[i] + (anim ? Math.sin(t * 0.5 + i * 0.5) * 0.014 : 0))
    const tankR = rmax * (0.075 + fill * 0.02)
    const isBloom = i === bloomIdx && (engines.length > 0 ? best >= 0.55 : true)

    ctx.save()
    ctx.translate(tx, ty)

    // Tank disk: radial fill whose warmth follows per-tank fill + heat.
    const inner = ctx.createRadialGradient(0, 0, 0, 0, 0, tankR)
    if (isBloom) {
      inner.addColorStop(0, rgba(heat > 0.55 ? ALM : p.col, 0.5))
      inner.addColorStop(0.5, rgba(p.dat, 0.3))
      inner.addColorStop(1, rgba(p.acc, 0.08))
    } else {
      inner.addColorStop(0, rgba(p.acc, 0.12 + fill * 0.3))
      inner.addColorStop(0.5, rgba(p.acc, 0.08))
      inner.addColorStop(1, rgba(p.acc, 0.03))
    }
    ctx.fillStyle = inner
    ctx.beginPath()
    ctx.arc(0, 0, tankR, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = isBloom ? rgba(heat > 0.55 ? ALM : p.col, 0.95) : rgba(p.acc, 0.5 + fill * 0.3)
    ctx.lineWidth = isBloom ? 1.6 : 1
    ctx.beginPath()
    ctx.arc(0, 0, tankR, 0, Math.PI * 2)
    ctx.stroke()

    // Inner ring (suggesting depth)
    ctx.strokeStyle = isBloom ? rgba(p.dat, 0.55) : rgba(p.acc, 0.3)
    ctx.lineWidth = 0.7
    ctx.beginPath()
    ctx.arc(0, 0, tankR * 0.62, 0, Math.PI * 2)
    ctx.stroke()

    // Sodium-lamp aeroponic LED (pulse rate runs on tok/s)
    const lamp = anim ? 0.55 + 0.25 * Math.sin(t * (1.4 + tpsRate * 3.2) + i * 0.5) : 0.65
    ctx.fillStyle = rgba(p.dat, lamp)
    ctx.beginPath()
    ctx.arc(0, -tankR * 1.3, 2.2, 0, Math.PI * 2)
    ctx.fill()

    // Plant signature: three deterministic sub-shapes per tank index.
    if (!isBloom) drawPlantSignature(ctx, tankR, i, i % 3, p)

    // Bloom pulse: MTP accept sets the rate, the thinking count the depth.
    // A long agentic run (think > 0.5) grows a dense orbiting sporule ring:
    // the performing state, unmistakable next to the dormant settle.
    if (isBloom) {
      const pulse = anim ? 0.45 + (0.25 + think * 0.2) * Math.sin(t * (3.2 + mtp * 4.4)) : 0.55
      ctx.fillStyle = rgba(heat > 0.55 ? ALM : p.col, pulse * (0.16 + heat * 0.2 + think * 0.1))
      ctx.beginPath()
      ctx.arc(0, 0, tankR * 1.6, 0, Math.PI * 2)
      ctx.fill()
      if (performing) {
        const spor = 10 + Math.round(think * 6)
        for (let s = 0; s < spor; s++) {
          const sa = (anim ? t * (0.6 + mtp * 1.2) : 0.4) + (s / spor) * Math.PI * 2
          const srad = tankR * (2.0 + 0.25 * Math.sin((anim ? t * 2 : 0) + s * 1.7))
          ctx.fillStyle = rgba(p.dat, 0.35 + think * 0.4)
          ctx.beginPath()
          ctx.arc(Math.cos(sa) * srad, Math.sin(sa) * srad, 1.8, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    ctx.restore()

    // Tank ID label (just outside the disk)
    const lblX = cx + Math.cos(angRad) * (tankRingR + tankR + 8)
    const lblY = cy + Math.sin(angRad) * (tankRingR + tankR + 8)
    ctx.fillStyle = isBloom ? rgba(p.dat, 0.85) : rgba(p.col, 0.55)
    ctx.font = '8px "JetBrains Mono Variable", ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`Z${String(i + 1).padStart(2, '0')}`, lblX, lblY)
  }

  // ---------- Drone bay (bottom outer arc; 28 dots, flagged = dat) ----------
  ctx.strokeStyle = rgba(p.dat, 0.55)
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.arc(cx, cy, rmax * 0.92, Math.PI * 0.4, Math.PI * 0.6)
  ctx.stroke()
  for (let i = 0; i < 28; i++) {
    const a = Math.PI * 0.4 + (i / 27) * Math.PI * 0.2
    const s = sessions.length ? sessions[i % sessions.length] : null
    const flagged = s && s.window ? (s.used || 0) / s.window >= 0.85 : false
    ctx.fillStyle = flagged ? rgba(p.dat, 0.95) : rgba(p.acc, 0.6)
    ctx.beginPath()
    ctx.arc(cx + Math.cos(a) * rmax * 0.92, cy + Math.sin(a) * rmax * 0.92, flagged ? 1.8 : 1.2, 0, Math.PI * 2)
    ctx.fill()
  }

  // ---------- Mirror array (top; dashed line + light shafts) ----------
  const mirrorY = cy - rmax * 1.18
  ctx.strokeStyle = rgba(p.dat, 0.45)
  ctx.lineWidth = 1
  ctx.setLineDash([8, 4])
  ctx.beginPath()
  ctx.moveTo(cx - rmax * 0.62, mirrorY)
  ctx.lineTo(cx + rmax * 0.62, mirrorY)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.strokeStyle = rgba(p.dat, 0.14 + heat * 0.1)
  ctx.lineWidth = 0.6
  for (let i = 0; i < 7; i++) {
    const fx = cx - rmax * 0.55 + (i / 6) * rmax * 1.1
    ctx.beginPath()
    ctx.moveTo(fx, mirrorY + 4)
    ctx.lineTo(cx + (fx - cx) * 0.3, cy - rmax * 0.55)
    ctx.stroke()
  }

  // ---------- Center crosshair ----------
  ctx.strokeStyle = rgba(p.acc, 0.4)
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(cx - 8, cy)
  ctx.lineTo(cx + 8, cy)
  ctx.moveTo(cx, cy - 8)
  ctx.lineTo(cx, cy + 8)
  ctx.stroke()

  // Alert wash: the whole schematic runs warm-red under a hard anomaly.
  if (alert > 0.45) {
    const wash = ctx.createRadialGradient(cx, cy, rmax * 0.2, cx, cy, rmax * 1.15)
    wash.addColorStop(0, rgba(ALM, 0))
    wash.addColorStop(1, rgba(ALM, (alert - 0.45) * 0.25))
    ctx.fillStyle = wash
    ctx.fillRect(0, 0, w, h)
  }
}

// Stylized plant top-down views (leaf rosette / fruit cluster / vine branch),
// deterministic by tank index — the ring reads as different species, not
// twelve identical pips. Leaves take the cool role (living tissue on every
// scheme); the central stem takes the accent.
function drawPlantSignature(ctx, tankR, idx, subShape, p) {
  const stroke = rgba(p.col, 0.62)
  const fill = rgba(p.col, 0.5)
  if (subShape === 0) {
    // LEAF rosette: five small ellipses radiating from the stem.
    ctx.fillStyle = fill
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + idx * 0.3
      const r = tankR * 0.4
      ctx.beginPath()
      ctx.ellipse(Math.cos(a) * r, Math.sin(a) * r, tankR * 0.12, tankR * 0.06, a, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (subShape === 1) {
    // FRUIT cluster: three filled circles in a triangle.
    ctx.fillStyle = fill
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2 + idx * 0.25
      const r = tankR * 0.3
      ctx.beginPath()
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r, tankR * 0.16, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    // VINE branch: two thin lines forking from the stem, leaf tips at the ends.
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1.1
    ctx.lineCap = 'round'
    for (let i = 0; i < 2; i++) {
      const a = (i ? 1 : -1) * (0.7 + (idx % 2) * 0.15) + idx * 0.2
      const midX = Math.cos(a) * tankR * 0.32
      const midY = Math.sin(a) * tankR * 0.32
      const endX = Math.cos(a + 0.35) * tankR * 0.55
      const endY = Math.sin(a + 0.35) * tankR * 0.55
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.quadraticCurveTo(midX, midY, endX, endY)
      ctx.stroke()
      ctx.fillStyle = fill
      ctx.beginPath()
      ctx.arc(endX, endY, tankR * 0.08, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.fillStyle = rgba(p.acc, 0.75)
  ctx.beginPath()
  ctx.arc(0, 0, tankR * 0.1, 0, Math.PI * 2)
  ctx.fill()
}

// ---------------------------------------------------------------------------
// paintMicro — the 400× filament inset: a seeded procedural filament field
// under a crosshair scan that drifts with the `reason` scalar (Strata
// thinking stream). Settled frame: the crosshair rests mid-frame.
// ---------------------------------------------------------------------------

const FILAMENTS = (() => {
  const rng = lcg(42)
  const out = []
  for (let i = 0; i < 9; i++) {
    const segments = []
    let x = rng() * 2 - 1
    let y = rng() * 2 - 1
    let ang = rng() * Math.PI * 2
    for (let s = 0; s < 24; s++) {
      ang += (rng() - 0.5) * 0.4
      const step = 0.06 + rng() * 0.04
      x += Math.cos(ang) * step
      y += Math.sin(ang) * step
      segments.push([x, y])
      if (Math.abs(x) > 1.4 || Math.abs(y) > 1.4) break
    }
    out.push({ segments, alpha: 0.35 + rng() * 0.4 })
  }
  return out
})()

export function paintMicro(ctx, w, h, c) {
  const p = c.palette
  const t = c.t
  const stale = staleOf(c.snap)
  const reason = stale ? 0 : Math.min(1, c.reason)
  const anim = !c.reduced && !stale

  // Filaments drift apart/skim with the thinking stream.
  const drift = anim ? Math.sin(t * 0.2) * (0.015 + reason * 0.075) : 0.03

  // Filament field.
  ctx.save()
  ctx.translate(w / 2, h / 2)
  const scale = Math.min(w, h) * 0.4
  for (const f of FILAMENTS) {
    ctx.strokeStyle = rgba(p.acc, (f.alpha * (0.5 + reason * 0.6)).toFixed(3))
    ctx.lineWidth = 1
    ctx.lineCap = 'round'
    ctx.beginPath()
    const seg = f.segments
    for (let i = 0; i < seg.length; i++) {
      const x = (seg[i][0] + drift) * scale
      const y = (seg[i][1] + drift * 0.5) * scale
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.restore()

  // Cellular debris drifting down the frame (deterministic in t).
  if (anim) {
    for (let i = 0; i < 8; i++) {
      const phase = (t * 0.15 + i / 8) % 1
      const px = (Math.sin(i * 17.3 + t * 0.1) * 0.5 + 0.5) * w
      const py = phase * h
      ctx.fillStyle = rgba(p.col, Math.max(0, 0.4 - phase * 0.3))
      ctx.beginPath()
      ctx.arc(px, py, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Crosshair scan: a soft band crossing the field on the master clock,
  // offset 0.5 so the settled frame sits mid-scan, not at the edge.
  const scan = anim ? (t * (0.12 + reason * 0.3) + 0.5) % 1 : 0.5
  const sy = scan * h
  ctx.strokeStyle = rgba(p.col, 0.5)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, sy)
  ctx.lineTo(w, sy)
  ctx.stroke()
  ctx.fillStyle = rgba(p.col, 0.25)
  ctx.fillRect(0, sy - 1, w, 2)
}

// ---------------------------------------------------------------------------
// paintAlgae — the satellite inset: star field, distant Earth dot, and the
// bloom wisp whose spread follows `flow` (cache/reingest growth). A slow
// scanline sweeps on the master clock; settled frame rests mid-scan.
// ---------------------------------------------------------------------------

export function paintAlgae(ctx, w, h, c) {
  const p = c.palette
  const t = c.t
  const stale = staleOf(c.snap)
  const flow = stale ? 0 : Math.min(1, c.flow)
  const anim = !c.reduced && !stale

  // Stars (hash-derived, stable).
  for (let i = 0; i < 22; i++) {
    const sx = (Math.sin(i * 13.3) * 0.5 + 0.5) * w
    const sy = (Math.cos(i * 19.7) * 0.5 + 0.5) * h
    const tw = anim ? 0.5 + 0.5 * Math.sin(t * 1.3 + i) : 0.8
    ctx.fillStyle = rgba(p.col, 0.25 + tw * 0.4)
    ctx.fillRect(sx, sy, 1, 1)
  }

  // Distant Earth as a tiny pale dot with a dawn terminator.
  ctx.fillStyle = rgba(p.col, 0.85)
  ctx.beginPath()
  ctx.arc(w * 0.78, h * 0.62, 1.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = rgba(p.acc, 0.25)
  ctx.beginPath()
  ctx.arc(w * 0.78 + 0.6, h * 0.62, 1.5, -Math.PI / 2, Math.PI / 2, true)
  ctx.fill()

  // The bloom wisp: size and spread follow `flow`.
  ctx.save()
  ctx.translate(w / 2, h / 2)
  if (anim) ctx.rotate(Math.sin(t * 0.05) * 0.1)
  const spread = 0.3 + flow * 0.25
  const wisp = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.5)
  wisp.addColorStop(0, rgba(p.acc, 0.12 + flow * 0.25))
  wisp.addColorStop(0.5, rgba(p.acc, 0.05 + flow * 0.08))
  wisp.addColorStop(1, rgba(p.acc, 0))
  ctx.fillStyle = wisp
  ctx.beginPath()
  ctx.ellipse(0, 0, w * 0.42, Math.max(6, h * spread), 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Crosshair brackets.
  ctx.strokeStyle = rgba(p.acc, 0.45)
  ctx.lineWidth = 1
  const cR = 8
  const cx = w / 2
  const cy = h / 2
  ctx.beginPath()
  ctx.moveTo(cx - cR, cy - cR + 4); ctx.lineTo(cx - cR, cy - cR); ctx.lineTo(cx - cR + 4, cy - cR)
  ctx.moveTo(cx + cR, cy - cR + 4); ctx.lineTo(cx + cR, cy - cR); ctx.lineTo(cx + cR - 4, cy - cR)
  ctx.moveTo(cx - cR, cy + cR - 4); ctx.lineTo(cx - cR, cy + cR); ctx.lineTo(cx - cR + 4, cy + cR)
  ctx.moveTo(cx + cR, cy + cR - 4); ctx.lineTo(cx + cR, cy + cR); ctx.lineTo(cx + cR - 4, cy + cR)
  ctx.stroke()

  // Scan sweep (offset 0.4 so the settled frame is not on the edge).
  const scan = anim ? (t * 0.4 + 0.4) % 1 : 0.5
  const sy = scan * h
  ctx.strokeStyle = rgba(p.acc, 0.3)
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(0, sy)
  ctx.lineTo(w, sy)
  ctx.stroke()
}

// Context Orbit canvas painters. Registered through SceneCanvas; every one is
// a pure function of the conductor (master clock, latest snapshot, active
// palette). No timers, no wall clock, no per-painter accumulators: derive
// every phase from c.t so a held feed freezes cleanly and reduced motion
// settles on one valid frame of the latest data.
//
// Colours come from c.palette ("R G B" channels); the only hard-coded colour
// is the absolute alarm red (ALM), per the conductor contract.
//
// Geometry: the hero draws in one fixed composition space (VB, 1244 x 834)
// scaled per-axis onto the canvas, the same space the leader-line SVG uses,
// so pods, gauge nodes and callout dots land on the same points at any
// stage size. The pod ring, gauge ring and core read the KV pool.

import { ALM } from '../../scene/conductor'
import { staleOf, podsOf, podOfSession, POD_COUNT, CALLOUTS } from './shared'

const chan = (s) => String(s || '0 0 0').trim().split(/\s+/).map(Number)
const rgba = (s, a) => `rgba(${chan(s).join(',')},${a})`

// Composition space and radii, in VB units.
const VBW = 1244
const VBH = 834
const RMAX = 383.6 // 0.46 * VBH, the outer system radius
const R_SHELL = RMAX * 0.98
const R_GAUGE = RMAX * 0.78
const R_EVICT = RMAX * 0.92
const R_POD = RMAX * 0.62
const R_INNER = RMAX * 0.5
const R_CORE = RMAX * 0.22

// Anchor positions in VB units, from the shared callout table.
const VBX = 1244
const VBY = 834
const anchors = CALLOUTS.map((c) => ({ x: (c.a.x / 100) * VBX, y: (c.a.y / 100) * VBY, bind: c.bind }))

// Deterministic hash noise in [0,1): stable per argument, no RNG state.
function det(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// Point on a per-axis-scaled ellipse ring.
function ringPoint(cx, cy, r, angRad, sx, sy) {
  return [cx + Math.cos(angRad) * r * sx, cy + Math.sin(angRad) * r * sy]
}

// Draw a ring as an ellipse (per-axis scale keeps the ring under the pods).
function ring(ctx, cx, cy, r, sx, sy, stroke, width, dash) {
  ctx.strokeStyle = stroke
  ctx.lineWidth = width
  if (dash) ctx.setLineDash(dash)
  ctx.beginPath()
  ctx.ellipse(cx, cy, r * sx, r * sy, 0, 0, Math.PI * 2)
  ctx.stroke()
  if (dash) ctx.setLineDash([])
}

// ---------------------------------------------------------------------------
// paintOrbit — the hero: the model core (a VRAM ring gauge with the big GB
// figure as a DOM plate) inside the KV slot system. Twelve pods orbit at
// fixed angles, sized and lit by their KV fill; eviction risk flares red;
// kv_slot_changed pulses the pod; cables carry the context traffic between
// pods and core; a radar sweep runs at flow rate. Alert washes the stage.
// ---------------------------------------------------------------------------

export function paintOrbit(ctx, w, h, c) {
  const p = c.palette
  const t = c.t
  // Dormant loop: a stale feed (offline/boot/zero-tps) parks the scalars at
  // zero so glow, dots and drift settle — the orbit reads HELD in its own
  // voice (stage dim + swept callouts in Scene.jsx carry the DOM half).
  const stale = staleOf(c.snap)
  const flow = stale ? 0 : Math.min(1, c.flow)
  const heat = stale ? 0 : Math.min(1, c.reduced ? 0.5 : c.heat)
  const alert = stale ? 0 : Math.min(1, c.alert)
  const anim = !c.reduced && !stale
  // Core reactivity: MTP accept sets the pulse rate, the thinking-token
  // count sets the glow depth, tok/s runs the sweep and the packet stream.
  const rs = (c.snap && c.snap.reasoning) || {}
  const q = (v) => Math.round(Math.min(1, Math.max(0, v)) * 20) / 20
  const mtp = stale ? 0 : rs.mtp_accept_pct != null ? q(rs.mtp_accept_pct / 100) : q(c.reason)
  const think = stale ? 0 : rs.thinking_tokens != null ? q(rs.thinking_tokens / 400) : q(c.reason)
  const tpsRate = stale ? 0 : q(((c.snap && c.snap.kpi && c.snap.kpi.tps) || 0) / 280)

  const sx = w / VBW
  const sy = h / VBH
  const ss = Math.min(sx, sy)
  const cx = w / 2
  const cy = h / 2

  // Recent pressure flare: a vram_pressure or err anomaly inside 1.4 s.
  let flare = 0
  if (anim) {
    for (let i = c.events.length - 1; i >= 0; i--) {
      const ev = c.events[i]
      if (ev.type !== 'vram_pressure' && ev.type !== 'anomaly') continue
      const age = c.t - ev.t
      if (age < 1.4) flare = Math.max(flare, (1 - age / 1.4) * (ev.type === 'anomaly' && ev.level === 'err' ? 1 : 0.7))
      break
    }
  }

  // Per-pod data.
  const pods = podsOf(c.snap)
  const sessions = (c.snap && c.snap.sessions) || []
  const podFill = []
  let hotPod = -1
  let hotFill = -1
  for (let i = 0; i < POD_COUNT; i++) {
    podFill.push(pods[i].fill)
    if (pods[i].fill > hotFill) {
      hotFill = pods[i].fill
      hotPod = i
    }
  }
  // kv_slot_changed pulses: recent events, mapped to the pod bound to that
  // session row (cap 40, the conductor's own bound).
  const flashes = new Map()
  for (const f of c.kvFlashes) {
    const pod = sessions.length ? podOfSession(sessions, f.index) : f.index % POD_COUNT
    const prev = flashes.get(pod)
    if (!prev || f.t0 > prev) flashes.set(pod, f.t0)
  }
  const flagged = pods.filter((pod) => pod.fill >= 0.85).length

  // ---------- Background wash (subtle radial, token-driven) ----------
  const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, RMAX * 1.25 * ss)
  bgGrad.addColorStop(0, rgba(p.acc, 0.09 + heat * 0.06))
  bgGrad.addColorStop(0.55, rgba(p.acc, 0.02))
  bgGrad.addColorStop(1, rgba(p.acc, 0))
  ctx.fillStyle = bgGrad
  ctx.beginPath()
  ctx.arc(cx, cy, RMAX * 1.25 * ss, 0, Math.PI * 2)
  ctx.fill()

  // ---------- Pressure glows: warm radial pools that grow with `heat` ----
  for (let k = 0; k < 3; k++) {
    const a = det(k * 7.31) * Math.PI * 2
    const rr = RMAX * (0.3 + det(k * 3.17) * 0.4) * ss
    const hx = cx + Math.cos(a) * rr
    const hy = cy + Math.sin(a) * rr
    const breathe = anim ? 0.9 + 0.1 * Math.sin(t * (0.9 + mtp * 1.8) + k * 2.1) : 1
    const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, RMAX * (0.10 + heat * 0.16 + think * 0.06) * ss * breathe)
    glow.addColorStop(0, rgba(p.dat, 0.10 + heat * 0.22 + think * 0.08))
    glow.addColorStop(1, rgba(p.dat, 0))
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(hx, hy, RMAX * (0.1 + heat * 0.18 + think * 0.07) * ss * breathe, 0, Math.PI * 2)
    ctx.fill()
  }

  // ---------- Outer system shell ----------
  ring(ctx, cx, cy, R_SHELL, sx, sy, rgba(p.col, 0.42), 1.4)
  ring(ctx, cx, cy, RMAX * 1.04, sx, sy, rgba(p.acc, 0.18), 0.8)

  // ---------- Outer gauge ring: tick marks + telemetry nodes ----------
  ring(ctx, cx, cy, R_GAUGE, sx, sy, rgba(p.acc, 0.28), 0.9)
  const ticks = 48
  for (let i = 0; i < ticks; i++) {
    const a = (i / ticks) * Math.PI * 2
    const [x1, y1] = ringPoint(cx, cy, R_GAUGE, a, sx, sy)
    const [x2, y2] = ringPoint(cx, cy, R_GAUGE + 7, a, sx, sy)
    ctx.strokeStyle = rgba(p.acc, i % 4 === 0 ? 0.4 : 0.18)
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  // Telemetry nodes on the gauge ring (the outer callout anchors).
  for (const an of anchors) {
    if (an.bind.startsWith('slot:')) continue
    const r = Math.hypot(an.x - 622, an.y - 417)
    if (Math.abs(r - R_GAUGE) > 12) continue
    const nodeFlash = flare * 0.5
    ctx.fillStyle = rgba(p.dat, 0.5 + nodeFlash)
    ctx.fillRect(X(an.x, sx) - 2.5, Y(an.y, sy) - 2.5, 5, 5)
    ctx.strokeStyle = rgba(p.col, 0.6)
    ctx.lineWidth = 0.8
    ctx.strokeRect(X(an.x, sx) - 4.5, Y(an.y, sy) - 4.5, 9, 9)
  }

  // ---------- Eviction watch arc (bottom outer arc) ----------
  const evictHot = flagged > 0 || heat > 0.7
  ctx.strokeStyle = rgba(evictHot ? ALM : p.dat, evictHot ? 0.75 : 0.5)
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.ellipse(cx, cy, R_EVICT * sx, R_EVICT * sy, 0, Math.PI * 0.4, Math.PI * 0.6)
  ctx.stroke()
  const watchDots = Math.min(28, sessions.length || 0)
  for (let i = 0; i < 28; i++) {
    const a = Math.PI * 0.4 + (i / 27) * Math.PI * 0.2
    const [x, y] = ringPoint(cx, cy, R_EVICT, a, sx, sy)
    const live = i < watchDots
    const risk = live && (sessions[i].used || 0) / (sessions[i].window || 1) >= 0.85
    const flick = anim && risk ? 0.6 + 0.4 * Math.sin(t * 5 + i) : 1
    ctx.fillStyle = risk ? rgba(ALM, 0.95 * flick) : live ? rgba(p.acc, 0.6) : rgba(p.acc, 0.18)
    ctx.beginPath()
    ctx.arc(x, y, risk ? 1.9 : live ? 1.3 : 1, 0, Math.PI * 2)
    ctx.fill()
  }

  // ---------- Inner telemetry ring (dashed; rotates with flow) ----------
  ctx.strokeStyle = rgba(p.col, 0.3)
  ctx.lineWidth = 0.8
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  ctx.ellipse(cx, cy, R_INNER * sx, R_INNER * sy, 0, anim ? t * 0.05 * (0.2 + flow) : 0, anim ? t * 0.05 * (0.2 + flow) + Math.PI * 2 : Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  // Inner nodes (the five telemetry anchors on the inner ring).
  for (const an of anchors) {
    const r = Math.hypot(an.x - 622, an.y - 417)
    if (an.bind.startsWith('slot:') || Math.abs(r - R_INNER) > 12) continue
    ctx.fillStyle = rgba(p.col, 0.65)
    ctx.beginPath()
    ctx.arc(X(an.x, sx), Y(an.y, sy), 2.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = rgba(p.acc, 0.35)
    ctx.lineWidth = 0.7
    ctx.beginPath()
    ctx.arc(X(an.x, sx), Y(an.y, sy), 4.5, 0, Math.PI * 2)
    ctx.stroke()
  }

  // ---------- Context cables: pods to core, seeded bezier looms ----------
  const cables = []
  for (let i = 0; i < POD_COUNT; i++) {
    const a = (-90 + (i / POD_COUNT) * 360) * (Math.PI / 180)
    const [x1, y1] = ringPoint(cx, cy, R_POD, a, sx, sy)
    const sag = (det(i * 9.13) - 0.5) * RMAX * 0.3
    cables.push({
      x1, y1,
      x2: cx, y2: cy,
      cx1: (x1 + cx) / 2 + Math.cos(a + Math.PI / 2) * sag * ss,
      cy1: (y1 + cy) / 2 + Math.sin(a + Math.PI / 2) * sag * ss,
      ph: det(i * 4.71),
    })
  }
  // Cross looms between opposite pods (the pool's shared-prefix reads).
  for (let i = 0; i < 4; i++) {
    const a1 = (-90 + (i / POD_COUNT) * 360) * (Math.PI / 180)
    const a2 = a1 + Math.PI
    const [x1, y1] = ringPoint(cx, cy, R_POD, a1, sx, sy)
    const [x2, y2] = ringPoint(cx, cy, R_POD, a2, sx, sy)
    const mid = det(i * 17.7) * Math.PI * 2
    cables.push({
      x1, y1, x2, y2,
      cx1: (x1 + x2) / 2 + Math.cos(mid) * RMAX * 0.2 * ss,
      cy1: (y1 + y2) / 2 + Math.sin(mid) * RMAX * 0.2 * ss,
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
  // Packet dots ride the cables; count and speed follow flow, MTP and the
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

  // ---------- Spokes (structural, pods to core) ----------
  ctx.strokeStyle = rgba(p.acc, 0.16)
  ctx.lineWidth = 0.7
  for (let s = 0; s < POD_COUNT; s++) {
    const a = (s / POD_COUNT) * Math.PI * 2 - Math.PI / 2
    const [x1, y1] = ringPoint(cx, cy, R_CORE + 8, a, sx, sy)
    const [x2, y2] = ringPoint(cx, cy, R_SHELL - 6, a, sx, sy)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  // ---------- 12 KV pods (the orbit) ----------
  for (let i = 0; i < POD_COUNT; i++) {
    const angDeg = -90 + (i / POD_COUNT) * 360
    const angRad = angDeg * (Math.PI / 180)
    const [px, py] = ringPoint(cx, cy, R_POD, angRad, sx, sy)
    const fill = Math.min(1, podFill[i] + (anim ? Math.sin(t * 0.5 + i * 0.5) * 0.014 : 0))
    const podR = RMAX * (0.075 + fill * 0.02) * ss
    const isRisk = fill >= 0.85
    const isHot = i === hotPod && hotFill >= 0.55 && !isRisk

    // kv_slot_changed pulse on this pod.
    const fl = flashes.get(i)
    const pulseAge = fl != null && anim ? c.t - fl : null
    const pulse = pulseAge != null && pulseAge < 1.6 ? 1 - pulseAge / 1.6 : 0

    ctx.save()
    ctx.translate(px, py)

    // Pod disk: radial fill whose depth follows the KV fill + heat.
    const inner = ctx.createRadialGradient(0, 0, 0, 0, 0, podR)
    if (isRisk) {
      inner.addColorStop(0, rgba(ALM, 0.5 + flare * 0.2))
      inner.addColorStop(0.5, rgba(p.dat, 0.3))
      inner.addColorStop(1, rgba(p.acc, 0.08))
    } else if (isHot) {
      inner.addColorStop(0, rgba(p.dat, 0.42))
      inner.addColorStop(0.5, rgba(p.dat, 0.24))
      inner.addColorStop(1, rgba(p.acc, 0.08))
    } else {
      inner.addColorStop(0, rgba(p.acc, 0.12 + fill * 0.3))
      inner.addColorStop(0.5, rgba(p.acc, 0.08))
      inner.addColorStop(1, rgba(p.acc, 0.03))
    }
    ctx.fillStyle = inner
    ctx.beginPath()
    ctx.arc(0, 0, podR, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = isRisk ? rgba(ALM, 0.95) : isHot ? rgba(p.dat, 0.9) : rgba(p.acc, 0.5 + fill * 0.3)
    ctx.lineWidth = isRisk ? 1.6 : 1
    ctx.beginPath()
    ctx.arc(0, 0, podR, 0, Math.PI * 2)
    ctx.stroke()

    // Fill arc inside the pod: the KV level, drawn as a thick inner arc.
    ctx.strokeStyle = isRisk ? rgba(ALM, 0.8) : rgba(p.dat, 0.75)
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(0, 0, podR * 0.6, -Math.PI / 2, -Math.PI / 2 + fill * Math.PI * 2)
    ctx.stroke()
    ctx.lineCap = 'butt'

    // Event pulse ring: one expanding ring per kv_slot_changed.
    if (pulse > 0) {
      ctx.strokeStyle = rgba(p.col, pulse * 0.8)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(0, 0, podR * (1 + pulse * 0.9), 0, Math.PI * 2)
      ctx.stroke()
    }

    // Eviction halo: a long agentic run near the alert line pulses red.
    if (isRisk) {
      const halo = anim ? 0.45 + (0.25 + heat * 0.2) * Math.sin(t * (3.2 + mtp * 4.4)) : 0.55
      ctx.fillStyle = rgba(ALM, halo * (0.14 + heat * 0.2 + flare * 0.2))
      ctx.beginPath()
      ctx.arc(0, 0, podR * 1.6, 0, Math.PI * 2)
      ctx.fill()
      if (anim) {
        const orbs = 10 + Math.round(heat * 6)
        for (let s = 0; s < orbs; s++) {
          const sa = t * (0.6 + mtp * 1.2) + (s / orbs) * Math.PI * 2
          const srad = podR * (2.0 + 0.25 * Math.sin(t * 2 + s * 1.7))
          ctx.fillStyle = rgba(ALM, 0.3 + heat * 0.4)
          ctx.beginPath()
          ctx.arc(Math.cos(sa) * srad, Math.sin(sa) * srad, 1.8, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    // Eviction-rate LED above the pod (pulse rate runs on tok/s).
    const lamp = anim ? 0.55 + 0.25 * Math.sin(t * (1.4 + tpsRate * 3.2) + i * 0.5) : 0.65
    ctx.fillStyle = rgba(isRisk ? ALM : p.dat, lamp)
    ctx.beginPath()
    ctx.arc(0, -podR * 1.3, 2.2, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()

    // Lock-on brackets on the hottest pod at or past the warn line.
    if (i === hotPod && fill >= 0.6) {
      const b = podR * 1.35
      const bl = anim ? 0.55 + 0.35 * Math.sin(t * 2.4) : 0.8
      ctx.strokeStyle = rgba(isRisk ? ALM : p.col, bl)
      ctx.lineWidth = 1.2
      const L = 5
      ctx.beginPath()
      ctx.moveTo(px - b, py - b + L); ctx.lineTo(px - b, py - b); ctx.lineTo(px - b + L, py - b)
      ctx.moveTo(px + b, py - b + L); ctx.lineTo(px + b, py - b); ctx.lineTo(px + b - L, py - b)
      ctx.moveTo(px - b, py + b - L); ctx.lineTo(px - b, py + b); ctx.lineTo(px - b + L, py + b)
      ctx.moveTo(px + b, py + b - L); ctx.lineTo(px + b, py + b); ctx.lineTo(px + b - L, py + b)
      ctx.stroke()
    }

    // Pod label (slot id + KV %), just outside the disk.
    const pod = pods[i]
    const lblR = R_POD + (RMAX * 0.075) * ss + podR + 10
    const [lx, ly] = ringPoint(cx, cy, lblR, angRad, sx, sy)
    ctx.fillStyle = isRisk ? rgba(ALM, 0.9) : isHot ? rgba(p.dat, 0.85) : rgba(p.col, 0.55)
    ctx.font = '8px "JetBrains Mono Variable", ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${pod.id} ${pod.win ? `${Math.round(fill * 100)}%` : ''}`, lx, ly)
  }

  // ---------- Radar sweep (runs at flow rate; frozen when held) ----------
  if (anim) {
    const sweepA = t * (0.25 + flow * 0.7)
    const grad = ctx.createConicGradient(sweepA, cx, cy)
    grad.addColorStop(0, rgba(p.acc, 0.14))
    grad.addColorStop(0.08, rgba(p.acc, 0.03))
    grad.addColorStop(0.16, rgba(p.acc, 0))
    grad.addColorStop(1, rgba(p.acc, 0))
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.ellipse(cx, cy, R_SHELL * sx, R_SHELL * sy, 0, 0, Math.PI * 2)
    ctx.fill()
    // sweep leading edge
    const [ex, ey] = ringPoint(cx, cy, R_SHELL, sweepA, sx, sy)
    ctx.strokeStyle = rgba(p.col, 0.35 + flow * 0.3)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(ex, ey)
    ctx.stroke()
  }

  // ---------- Center: the model core (VRAM ring gauge) ----------
  const gpu = (c.snap && c.snap.gpu) || null
  const vramPct = gpu && gpu.vramTotal ? Math.min(1, Math.max(0, (gpu.vram || 0) / gpu.vramTotal)) : 0
  // Track ring
  ring(ctx, cx, cy, R_CORE, sx, sy, rgba(p.acc, 0.25), 3)
  ring(ctx, cx, cy, R_CORE - 7, sx, sy, rgba(p.acc, 0.14), 0.7)
  // Gauge arc: VRAM used, from the top, clockwise.
  const arcR = R_CORE
  ctx.strokeStyle = vramPct >= 0.9 ? rgba(ALM, 0.95) : vramPct >= 0.75 ? rgba(p.dat, 0.95) : rgba(p.col, 0.9)
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.shadowColor = vramPct >= 0.9 ? rgba(ALM, 0.8) : rgba(p.col, 0.7)
  ctx.shadowBlur = 9 + heat * 10
  ctx.beginPath()
  ctx.ellipse(cx, cy, arcR * sx, arcR * sy, 0, -Math.PI / 2, -Math.PI / 2 + vramPct * Math.PI * 2)
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.lineCap = 'butt'
  // Core ticks
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    const [x1, y1] = ringPoint(cx, cy, R_CORE + 4, a, sx, sy)
    const [x2, y2] = ringPoint(cx, cy, R_CORE + 8, a, sx, sy)
    ctx.strokeStyle = rgba(p.acc, i % 6 === 0 ? 0.5 : 0.2)
    ctx.lineWidth = 0.7
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  // Center crosshair (lock-on)
  ctx.strokeStyle = rgba(p.acc, 0.4)
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(cx - 8, cy)
  ctx.lineTo(cx + 8, cy)
  ctx.moveTo(cx, cy - 8)
  ctx.lineTo(cx, cy + 8)
  ctx.stroke()
  // Core pulse: a soft glow that breathes with the decode rate.
  const coreBreath = anim ? 0.85 + 0.15 * Math.sin(t * (1.1 + tpsRate * 2.4)) : 1
  const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R_CORE * 0.85 * coreBreath)
  coreGlow.addColorStop(0, rgba(vramPct >= 0.9 ? ALM : p.col, 0.16 + heat * 0.14 + flare * 0.2))
  coreGlow.addColorStop(1, rgba(p.acc, 0))
  ctx.fillStyle = coreGlow
  ctx.beginPath()
  ctx.arc(cx, cy, R_CORE * 0.9, 0, Math.PI * 2)
  ctx.fill()

  // ---------- Alert wash + glitch slices ----------
  if (alert > 0.45) {
    const wash = ctx.createRadialGradient(cx, cy, R_CORE, cx, cy, RMAX * 1.15 * ss)
    wash.addColorStop(0, rgba(ALM, 0))
    wash.addColorStop(1, rgba(ALM, (alert - 0.45) * 0.25))
    ctx.fillStyle = wash
    ctx.fillRect(0, 0, w, h)
  }
  if (flare > 0.02 && anim) {
    // Signal tear: a few horizontal slices of the just-painted frame shear
    // sideways while the pressure flare is fresh. Source coords are device
    // pixels (the backing store), so the scale factor comes from the canvas.
    const ky = ctx.canvas.height / h
    const kx = ctx.canvas.width / w
    for (let i = 0; i < 3; i++) {
      const seed = Math.floor(c.t * 9)
      const sy0 = (det(i * 3.7 + seed) * 0.9) * h
      const sh = 5 + det(i * 9.1 + seed) * 16
      const dx = (det(i * 5.3 + seed) - 0.5) * 30 * flare
      ctx.drawImage(ctx.canvas, 0, sy0 * ky, ctx.canvas.width, sh * ky, dx, sy0, w, sh)
    }
  }
}

// VB-space scalers used by the node helpers above.
function X(vx, sx) {
  return vx * sx
}
function Y(vy, sy) {
  return vy * sy
}

// ---------------------------------------------------------------------------
// paintDecodeScope — the bottom-left inset: the decode-rate trace
// (kpiHist.tps), range-fitted, with a filled area under the line and a bright
// head dot. A scan band crosses the trace on the master clock.
// ---------------------------------------------------------------------------

export function paintDecodeScope(ctx, w, h, c) {
  const p = c.palette
  const t = c.t
  const stale = staleOf(c.snap)
  const anim = !c.reduced && !stale
  const hist = ((c.snap && c.snap.kpiHist && c.snap.kpiHist.tps) || []).filter((v) => v != null)
  const reason = stale ? 0 : Math.min(1, c.reason)
  if (hist.length < 2) {
    // No source yet: draw the floor, never a fabricated trace.
    ctx.strokeStyle = rgba(p.acc, 0.2)
    ctx.lineWidth = 0.6
    for (let i = 1; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(0, (h * i) / 4)
      ctx.lineTo(w, (h * i) / 4)
      ctx.stroke()
    }
    return
  }
  const view = hist.slice(-120)
  let lo = Math.min(...view)
  let hi = Math.max(...view)
  if (hi - lo < 8) { lo = Math.max(0, lo - 4); hi = hi + 4 } // a flat trace still fills the box
  const py = (v) => h - 6 - ((v - lo) / (hi - lo)) * (h - 12)
  const px = (i) => (i / (view.length - 1)) * (w - 8) + 4

  // Filled area under the trace.
  ctx.beginPath()
  ctx.moveTo(px(0), h)
  for (let i = 0; i < view.length; i++) ctx.lineTo(px(i), py(view[i]))
  ctx.lineTo(px(view.length - 1), h)
  ctx.closePath()
  const area = ctx.createLinearGradient(0, 0, 0, h)
  area.addColorStop(0, rgba(p.acc, 0.3))
  area.addColorStop(1, rgba(p.acc, 0.02))
  ctx.fillStyle = area
  ctx.fill()

  // The trace line with a glow head.
  ctx.strokeStyle = rgba(p.col, 0.75 + reason * 0.2)
  ctx.lineWidth = 1.1
  ctx.beginPath()
  for (let i = 0; i < view.length; i++) {
    if (i === 0) ctx.moveTo(px(i), py(view[i]))
    else ctx.lineTo(px(i), py(view[i]))
  }
  ctx.stroke()
  const hx = px(view.length - 1)
  const hy = py(view[view.length - 1])
  ctx.fillStyle = rgba(p.dat, 0.95)
  ctx.shadowColor = rgba(p.dat, 0.8)
  ctx.shadowBlur = 6
  ctx.beginPath()
  ctx.arc(hx, hy, 1.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  // Scan band crossing the trace on the master clock (settled mid-frame).
  const scan = anim ? (t * (0.12 + reason * 0.3) + 0.5) % 1 : 0.5
  const sy = scan * h
  ctx.strokeStyle = rgba(p.col, 0.4)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, sy)
  ctx.lineTo(w, sy)
  ctx.stroke()
}

// ---------------------------------------------------------------------------
// paintVramHist — the left-rail mini plot: the VRAM pressure history
// (kpiHist.vram against the pool), range-fitted to 0..pool so the 0.9 evict
// line and the trace share one scale, with a filled area and the current
// value printed by the DOM above it.
// ---------------------------------------------------------------------------

export function paintVramHist(ctx, w, h, c) {
  const p = c.palette
  const gpu = (c.snap && c.snap.gpu) || null
  const pool = (gpu && gpu.vramTotal) || 24
  const hist = ((c.snap && c.snap.kpiHist && c.snap.kpiHist.vram) || []).filter((v) => v != null)
  const stale = staleOf(c.snap)
  const heat = stale ? 0 : Math.min(1, c.heat)
  const lo = 0
  const hi = pool
  const py = (v) => h - 3 - ((Math.min(pool, Math.max(0, v)) - lo) / (hi - lo)) * (h - 6)
  const px = (i, n) => (i / Math.max(1, n - 1)) * (w - 6) + 3

  // 0.9 and 0.75 pressure lines.
  for (const [v, col, a] of [[pool * 0.9, ALM, 0.4], [pool * 0.75, p.dat, 0.35]]) {
    ctx.strokeStyle = rgba(col, a)
    ctx.lineWidth = 0.7
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(0, py(v))
    ctx.lineTo(w, py(v))
    ctx.stroke()
    ctx.setLineDash([])
  }

  if (hist.length < 2) {
    ctx.strokeStyle = rgba(p.acc, 0.2)
    ctx.lineWidth = 0.6
    ctx.beginPath()
    ctx.moveTo(0, h / 2)
    ctx.lineTo(w, h / 2)
    ctx.stroke()
    return
  }
  const view = hist.slice(-90)
  ctx.beginPath()
  ctx.moveTo(px(0, view.length), h)
  for (let i = 0; i < view.length; i++) ctx.lineTo(px(i, view.length), py(view[i]))
  ctx.lineTo(px(view.length - 1, view.length), h)
  ctx.closePath()
  const area = ctx.createLinearGradient(0, 0, 0, h)
  area.addColorStop(0, rgba(p.dat, 0.22 + heat * 0.2))
  area.addColorStop(1, rgba(p.dat, 0.02))
  ctx.fillStyle = area
  ctx.fill()
  ctx.strokeStyle = rgba(p.col, 0.85)
  ctx.lineWidth = 1.1
  ctx.beginPath()
  for (let i = 0; i < view.length; i++) {
    if (i === 0) ctx.moveTo(px(i, view.length), py(view[i]))
    else ctx.lineTo(px(i, view.length), py(view[i]))
  }
  ctx.stroke()
}

// ---------------------------------------------------------------------------
// paintVramMap — the top-right inset: the VRAM pool as a block grid, one
// block per GB (capped at 48 blocks), allocated blocks lit, the headroom
// dim. The block count and fill trace gpu.vram/vramTotal exactly.
// ---------------------------------------------------------------------------

export function paintVramMap(ctx, w, h, c) {
  const p = c.palette
  const stale = staleOf(c.snap)
  const heat = stale ? 0 : Math.min(1, c.heat)
  const gpu = (c.snap && c.snap.gpu) || null
  const total = Math.max(1, Math.min(48, Math.round((gpu && gpu.vramTotal) || 24)))
  const used = gpu && gpu.vram != null ? Math.min(total, gpu.vram) : 0
  const cols = 8
  const rows = Math.ceil(total / cols)
  const cw = (w - 10) / cols
  const chh = Math.min(12, (h - 12) / rows)
  const offX = (w - cols * cw) / 2
  const offY = (h - rows * chh) / 2 + 2
  const full = Math.floor(used)
  const frac = used - full
  const hot = gpu && gpu.vramTotal ? (gpu.vram || 0) / gpu.vramTotal >= 0.9 : false
  for (let i = 0; i < total; i++) {
    const gx = i % cols
    const gy = Math.floor(i / cols)
    const x = offX + gx * cw
    const y = offY + gy * chh
    if (i < full) {
      ctx.fillStyle = rgba(hot ? ALM : p.col, 0.6 + heat * 0.2)
      ctx.fillRect(x + 0.5, y + 0.5, cw - 1.5, chh - 1.5)
      ctx.fillStyle = rgba(hot ? ALM : p.col, 0.25)
      ctx.fillRect(x + 0.5, y + 0.5, cw - 1.5, 1.5)
    } else if (i === full && frac > 0.02) {
      ctx.fillStyle = rgba(hot ? ALM : p.col, 0.18)
      ctx.fillRect(x + 0.5, y + 0.5, cw - 1.5, chh - 1.5)
      ctx.fillStyle = rgba(hot ? ALM : p.col, 0.6)
      ctx.fillRect(x + 0.5, y + 0.5, (cw - 1.5) * frac, chh - 1.5)
    } else {
      ctx.strokeStyle = rgba(p.acc, 0.2)
      ctx.lineWidth = 0.6
      ctx.strokeRect(x + 0.5, y + 0.5, cw - 1.5, chh - 1.5)
    }
  }
}

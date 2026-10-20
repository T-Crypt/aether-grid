// Scene painters: every canvas in the console calls into this file.
//
// Contract: paint(ctx, w, h, c) where c is the SceneRoot conductor. Each
// painter is a pure function of (ctx, size, c). No React, no timers. It
// reads the master clock (c.t), the latest snapshot (c.snap), the active
// skin palette (c.palette, "R G B" channel strings), the smoothed scene
// scalars (c.heat / .alert / .flow / .reason) and the event traces
// (c.helix, c.kvFlashes, c.pings, c.events, c.anchors).
//
// State colour language (token-mapped, skin-agnostic):
//   healthy activity / token flow  ->  palette.acc   (cyan on Hex-Lab)
//   heat: vram / power / temp      ->  palette.dat   (amber on Hex-Lab)
//   reasoning / reingest           ->  palette.col   (magenta on Hex-Lab)
//   anomaly / pressure             ->  ALM, absolute red (never a skin token)
// `flowColor` / `reasonColor` below perform the acc->dat->alm and acc->col
// blends from the smoothed scalars, which is how a load burst shifts the
// whole scene's palette and back.

import { ALM } from './conductor'

const chan = (s) => String(s || '0 0 0').trim().split(/\s+/).map(Number)
const rgba = (s, a) => `rgba(${chan(s).join(',')},${a})`

export function mix(a, b, f) {
  const A = chan(a)
  const B = chan(b)
  const t = f < 0 ? 0 : f > 1 ? 1 : f
  return `${Math.round(A[0] + (B[0] - A[0]) * t)} ${Math.round(A[1] + (B[1] - A[1]) * t)} ${Math.round(A[2] + (B[2] - A[2]) * t)}`
}

function flowColor(c) {
  const p = c.palette
  let s = mix(p.acc, p.dat, c.heat * 0.85)
  if (c.alert > 0.05) s = mix(s, ALM, Math.min(1, c.alert) * 0.8)
  return s
}

// Reasoning colour, pulled toward the data colour under heat, capped so the
// reasoning hue survives.
function reasonColor(c) {
  const p = c.palette
  return mix(p.col, mix(p.dat, ALM, c.heat * 0.5), Math.min(0.5, c.heat * 0.5))
}

/** Interpolated read of a ring-buffer series, normalised to 0..1 over `peak`. */
function sampler(hist, peak) {
  const n = hist.length
  if (!n) return () => 0
  return (u) => {
    const x = ((u % 1) + 1) % 1
    const i = Math.floor(x * (n - 1))
    const f = x * (n - 1) - i
    const a = hist[i] || 0
    const b = hist[Math.min(n - 1, i + 1)] || a
    return (a + (b - a) * f) / peak
  }
}

function tpsHist(c) {
  return c.snap?.kpiHist?.tps || []
}

function det(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// ---------------------------------------------------------------------------
// DECLINATION. Full-bleed field backdrop. Ambient wash from the throughput
// baseline; warms as the scene heats (palette shift) and takes an alarm tint
// under pressure. Sits behind everything.
// ---------------------------------------------------------------------------

export function paintBackdrop(ctx, w, h, c) {
  if (!c.layers.declination) return
  const hist = tpsHist(c)
  const peak = Math.max(1, ...(hist.length ? hist : [1]))
  const sample = sampler(hist, peak)
  const col = flowColor(c)
  const breathe = 0.5 + 0.5 * Math.sin(c.t * 0.24)
  const energy = 0.55 + c.heat * 0.7 + breathe * 0.12

  const bands = 5
  for (let b = 0; b < bands; b++) {
    const p = b / (bands - 1)
    const yBase = h * (0.24 + p * 0.56)
    ctx.beginPath()
    ctx.moveTo(0, h)
    for (let i = 0; i <= 40; i++) {
      const u = i / 40 + c.t * 0.01 + b * 0.07
      const y = yBase - sample(u) * h * 0.3 * energy
      ctx.lineTo((i / 40) * w, y)
    }
    ctx.lineTo(w, h)
    ctx.closePath()
    const g = ctx.createLinearGradient(0, yBase - h * 0.32, 0, h)
    g.addColorStop(0, rgba(col, (0.05 + c.heat * 0.05) * (1 - p * 0.55)))
    g.addColorStop(1, rgba(col, 0))
    ctx.fillStyle = g
    ctx.fill()
  }

  if (c.heat > 0.02) {
    const g = ctx.createRadialGradient(w * 0.5, h * 1.05, 0, w * 0.5, h * 1.05, h * 0.9)
    g.addColorStop(0, rgba(c.palette.dat, 0.10 * c.heat))
    g.addColorStop(1, rgba(c.palette.dat, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
  if (c.alert > 0.03) {
    const g = ctx.createRadialGradient(w * 0.5, -h * 0.3, 0, w * 0.5, -h * 0.3, h * 0.9)
    g.addColorStop(0, rgba(ALM, 0.12 * Math.min(1, c.alert)))
    g.addColorStop(1, rgba(ALM, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
}

// ---------------------------------------------------------------------------
// LOOM-9. Router cables crossing panel boundaries. Cables run from the
// engine rail (left) through the queue and the hero stage to the KV grid
// and the GPU block, so data visibly routes across the whole frame. Packet
// speed tracks the decode rate; a request_arrived burst fires bright
// packets from the queue; packets warm/turn red with scene state.
// ---------------------------------------------------------------------------

const LOOM_SOURCES = [
  { id: 'engines', label: 'engine rail' },
  { id: 'queue', label: 'queue' },
  { id: 'reasoning', label: 'reasoning' },
]

function edgePoint(a, side) {  if (!a) return null
  if (side === 'right') return { x: a.x + a.w, y: a.y + a.h * 0.5 }
  if (side === 'left') return { x: a.x, y: a.y + a.h * 0.5 }
  if (side === 'center') return { x: a.x + a.w * 0.5, y: a.y + a.h * 0.5 }
  return { x: a.x + a.w * 0.5, y: a.y + a.h * 0.5 }
}

export function paintCables(ctx, w, h, c) {
  if (!c.layers.loom9) return
  const p = c.palette
  const col = flowColor(c)
  const A = c.anchors
  const hero = A.get('hero') || { x: w * 0.3, y: h * 0.2, w: w * 0.4, h: h * 0.6 }
  const kv = A.get('kv') || { x: w * 0.86, y: h * 0.18, w: w * 0.1, h: h * 0.3 }
  const gpu = A.get('gpu') || { x: w * 0.04, y: h * 0.62, w: w * 0.16, h: h * 0.24 }
  const queue = A.get('queue') || { x: w * 0.08, y: h * 0.1, w: w * 0.1, h: h * 0.06 }

  const engines = (c.snap?.engines || []).filter((e) => e)
  const railN = Math.max(1, engines.length)
  const rail = []
  for (let i = 0; i < railN; i++) {
    rail.push({ x: w * 0.015, y: h * (0.3 + (i + 0.5) * (0.42 / railN)) })
  }

  const routes = [
    { from: rail[0] || { x: w * 0.02, y: h * 0.4 }, via: edgePoint(queue, 'center'), to: edgePoint(hero, 'left'), load: Math.min(1, c.flow * 1.2) },
    { from: edgePoint(queue, 'center'), via: edgePoint(hero, 'center'), to: edgePoint(kv, 'left'), load: c.flow },
    { from: edgePoint(hero, 'right'), via: { x: (hero.x + hero.w + kv.x) / 2, y: kv.y + 8 }, to: edgePoint(kv, 'left'), load: c.flow * 0.8 },
    { from: edgePoint(hero, 'center'), via: edgePoint(gpu, 'right'), to: edgePoint(gpu, 'center'), load: Math.min(1, c.heat + c.flow * 0.3) },
    { from: rail[1] || rail[0] || { x: w * 0.02, y: h * 0.55 }, via: { x: w * 0.2, y: h * 0.66 }, to: edgePoint(gpu, 'left'), load: Math.max(0.25, c.heat) },
  ]

  ctx.lineCap = 'round'
  routes.forEach((r, i) => {
    if (!r.from || !r.to || !r.via) return
    const { from, via, to } = r
    const path = () => {
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.bezierCurveTo(via.x, from.y, via.x, to.y, to.x, to.y)
    }
    path()
    ctx.strokeStyle = rgba(col, 0.08 + r.load * 0.2)
    ctx.lineWidth = 0.8 + r.load * 1.6
    ctx.stroke()

    const n = 2 + Math.round(r.load * 3)
    const speed = 0.06 + c.flow * 0.16 + (i === 0 ? 0.02 : 0)
    for (let k = 0; k < n; k++) {
      const u = ((c.t * speed + k / n + i * 0.13) % 1 + 1) % 1
      const b = 1 - u
      const x = b * b * b * from.x + 3 * b * b * u * via.x + 3 * b * u * u * via.x + u * u * u * to.x
      const y = b * b * b * from.y + 3 * b * b * u * via.y + 3 * b * u * u * to.y + u * u * u * to.y
      ctx.beginPath()
      ctx.arc(x, y, 1.3 + r.load * 1.5, 0, Math.PI * 2)
      ctx.fillStyle = rgba(col, 0.25 + r.load * 0.6)
      ctx.fill()
    }
  })

  // Request bursts: bright packets fired from the queue when new requests
  // landed in the last 1.5 s of master time.
  for (const ev of c.events) {
    if (ev.type !== 'request_arrived') continue
    if (c.t - ev.t > 1.5) continue
    const age = c.t - ev.t
    const u = Math.min(0.98, age / 1.2)
    const from = edgePoint(queue, 'center') || { x: w * 0.1, y: h * 0.1 }
    const to = edgePoint(hero, 'left')
    const via = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - h * 0.08 }
    const b = 1 - u
    const x = b * b * b * from.x + 3 * b * b * u * via.x + 3 * b * u * u * via.x + u * u * u * to.x
    const y = b * b * b * from.y + 3 * b * b * u * via.y + 3 * b * u * u * via.y + u * u * u * to.y
    // Glow without shadowBlur: a soft halo circle under the bright head.
    ctx.beginPath()
    ctx.arc(x, y, 6, 0, Math.PI * 2)
    ctx.fillStyle = rgba(p.col, 0.25)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x, y, 2.4, 0, Math.PI * 2)
    ctx.fillStyle = rgba(p.col, 0.9)
    ctx.fill()
  }

  const dot = (pt) => {
    if (!pt) return
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2)
    ctx.fillStyle = rgba(col, 0.8)
    ctx.fill()
  }
  rail.forEach(dot)
  dot(edgePoint(queue, 'center'))
  dot(edgePoint(kv, 'center'))
  dot(edgePoint(gpu, 'center'))
}

// ---------------------------------------------------------------------------
// SCOPE-OMEGA. Full-bleed anomaly scatter. Threshold excursions from the
// KPI histories plot as pulsing outliers anchored near their source region;
// live anomaly events add expanding red/amber ping rings on top.
// ---------------------------------------------------------------------------

const SCATTER_REGIONS = ['hero', 'gpu', 'kv', 'queue', 'hero', 'kv']

export function paintScatter(ctx, w, h, c) {
  if (!c.layers.scopeOmega) return
  const p = c.palette
  const A = c.anchors

  // Faint full-width reference lines keep the "scatter plot" read.
  ctx.strokeStyle = rgba(p.acc, 0.07)
  ctx.lineWidth = 1
  for (let i = 1; i < 4; i++) {
    const y = (h / 4) * i
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }

  const q = c.snap?.kpiHist?.queue || []
  const v = c.snap?.kpiHist?.vram || []
  const pl = c.snap?.kpiHist?.p95 || []
  const n = Math.max(1, Math.min(q.length, 48))

  for (let i = 0; i < 12; i++) {
    const idx = Math.floor((i / 11) * (n - 1))
    const qq = Math.min(1, (q[idx] ?? 0) / 14)
    const vv = (v[idx] ?? 0) / 24
    const pp = Math.min(1, (pl[idx] ?? 0) / 900)
    const crit = qq > 0.65 || vv > 0.9
    const a = A.get(SCATTER_REGIONS[i % SCATTER_REGIONS.length])
    const ox = a ? a.x + a.w * (0.15 + 0.7 * det(i * 3.7)) : (i / 12) * w
    const oy = a ? a.y + a.h * (0.2 + 0.6 * det(i * 9.1)) : (det(i * 5.3) * h)
    const pulse = 0.5 + 0.5 * Math.sin(c.t * 2.4 + i * 0.7)
    const r = (2 + Math.max(qq, vv * 0.5) * 4.5) + pulse * 1.4
    const col = crit ? ALM : flowColor(c)
    // Halo under dot keeps the outlier read without shadowBlur cost.
    ctx.beginPath()
    ctx.arc(ox, oy, r * 2.1, 0, Math.PI * 2)
    ctx.fillStyle = rgba(col, 0.12 + pulse * 0.12)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(ox, oy, r, 0, Math.PI * 2)
    ctx.fillStyle = rgba(col, 0.4 + pulse * 0.4)
    ctx.fill()
  }

  // Live anomaly pings: expanding rings, red for err, amber for warn.
  for (const ping of c.pings) {
    const age = c.t - ping.t0
    const k = age / 1.6
    if (k < 0 || k > 1) continue
    const col = ping.crit ? ALM : p.dat
    ctx.beginPath()
    ctx.arc(ping.x, ping.y, 6 + k * 110, 0, Math.PI * 2)
    ctx.strokeStyle = rgba(col, (1 - k) * 0.7)
    ctx.lineWidth = 1.6 - k
    ctx.stroke()
    if (k < 0.25) {
      ctx.beginPath()
      ctx.arc(ping.x, ping.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = rgba(col, 0.9)
      ctx.fill()
    }
  }
}

// ---------------------------------------------------------------------------
// SAFEHOUSE. Pinned reasoning scope. A radar read of load. The sweep angle
// is the master clock. Blips are deterministic per session slot and turn
// red when a slot runs hot. Anomalies flare the sweep. It deliberately draws
// no session content. No chain-of-thought leaks into the shared field.
// ---------------------------------------------------------------------------

export function paintScope(ctx, w, h, c) {
  if (!c.layers.safehouse) return
  const p = c.palette
  const cx = w / 2
  const cy = h / 2
  const R = Math.min(w, h) * 0.44
  const alarmed = c.alert > 0.35
  const sweepCol = alarmed ? ALM : p.acc

  ctx.strokeStyle = rgba(flowColor(c), 0.16)
  ctx.lineWidth = 1
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath()
    ctx.arc(cx, cy, (R / 3) * i, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(cx - R, cy)
  ctx.lineTo(cx + R, cy)
  ctx.moveTo(cx, cy - R)
  ctx.lineTo(cx, cy + R)
  ctx.stroke()

  // Pressure ring: warms and brightens with c.heat.
  if (c.heat > 0.05) {
    ctx.beginPath()
    ctx.arc(cx, cy, R * (0.92 + 0.06 * Math.sin(c.t * 3)), 0, Math.PI * 2)
    ctx.strokeStyle = rgba(c.palette.dat, 0.12 + c.heat * 0.4)
    ctx.lineWidth = 1 + c.heat
    ctx.stroke()
  }

  // Anomaly pings echo on the radar.
  for (const ping of c.pings) {
    const age = c.t - ping.t0
    const k = age / 1.6
    if (k < 0 || k > 1) continue
    const col = ping.crit ? ALM : p.dat
    ctx.beginPath()
    ctx.arc(cx, cy, R * 0.15 + k * R * 0.8, 0, Math.PI * 2)
    ctx.strokeStyle = rgba(col, (1 - k) * 0.7)
    ctx.lineWidth = 1.4
    ctx.stroke()
  }

  const a = c.t * 0.7
  // Sweep glow: a second wide low-alpha stroke instead of shadowBlur.
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
  ctx.strokeStyle = rgba(sweepCol, 0.18)
  ctx.lineWidth = alarmed ? 6 : 4
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
  ctx.strokeStyle = rgba(sweepCol, 0.9)
  ctx.lineWidth = 1.4
  ctx.stroke()

  const sessions = (c.snap?.sessions || []).slice(0, 14)
  const count = Math.max(7, sessions.length)
  for (let i = 0; i < count; i++) {
    const s = sessions[i]
    const hot = s && s.window ? (s.used || 0) / s.window >= 0.85 : false
    const fill = s && s.window ? Math.min(1, (s.used || 0) / s.window) : det(i * 2.3) * 0.5
    const ang = (i / count) * Math.PI * 2 + c.t * 0.12
    const rr = R * (0.3 + 0.62 * fill)
    const col = hot ? ALM : flowColor(c)
    const tw = 0.6 + 0.4 * Math.sin(c.t * 2 + i)
    ctx.beginPath()
    ctx.arc(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, hot ? 2.6 : 2, 0, Math.PI * 2)
    ctx.fillStyle = rgba(col, 0.4 + tw * 0.5)
    ctx.fill()
  }
}

// ---------------------------------------------------------------------------
// 4_CKS / CTX. Brainwave terrain. The throughput series as a receding
// wireframe mesh. The front ridge carries the decode signal; the sweep is
// the measurement pass. Colour rides the scene state like everything else.
// ---------------------------------------------------------------------------

export function paintTerrain(ctx, w, h, c) {
  const hist = tpsHist(c)
  const peak = Math.max(1, ...(hist.length ? hist : [1]))
  const sample = sampler(hist, peak)
  const col = flowColor(c)
  const cols = 56
  const rows = 6
  const grid = []

  for (let r = 0; r < rows; r++) {
    const depth = r / (rows - 1)
    const yBase = h * (0.34 + depth * 0.6)
    const amp = h * (0.34 - depth * 0.17)
    const row = []
    for (let i = 0; i <= cols; i++) {
      const u = i / cols + c.t * 0.015 + depth * 0.06
      row.push({ x: (i / cols) * w, y: yBase - sample(u) * amp })
    }
    grid.push(row)
  }

  for (let r = rows - 1; r >= 0; r--) {
    ctx.beginPath()
    grid[r].forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)))
    ctx.strokeStyle = rgba(col, 0.08 + (1 - r / (rows - 1)) * 0.4)
    ctx.lineWidth = r === 0 ? 1.5 : 1
    ctx.stroke()
  }

  ctx.beginPath()
  for (let i = 0; i <= cols; i += 2) {
    for (let r = 0; r < rows; r++) {
      const pt = grid[r][i]
      if (r === 0) ctx.moveTo(pt.x, pt.y)
      else ctx.lineTo(pt.x, pt.y)
    }
  }
  ctx.strokeStyle = rgba(col, 0.14)
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(0, h)
  grid[0].forEach((pt) => ctx.lineTo(pt.x, pt.y))
  ctx.lineTo(w, h)
  ctx.closePath()
  const fill = ctx.createLinearGradient(0, h * 0.15, 0, h)
  fill.addColorStop(0, rgba(col, 0.22))
  fill.addColorStop(1, rgba(col, 0))
  ctx.fillStyle = fill
  ctx.fill()

  ctx.beginPath()
  grid[0].forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)))
  // Glow ridge: a wide low-alpha pass under the bright line, no shadowBlur.
  ctx.strokeStyle = rgba(col, 0.25)
  ctx.lineWidth = 4.5
  ctx.stroke()
  ctx.strokeStyle = rgba(col, 0.95)
  ctx.lineWidth = 1.4
  ctx.stroke()

  const sx = ((c.t * 0.09) % 1) * w
  const sweep = ctx.createLinearGradient(sx - 46, 0, sx + 46, 0)
  sweep.addColorStop(0, rgba(c.palette.dat, 0))
  sweep.addColorStop(0.5, rgba(c.palette.dat, 0.1))
  sweep.addColorStop(1, rgba(c.palette.dat, 0))
  ctx.fillStyle = sweep
  ctx.fillRect(sx - 46, 0, 92, h)
}

// ---------------------------------------------------------------------------
// SHE_10N / DEV. The hero. A tall double helix whose coil phase is the
// token clock. It advances decode rate over TOKENS_PER_COIL coils per second,
// so the helix visibly turns per token. Token packet trains ride the strands.
// Request arrivals kick a bright impulse down the spine. Anomalies glitch the
// strands and flash them alarm red. Heat warms the strands, and the reasoning
// hue deepens with reasoning load.
// ---------------------------------------------------------------------------

export function paintHero(ctx, w, h, c) {
  const p = c.palette
  const tps = c.snap?.kpi?.tps || 0
  const energy = Math.min(1, tps / 280)
  const cx = w / 2
  // Coil radius tracks the scope width so the helix owns the hero, capped by
  // the height; decode energy still breathes it, in a narrower band.
  const amp = Math.min(w * 0.36, h * 0.44) * (0.75 + energy * 0.25)
  const turns = 5.5
  const phase = c.helix.phase
  const kick = c.helix.kick
  const flow = flowColor(c)
  const strandCol = mix(flow, reasonColor(c), Math.min(0.75, c.reason))
  // Decode burst: strands thicken and brighten with the smoothed flow/heat
  // scalars so a burst reads even at low energy in the coil itself.
  const surge = Math.min(1, c.flow * 0.85 + c.heat * 0.15)
  const strandLw = 1.4 + surge * 1.8
  const strandA = 0.55 + surge * 0.45

  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, rgba(strandCol, 0))
  bg.addColorStop(0.5, rgba(strandCol, 0.05 + c.reason * 0.05))
  bg.addColorStop(1, rgba(strandCol, 0))
  ctx.fillStyle = bg
  ctx.fillRect(cx - amp * 1.3, 0, amp * 2.6, h)

  // A second, fainter helix trails the main strand: same master clock but
  // 0.6x the phase speed and 0.8x the amplitude, for depth.
  const ghost = (offset, alpha) => {
    const N = Math.max(48, Math.floor(h / 4))
    ctx.beginPath()
    for (let i = 0; i <= N; i++) {
      const q = i / N
      const y = q * h
      const x = cx + Math.sin(q * Math.PI * 2 * turns + phase * 0.6 + offset) * amp * 0.8
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = rgba(flow, alpha)
    ctx.lineWidth = 1
    ctx.stroke()
  }
  ghost(phase * 0.2, 0.14)

  const strand = (offset, color, lw, jitter) => {
    const N = Math.max(64, Math.floor(h / 3))
    ctx.beginPath()
    for (let i = 0; i <= N; i++) {
      const q = i / N
      let x = cx + Math.sin(q * Math.PI * 2 * turns + phase + offset) * amp
      if (jitter > 0) x += (det(i * 7.13 + Math.floor(c.t * 30)) - 0.5) * 10 * jitter * Math.sin(q * 21 + c.t * 18)
      const y = q * h
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = color
    ctx.lineWidth = lw
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  strand(0, rgba(strandCol, strandA), strandLw, kick)
  strand(Math.PI, rgba(mix(strandCol, p.col, 0.4), strandA * 0.94), strandLw, kick)

  const rungs = 40
  for (let i = 0; i <= rungs; i++) {
    const q = i / rungs
    const y = q * h
    const a = Math.sin(q * Math.PI * 2 * turns + phase)
    const x1 = cx + a * amp
    const x2 = cx - a * amp
    ctx.beginPath()
    ctx.moveTo(x1, y)
    ctx.lineTo(x2, y)
    ctx.strokeStyle = rgba(strandCol, 0.05 + 0.2 * Math.abs(Math.sin(q * Math.PI * turns)))
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // Crossing nodes: where the strands meet, the structure reads as double
  // helix rather than wave. Halo + dot, no shadowBlur.
  for (let k = 0; k <= turns * 2; k++) {
    const q = (k / (turns * 2) + (phase / (Math.PI * 2 * turns)) % 1) % 1
    const y = q * h
    const a = Math.sin(q * Math.PI * 2 * turns + phase)
    const r = 1.5 + 1.8 * Math.abs(a)
    ctx.beginPath()
    ctx.arc(cx + a * amp, y, r * 2.4, 0, Math.PI * 2)
    ctx.fillStyle = rgba(strandCol, 0.18)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx + a * amp, y, r, 0, Math.PI * 2)
    ctx.fillStyle = rgba(strandCol, 0.85)
    ctx.fill()
  }

  // Token packet train: the on-screen packet count tracks decode rate,
  // capped so a burst never strobes. Each packet is a glowing pair of dots
  // on the strands plus a faint scan line.
  const packets = Math.max(1, Math.min(12, Math.round(tps / 30)))
  for (let i = 0; i < packets; i++) {
    const q = ((c.t * packets) + i / packets) % 1
    const y = q * h
    const a = Math.sin(q * Math.PI * 2 * turns + phase)
    ctx.beginPath()
    ctx.moveTo(cx - amp * 1.25, y)
    ctx.lineTo(cx + amp * 1.25, y)
    ctx.strokeStyle = rgba(strandCol, 0.1)
    ctx.lineWidth = 1
    ctx.stroke()
    for (const side of [1, -1]) {
      const px = cx + side * a * amp
      ctx.beginPath()
      ctx.arc(px, y, 6, 0, Math.PI * 2)
      ctx.fillStyle = rgba(strandCol, 0.22)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(px, y, 2.6, 0, Math.PI * 2)
      ctx.fillStyle = rgba(mix(strandCol, p.acc, 0.5), 0.95)
      ctx.fill()
    }
  }

  if (kick > 0.02) {
    ctx.fillStyle = rgba(ALM, kick * 0.08)
    ctx.fillRect(0, 0, w, h)
  }
}

// ---------------------------------------------------------------------------
// COHORT / KV. Slot change flashes. The DOM grid carries the slots. A thin
// canvas on top flashes the slot that just changed. A kv_slot_changed event
// reads as a pulse on the grid itself. Cells are a uniform 8x4 grid, so the
// geometry is analytic (no per-frame DOM reads).
// ---------------------------------------------------------------------------

export const KV_COLS = 8
export const KV_ROWS = 4

export function paintKvFlashes(ctx, w, h, c) {
  // Matches the DOM grid: 8 columns, uniform cells, 4px gap, no margin.
  const gap = 4
  const cw = (w - gap * (KV_COLS - 1)) / KV_COLS
  const rh = (h - gap * (KV_ROWS - 1)) / KV_ROWS
  for (const f of c.kvFlashes) {
    const age = c.t - f.t0
    const k = age / 1.4
    if (k < 0 || k > 1) continue
    const colIdx = ((f.index % KV_COLS) + KV_COLS) % KV_COLS
    const rowIdx = Math.floor(f.index / KV_COLS) % KV_ROWS
    if (rowIdx >= KV_ROWS) continue
    const x = colIdx * (cw + gap)
    const y = rowIdx * (rh + gap)
    const col = f.to >= 0.85 ? ALM : f.to >= 0.6 ? c.palette.dat : c.palette.acc
    if (k < 0.35) {
      ctx.fillStyle = rgba(col, (1 - k / 0.35) * 0.35)
      ctx.fillRect(x, y, cw, rh)
    }
    const rk = Math.min(1, age / 0.9)
    if (rk < 1) {
      const r = Math.max(cw, rh) * (0.2 + rk * 0.75)
      ctx.beginPath()
      ctx.arc(x + cw / 2, y + rh / 2, r, 0, Math.PI * 2)
      ctx.strokeStyle = rgba(col, (1 - rk) * 0.8)
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }
}

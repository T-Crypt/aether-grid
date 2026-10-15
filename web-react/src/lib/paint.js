// Canvas painters. Each takes space-separated RGB channels ("0 224 224", as
// stored in the skin palette) and an elapsed time in seconds.
//
// Everything here is a pure function of (ctx, size, t, data) — no React, no
// globals — so a painter can be unit-tested or reused by the static UI later.

const chan = (s) => String(s).trim().split(/\s+/).map(Number)
const rgba = (s, a) => `rgba(${chan(s).join(',')},${a})`

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

/**
 * Brainwave terrain as a receding wireframe mesh: six ridge lines, vertical
 * connectors, a glowing front ridge and a fill under it, plus a slow scan
 * sweep. Replaces the flat line strip with something with depth.
 */
export function paintTerrain(ctx, w, h, t, hist, acc, dat) {
  const peak = Math.max(1, ...(hist.length ? hist : [1]))
  const sample = sampler(hist, peak)
  const cols = 56
  const rows = 6
  const grid = []

  for (let r = 0; r < rows; r++) {
    const depth = r / (rows - 1) // 0 front .. 1 back
    const yBase = h * (0.34 + depth * 0.60)
    const amp = h * (0.34 - depth * 0.17)
    const row = []
    for (let c = 0; c <= cols; c++) {
      const u = c / cols + t * 0.015 + depth * 0.06
      row.push({ x: (c / cols) * w, y: yBase - sample(u) * amp })
    }
    grid.push(row)
  }

  // Back-to-front horizontal strands.
  for (let r = rows - 1; r >= 0; r--) {
    ctx.beginPath()
    grid[r].forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
    ctx.strokeStyle = rgba(acc, 0.08 + (1 - r / (rows - 1)) * 0.40)
    ctx.lineWidth = r === 0 ? 1.5 : 1
    ctx.stroke()
  }

  // Vertical connectors give the mesh its wireframe read.
  ctx.beginPath()
  for (let c = 0; c <= cols; c += 2) {
    for (let r = 0; r < rows; r++) {
      const p = grid[r][c]
      if (r === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    }
  }
  ctx.strokeStyle = rgba(acc, 0.14)
  ctx.lineWidth = 1
  ctx.stroke()

  // Fill under the front ridge.
  ctx.beginPath()
  ctx.moveTo(0, h)
  grid[0].forEach((p) => ctx.lineTo(p.x, p.y))
  ctx.lineTo(w, h)
  ctx.closePath()
  const fill = ctx.createLinearGradient(0, h * 0.15, 0, h)
  fill.addColorStop(0, rgba(acc, 0.24))
  fill.addColorStop(1, rgba(acc, 0))
  ctx.fillStyle = fill
  ctx.fill()

  // Glowing front ridge.
  ctx.beginPath()
  grid[0].forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  ctx.strokeStyle = rgba(acc, 0.95)
  ctx.lineWidth = 1.4
  ctx.shadowColor = rgba(acc, 0.8)
  ctx.shadowBlur = 12
  ctx.stroke()
  ctx.shadowBlur = 0

  // Slow scan sweep (data-coloured, so it reads as measurement not structure).
  const sx = ((t * 0.09) % 1) * w
  const sweep = ctx.createLinearGradient(sx - 46, 0, sx + 46, 0)
  sweep.addColorStop(0, rgba(dat, 0))
  sweep.addColorStop(0.5, rgba(dat, 0.10))
  sweep.addColorStop(1, rgba(dat, 0))
  ctx.fillStyle = sweep
  ctx.fillRect(sx - 46, 0, 92, h)
}

/**
 * Reasoning double helix. Two counter-phased strands whose amplitude tracks
 * `energy`, with rungs whose opacity fades with depth, and bright nodes where
 * the strands cross.
 */
export function paintHelix(ctx, w, h, t, acc, col, energy = 0.7) {
  const cx = w / 2
  const amp = Math.min(w * 0.2, 96) * (0.5 + Math.min(1, Math.max(0, energy)) * 0.5)
  const turns = 4.2
  const phase = t * 0.55
  const N = Math.max(48, Math.floor(h / 3))

  const strand = (offset, color, lw) => {
    ctx.beginPath()
    for (let i = 0; i <= N; i++) {
      const p = i / N
      const y = p * h
      const x = cx + Math.sin(p * Math.PI * 2 * turns + phase + offset) * amp
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = color
    ctx.lineWidth = lw
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  strand(0, rgba(acc, 0.85), 1.6)
  strand(Math.PI, rgba(col, 0.85), 1.6)

  const rungs = 34
  for (let i = 0; i <= rungs; i++) {
    const p = i / rungs
    const y = p * h
    const a = Math.sin(p * Math.PI * 2 * turns + phase)
    const x1 = cx + a * amp
    const x2 = cx - a * amp
    ctx.beginPath()
    ctx.moveTo(x1, y)
    ctx.lineTo(x2, y)
    ctx.strokeStyle = rgba(acc, 0.06 + 0.24 * Math.abs(Math.sin(p * Math.PI * turns)))
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // Crossings get a node, which is what makes it read as "structure" not "wave".
  ctx.shadowColor = rgba(acc, 0.9)
  ctx.shadowBlur = 10
  for (let k = 0; k <= turns * 2; k++) {
    const p = (k / (turns * 2) + (phase / (Math.PI * 2 * turns)) % 1) % 1
    const y = p * h
    const a = Math.sin(p * Math.PI * 2 * turns + phase)
    const r = 1.4 + 1.6 * Math.abs(a)
    ctx.beginPath()
    ctx.arc(cx + a * amp, y, r, 0, Math.PI * 2)
    ctx.fillStyle = rgba(acc, 0.9)
    ctx.fill()
  }
  ctx.shadowBlur = 0
}

/** Declination layer: a slow ambient wash driven by the host/GPU baseline. */
export function paintBackdrop(ctx, w, h, t, hist, acc) {
  const peak = Math.max(1, ...(hist.length ? hist : [1]))
  const sample = sampler(hist, peak)
  const bands = 5
  for (let b = 0; b < bands; b++) {
    const p = b / (bands - 1)
    const yBase = h * (0.25 + p * 0.55)
    ctx.beginPath()
    ctx.moveTo(0, h)
    for (let c = 0; c <= 40; c++) {
      const u = c / 40 + t * 0.01 + b * 0.07
      const y = yBase - sample(u) * h * 0.28
      ctx.lineTo((c / 40) * w, y)
    }
    ctx.lineTo(w, h)
    ctx.closePath()
    const g = ctx.createLinearGradient(0, yBase - h * 0.3, 0, h)
    g.addColorStop(0, rgba(acc, 0.10 - p * 0.06))
    g.addColorStop(1, rgba(acc, 0))
    ctx.fillStyle = g
    ctx.fill()
  }
}

/** Scope-Omega layer: threshold excursions plotted as pulsing outliers. */
export function paintScatter(ctx, w, h, t, points, acc, col) {
  // Baseline reference lines.
  ctx.strokeStyle = rgba(acc, 0.1)
  ctx.lineWidth = 1
  for (let i = 1; i < 4; i++) {
    const y = (h / 4) * i
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
  for (const p of points) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + p.phase)
    ctx.beginPath()
    ctx.arc(p.x * w, p.y * h, p.r + pulse * 1.6, 0, Math.PI * 2)
    ctx.fillStyle = rgba(p.crit ? col : acc, 0.5 + pulse * 0.4)
    ctx.shadowColor = rgba(p.crit ? col : acc, 0.9)
    ctx.shadowBlur = 8
    ctx.fill()
  }
  ctx.shadowBlur = 0
}

/** Loom-9 layer: model -> engine cables, thickness from live throughput. */
export function paintCables(ctx, w, h, t, cables, acc, dat) {
  const midX = w * 0.18
  const endX = w * 0.86
  cables.forEach((c, i) => {
    const y0 = h * (0.2 + (i / Math.max(1, cables.length - 1)) * 0.6)
    const y1 = h * (0.3 + ((i * 5) % 7) / 10 * 0.4)
    const cxp = (y0 + y1) / 2 + Math.sin(t * 0.4 + i) * 6
    ctx.beginPath()
    ctx.moveTo(midX, y0)
    ctx.bezierCurveTo(w * 0.45, y0, w * 0.6, y1, endX, y1)
    ctx.strokeStyle = rgba(dat, 0.16 + c.load * 0.5)
    ctx.lineWidth = 0.8 + c.load * 3.2
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(endX, y1, 1.6 + c.load * 2.4, 0, Math.PI * 2)
    ctx.fillStyle = rgba(acc, 0.9)
    ctx.fill()
    void cxp
  })
}

/** Safehouse layer: a scoped, dimmed radar read of reasoning sessions. */
export function paintScope(ctx, w, h, t, acc, load) {
  const cx = w / 2
  const cy = h / 2
  const R = Math.min(w, h) * 0.42
  ctx.strokeStyle = rgba(acc, 0.14)
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

  const a = t * 0.7
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
  ctx.strokeStyle = rgba(acc, 0.85)
  ctx.lineWidth = 1.4
  ctx.shadowColor = rgba(acc, 0.8)
  ctx.shadowBlur = 10
  ctx.stroke()
  ctx.shadowBlur = 0

  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI * 2 + t * 0.12
    const rr = R * (0.35 + 0.6 * ((i * 37) % 10) / 10) * (0.6 + load * 0.4)
    ctx.beginPath()
    ctx.arc(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, 2, 0, Math.PI * 2)
    ctx.fillStyle = rgba(acc, 0.75)
    ctx.fill()
  }
}

import { useId } from 'react'
import { motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { KPI_KEYS, KPI_LABEL, KPI_PRIMARY, KPI_FMT, clamp01 } from '../lib/format'

const WINDOW = 60 // points shown in a sparkline

/** Micro-sparkline: area fill plus a glowing tip at the newest sample. */
function Sparkline({ data, color = 'rgb(var(--acc))', height = 24 }) {
  const gid = useId().replace(/:/g, '')
  const series = data.slice(-WINDOW)
  if (series.length < 2) return <div style={{ height }} aria-hidden="true" />
  const max = Math.max(...series)
  const min = Math.min(...series)
  const span = max - min || 1
  const pts = series.map((v, i) => [
    (i / (series.length - 1)) * 100,
    height - 2 - ((v - min) / span) * (height - 6),
  ])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ')
  const area = `${line} L100 ${height} L0 ${height} Z`
  const tip = pts[pts.length - 1]

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`sg-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.30" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
      <circle cx={tip[0]} cy={tip[1]} r="1.8" fill={color} />
    </svg>
  )
}

/** Progress ring for capacity-style metrics (VRAM used of total, KV cache). */
function Ring({ pct, color = 'rgb(var(--acc))', caption, value }) {
  const r = 26
  const circ = 2 * Math.PI * r
  const filled = clamp01(pct) * circ
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 64 64" className="h-[58px] w-[58px] -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgb(var(--acc) / 0.12)" strokeWidth="4.5" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray={`${filled.toFixed(2)} ${circ.toFixed(2)}`}
          style={{ transition: 'stroke-dasharray 420ms cubic-bezier(.22,1,.36,1)' }}
        />
      </svg>
      <div className="min-w-0">
        <div className="text-lg font-bold tabular-nums text-ink-1">{value}</div>
        <div className="micro mt-0.5">{caption}</div>
      </div>
    </div>
  )
}

function Trend({ hist, higherIsWorse = false }) {
  if (!hist || hist.length < 20) return null
  const now = hist[hist.length - 1]
  const then = hist[Math.max(0, hist.length - 30)]
  const delta = now - then
  const flat = Math.abs(delta) < Math.max(0.4, Math.abs(then) * 0.01)
  const bad = higherIsWorse ? delta > 0 : delta < 0
  const Icon = flat ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight
  const tone = flat ? 'text-ink-3' : bad ? 'text-col' : 'text-dat'
  return (
    <span className={`inline-flex items-center gap-0.5 text-2xs ${tone}`} title={`Δ ${delta.toFixed(1)} over 30 ticks`}>
      <Icon size={11} aria-hidden="true" />
      {flat ? 'flat' : Math.abs(delta).toFixed(delta >= 100 || delta <= -100 ? 0 : 1)}
    </span>
  )
}

const HIGHER_IS_WORSE = { p95: true, ttft: true, tpot: true, queue: true, reingest: true, vram: true }

/**
 * Telemetry row: the four steered metrics as modular cards (sparkline or
 * progress ring), then the remaining six as a dense readout band.
 */
export default function Metrics({ snap, tick, stagger = 0 }) {
  const k = snap.kpi || {}
  const gpu = snap.gpu || {}
  const vramTotal = gpu.vramTotal || 24

  const primary = [
    { key: 'tps', color: 'rgb(var(--acc))' },
    { key: 'p95', color: 'rgb(var(--col))' },
    { key: 'queue', color: 'rgb(var(--dat))' },
    { key: 'vram', color: 'rgb(var(--acc))', ring: true },
  ]

  const secondary = KPI_KEYS.filter((key) => !KPI_PRIMARY[key])

  return (
    <section aria-label="Key metrics" className="grid gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {primary.map((m, i) => {
          const hist = snap.kpiHist?.[m.key] || []
          const val = KPI_FMT[m.key](k[m.key] ?? 0)
          return (
            <motion.div
              key={m.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: stagger + i * 0.06 }}
              className="glass relative overflow-hidden rounded-md p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="micro">{KPI_LABEL[m.key]}</span>
                <Trend hist={hist} higherIsWorse={HIGHER_IS_WORSE[m.key]} />
              </div>

              {m.ring ? (
                <div className="mt-2.5">
                  <Ring
                    pct={(k.vram ?? 0) / vramTotal}
                    color={m.color}
                    value={val}
                    caption={`of ${vramTotal.toFixed(0)} GB`}
                  />
                </div>
              ) : (
                <>
                  <div className="mt-1">
                    <motion.span
                      key={val}
                      initial={{ opacity: 0.35, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28 }}
                      className="inline-block text-[26px] font-bold leading-none tabular-nums text-ink-1"
                    >
                      {val}
                    </motion.span>
                  </div>
                  <div className="mt-2.5">
                    <Sparkline data={hist} color={m.color} />
                  </div>
                </>
              )}
            </motion.div>
          )
        })}
      </div>

      <div className="glass grid grid-cols-3 gap-px overflow-hidden rounded-md sm:grid-cols-3 lg:grid-cols-6">
        {secondary.map((key) => {
          const val = KPI_FMT[key](k[key] ?? 0)
          return (
            <div key={key} className="px-3 py-2.5">
              <div className="micro">{KPI_LABEL[key]}</div>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <motion.span
                  key={val}
                  initial={{ opacity: 0.4 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-[15px] font-semibold tabular-nums text-ink-2"
                >
                  {val}
                </motion.span>
                <Trend hist={snap.kpiHist?.[key] || []} higherIsWorse={HIGHER_IS_WORSE[key]} />
              </div>
            </div>
          )
        })}
      </div>
      <span className="sr-only">Telemetry tick {tick}</span>
    </section>
  )
}

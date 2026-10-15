// The top KPI strip of the continuous surface: the four steered metrics
// (throughput, p95, queue, VRAM) as wide hairline cells with sparklines,
// then the remaining six as a dense micro row. No cards. One strip,
// separated by hairlines, on the shared surface. Textual values update at
// feed rate only (<= 1 Hz); the scene state rails sweep via CSS --flow.

import { useId } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { KPI_KEYS, KPI_LABEL, KPI_PRIMARY, KPI_FMT, clamp01 } from '../lib/format'
import { useScene } from '../scene/SceneRoot'
import useAnchor from '../scene/useAnchor'

const WINDOW = 60 // points shown in a sparkline

/** Micro-sparkline: area fill plus a glowing tip at the newest sample. */
function Sparkline({ data, color, height = 22 }) {
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

/** Progress ring for the VRAM cell: used of total. */
function Ring({ pct, value }) {
  const r = 26
  const circ = 2 * Math.PI * r
  const filled = clamp01(pct) * circ
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <svg viewBox="0 0 64 64" className="h-[46px] w-[46px] shrink-0 -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgb(var(--acc) / 0.12)" strokeWidth="4.5" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="rgb(var(--dat))"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray={`${filled.toFixed(2)} ${circ.toFixed(2)}`}
          style={{ transition: 'stroke-dasharray 420ms cubic-bezier(.22,1,.36,1)' }}
        />
      </svg>
      <div className="min-w-0">
        <div className="text-xl font-bold tabular-nums text-ink-1">{value}</div>
        <div className="micro mt-0.5">vram used</div>
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
  const tone = flat ? 'text-ink-3' : bad ? 'text-alm' : 'text-dat'
  return (
    <span className={`inline-flex items-center gap-0.5 text-2xs ${tone}`} title={`Δ ${delta.toFixed(1)} over 30 ticks`}>
      <Icon size={11} aria-hidden="true" />
      {flat ? 'flat' : Math.abs(delta).toFixed(delta >= 100 || delta <= -100 ? 0 : 1)}
    </span>
  )
}

const HIGHER_IS_WORSE = { p95: true, ttft: true, tpot: true, queue: true, reingest: true, vram: true }

const PRIMARY = [
  { key: 'tps', tone: 'text-acc', color: 'rgb(var(--acc))' },
  { key: 'p95', tone: 'text-col', color: 'rgb(var(--col))' },
  { key: 'queue', tone: 'text-dat', color: 'rgb(var(--dat))' },
  { key: 'vram', tone: 'text-acc', ring: true },
]

export default function KpiStrip() {
  const { snap, mode } = useScene()
  const queueRef = useAnchor('queue')
  const k = snap.kpi || {}
  const gpu = snap.gpu || {}
  const vramTotal = gpu.vramTotal || 24
  const secondary = KPI_KEYS.filter((key) => !KPI_PRIMARY[key])
  const ghost = mode === 'boot' || mode === 'offline'

  return (
    <section aria-label="Key metrics" className="flow-rail">
      <div className="strip grid grid-cols-2 lg:grid-cols-4">
        {PRIMARY.map((m) => {
          const hist = snap.kpiHist?.[m.key] || []
          const val = KPI_FMT[m.key](k[m.key] ?? 0)
          return (
            <div key={m.key} className={`relative px-3 py-2 ${m.key === 'queue' ? '' : ''}`}>
              {m.key === 'queue' ? <span ref={queueRef} className="absolute inset-0" aria-hidden="true" /> : null}
              <div className="flex items-start justify-between gap-2">
                <span className="micro">{KPI_LABEL[m.key]}</span>
                <Trend hist={hist} higherIsWorse={HIGHER_IS_WORSE[m.key]} />
              </div>
              {m.ring ? (
                <div className="mt-2">
                  <Ring pct={(k.vram ?? 0) / vramTotal} value={val} />
                </div>
              ) : (
                <>
                  <div className="mt-1">
                    <span className={`inline-block text-2xl font-bold leading-none tabular-nums text-ink-1 ${m.tone} [color-mix]`}>
                      {val}
                    </span>
                  </div>
                  <div className="mt-2">
                    <Sparkline data={hist} color={m.color} />
                  </div>
                </>
              )}
              {ghost ? <span className="micro absolute right-2 top-2 text-ink-3">no data</span> : null}
            </div>
          )
        })}
      </div>
      <div className="strip grid grid-cols-3 sm:grid-cols-6">
        {secondary.map((key) => {
          const val = KPI_FMT[key](k[key] ?? 0)
          return (
            <div key={key} className="px-3 py-1.5">
              <div className="micro">{KPI_LABEL[key]}</div>
              <div className="mt-0.5 flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold tabular-nums text-ink-2">{val}</span>
                <Trend hist={snap.kpiHist?.[key] || []} higherIsWorse={HIGHER_IS_WORSE[key]} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

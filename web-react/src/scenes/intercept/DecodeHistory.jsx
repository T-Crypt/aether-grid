// DecodeHistory: four decode-rate sparklines — the first three engines'
// tok/s histories (engHist) plus the host cpu history as the fourth row,
// labelled HOST. Each row normalises against its own peak so a quiet feed
// still reads. Rows whose source is absent draw a flat mid-line with a
// dash; the whole panel ghosts when there are no engines and no host
// series.

import { useScene } from '../../scene/SceneRoot'
import { Frame } from './frame.jsx'

const WIN = 32

function sparkPoints(series) {
  if (!series || series.length < 2) return null
  const pts = series.slice(-WIN)
  let peak = 0
  for (const v of pts) if (v > peak) peak = v
  if (peak <= 0) peak = 1
  const n = pts.length
  return pts.map((v, i) => `${((i / (n - 1)) * 100).toFixed(2)},${(10 - (Math.min(peak, v) / peak) * 10).toFixed(2)}`).join(' ')
}

function Row({ label, series, value }) {
  const pts = sparkPoints(series)
  const flat = !pts
  return (
    <div className="flex items-center gap-1 px-1.5 py-px">
      <span className="w-[26px] shrink-0 text-[6.5px] tracking-[0.06em] text-ink-3">{label}</span>
      <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="h-[9px] min-w-0 flex-1">
        <polyline
          fill="none"
          stroke="rgb(var(--dat))"
          strokeOpacity="0.85"
          strokeWidth="0.7"
          points={pts || '0,5 100,5'}
        />
      </svg>
      <span className={`w-[26px] shrink-0 text-right text-[7px] tabular-nums ${flat ? 'text-ink-3' : 'text-dat'}`}>
        {value}
      </span>
    </div>
  )
}

export default function DecodeHistory({ engines }) {
  const { snap } = useScene()
  const top3 = (engines || []).slice(0, 3)
  const host = (snap && snap.hostHist && snap.hostHist.cpu) || []
  const hasSource = top3.length > 0 || host.length > 0
  const empty = !hasSource

  const seriesOf = (e) => {
    const h = (snap && snap.engHist && snap.engHist[e.key]) || e.hist || []
    return h.length ? h : null
  }
  const valueOf = (e, h) => {
    if (h && h.length) {
      const v = h[h.length - 1]
      return v != null && isFinite(v) ? Math.round(v) : null
    }
    const r = e.rates && e.rates.decode_tps
    return r != null && isFinite(r) ? Math.round(r) : null
  }

  return (
    <Frame title="DECODE HISTORY" ghosted={empty} empty={empty} note="no source" className="flex-[10] min-h-0">
      <div className="flex h-full flex-col justify-start overflow-hidden">
        {top3.map((e, i) => {
          const h = seriesOf(e)
          return <Row key={e.key || i} label={`E${i + 1}`} series={h} value={valueOf(e, h)} />
        })}
        {top3.length < 3 && <Row key="e-dim" label="E—" series={null} value="—" />}
        <Row label="HOST" series={host.length ? host : null} value={host.length ? Math.round(host[host.length - 1]) : null} />
      </div>
    </Frame>
  )
}

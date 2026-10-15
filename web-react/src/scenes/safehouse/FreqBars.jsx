// FreqBars: the FREQUENCY ANALYSIS block — ten bars, one per KPI key
// (tps, rpm, p95, vram, ttft, tpot, cache, reingest, mtp, queue)
// normalised against a sane per-key ceiling, per the P0 card. Heights
// ease between feed ticks with a CSS transition. The panel ghosts when no
// KPI values are present.

import { KPI_KEYS } from '../../lib/format'
import { clamp01 } from '../../lib/format'
import { useScene } from '../../scene/SceneRoot'
import { Frame } from './frame.jsx'

const CEILING = {
  tps: 300,
  rpm: 400,
  p95: 2000,
  vram: 24,
  ttft: 2000,
  tpot: 100,
  cache: 100,
  reingest: 100,
  mtp: 100,
  queue: 16,
}
const LABEL = { tps: 'TPS', rpm: 'RPM', p95: 'P95', vram: 'VRAM', ttft: 'TTFT', tpot: 'TPOT', cache: 'CACH', reingest: 'REIN', mtp: 'MTP', queue: 'QUEUE' }

export default function FreqBars() {
  const { snap } = useScene()
  const k = (snap && snap.kpi) || {}
  const bars = KPI_KEYS.map((key) => {
    const v = k[key]
    const level = v != null && isFinite(v) ? clamp01(Math.max(0, v) / (CEILING[key] || 100)) : null
    return { key, level }
  })
  const empty = bars.every((b) => b.level == null)

  return (
    <Frame title="FREQUENCY ANALYSIS" tag="8 BAND" empty={empty} note="no source" className="h-[46px] shrink-0" bodyClass="px-1.5 pt-0.5">
      <div className="flex h-full items-end gap-0.5">
        {bars.map((b) => (
          <div key={b.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-px">
            <div
              className="w-full bg-gradient-to-t from-acc to-dat shadow-[0_0_3px_rgb(var(--acc)_/_0.35)] transition-[height] duration-300 ease-out"
              style={{ height: b.level == null ? '2%' : `${Math.max(4, Math.round(b.level * 100))}%` }}
            />
            <span className="text-[5.5px] tracking-[0.04em] text-ink-3">{LABEL[b.key]}</span>
          </div>
        ))}
      </div>
    </Frame>
  )
}

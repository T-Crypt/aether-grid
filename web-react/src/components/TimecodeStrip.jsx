import { clockCode, fmtKpi, tempState } from '../lib/format'
import { useScene } from '../scene/SceneRoot'

const TONE = { acc: 'text-acc', dat: 'text-dat', col: 'text-col', alm: 'text-alm', dim: 'text-ink-3' }

export default function TimecodeStrip() {
  const { snap } = useScene()
  const k = snap.kpi || {}
  const gpu = snap.gpu || {}
  const tp = gpu.temp
  const tpState = tempState(tp)
  const engines = snap.engines || []
  const mtp = snap.reasoning?.mtp_accept_pct

  const cells = [
    { k: 'TC', v: clockCode(), tone: 'acc' },
    { k: 'TPS', v: fmtKpi('tps', k.tps) ?? '—', tone: 'acc' },
    { k: 'QUE', v: fmtKpi('queue', k.queue) ?? '—', tone: 'dat' },
    { k: 'TMP', v: tp != null && isFinite(tp) ? `${Math.round(tp)}C` : '—', tone: tpState === 'alert' ? 'alm' : tpState === 'warn' ? 'dat' : 'acc' },
    { k: 'VRAM', v: fmtKpi('vram', k.vram) ?? '—', tone: tpState === 'alert' ? 'alm' : 'col' },
    { k: 'MTP', v: mtp != null ? `${mtp.toFixed(1)}%` : '—', tone: 'acc' },
    { k: 'ENG', v: `${engines.filter((e) => e.up).length}/${engines.length}`, tone: 'dat' },
    { k: 'FEED', v: snap.feed, tone: 'dim' },
  ]

  return (
    <div
      aria-label="Timecode strip"
      className="grid grid-cols-4 gap-x-3 lg:grid-cols-8"
    >
      {cells.map((c) => (
        // stacked label/value below lg so TC and VRAM fit 390 px columns
        // untruncated; the baseline row (and its truncate) is desktop-only
        <div
          key={c.k}
          className="flex flex-col items-start gap-0.5 px-1 pb-1 text-2xs lg:flex-row lg:items-baseline lg:justify-between lg:gap-2"
        >
          <span className={`shrink-0 ${TONE[c.tone]}`}>{c.k}</span>
          <span className="tabular-nums text-[12px] font-semibold text-ink-1 lg:min-w-0 lg:truncate">{c.v}</span>
        </div>
      ))}
    </div>
  )
}

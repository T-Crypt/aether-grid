import { clockCode, fmtKpi, tempState } from '../lib/format'

const TONE = { acc: 'text-acc', dat: 'text-dat', col: 'text-col', dim: 'text-ink-3' }

/**
 * The thin telemetry strip under the header: clock, throughput, queue, temp,
 * vram, mtp accept, engine count, feed. Same eight cells as the static UI's
 * #timecode, redrawn as a bounded row of readouts.
 */
export default function TimecodeStrip({ snap }) {
  const k = snap.kpi || {}
  const gpu = snap.gpu || {}
  const tp = gpu.temp
  const tStamp = tempState(tp)
  const engines = snap.engines || []
  const mtp = snap.reasoning?.mtp_accept_pct

  const cells = [
    { k: 'TC', v: clockCode(), tone: 'acc' },
    { k: 'TPS', v: fmtKpi('tps', k.tps) ?? '—', tone: 'acc' },
    { k: 'QUE', v: fmtKpi('queue', k.queue) ?? '—', tone: 'dat' },
    { k: 'TMP', v: tp != null && isFinite(tp) ? `${Math.round(tp)}C` : '—', tone: tStamp === 'alert' ? 'col' : tStamp === 'warn' ? 'dat' : 'acc' },
    { k: 'VRAM', v: fmtKpi('vram', k.vram) ?? '—', tone: 'col' },
    { k: 'MTP', v: mtp != null ? `${mtp.toFixed(1)}%` : '—', tone: 'acc' },
    { k: 'ENG', v: `${engines.filter((e) => e.up).length}/${engines.length}`, tone: 'dat' },
    { k: 'FEED', v: snap.feed, tone: 'dim' },
  ]

  return (
    <div
      aria-label="Timecode strip"
      className="mb-4 grid grid-cols-4 gap-x-3 gap-y-1 sm:grid-cols-4 lg:grid-cols-8"
    >
      {cells.map((c) => (
        <div
          key={c.k}
          className="flex items-baseline justify-between gap-2 border-b border-acc/15 pb-1 text-2xs"
        >
          <span className={`shrink-0 ${TONE[c.tone]}`}>{c.k}</span>
          <span className="truncate tabular-nums text-[12px] font-semibold text-ink-1">{c.v}</span>
        </div>
      ))}
    </div>
  )
}

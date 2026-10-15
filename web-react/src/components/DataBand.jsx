import { KPI_KEYS, KPI_FMT } from '../lib/format'

const TONE = ['text-acc', 'text-acc', 'text-dat', 'text-col']

/**
 * Full-width data band: every KPI plus four auxiliary counters, as one dense
 * scannable row. Mirrors #databand in the static UI.
 */
export default function DataBand({ snap }) {
  const k = snap.kpi || {}
  const aux = [
    { k: 'UP', v: `${Math.floor((snap.host?.uptime || 0) / 3600)}H` },
    { k: 'CPU', v: snap.host?.cpu != null ? `${Math.round(snap.host.cpu)}%` : '—' },
    { k: 'RAM', v: snap.host?.ramUsed != null ? `${snap.host.ramUsed.toFixed(1)}G` : '—' },
    { k: 'FMT', v: snap.reasoning?.t != null ? String(snap.reasoning.t) : '—' },
  ]

  const cells = [
    ...KPI_KEYS.map((key, i) => ({ k: key.toUpperCase(), v: KPI_FMT[key](k[key] ?? 0), tone: TONE[i % 4] })),
    ...aux.map((a, i) => ({ ...a, tone: TONE[i % 4] })),
  ]

  return (
    <div
      aria-label="Data band"
      className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4 lg:grid-cols-7 xl:grid-cols-14"
    >
      {cells.map((c) => (
        <div key={c.k} className="flex items-baseline justify-between gap-2 border-l-2 border-acc/25 bg-acc/[0.04] px-2 py-1 text-2xs">
          <span className={`shrink-0 ${c.tone}`}>{c.k}</span>
          <span className="truncate tabular-nums text-[11px] font-semibold text-ink-1">{c.v}</span>
        </div>
      ))}
    </div>
  )
}

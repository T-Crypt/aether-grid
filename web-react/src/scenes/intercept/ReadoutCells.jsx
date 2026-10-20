// ReadoutCells: the two big amber readouts under the traces. Cell 1 is the
// desk's live decode figure; cell 2 is the reasoning total with the MTP
// acceptance rate. Both bind to snapshot keys; the sample counters under
// them ride the feed tick (feed rate, no scene timer).

import { useScene } from '../../scene/SceneRoot'
import { hexFrom, pad } from './frame.jsx'
import { decodeOf } from './shared'

export default function ReadoutCells({ ghosted }) {
  const { snap, tick } = useScene()
  const decode = decodeOf(snap)
  const r = (snap && snap.reasoning) || {}
  const k = (snap && snap.kpi) || {}
  const feed = snap ? snap.mode || 'live' : 'boot'
  const hist = (snap && snap.kpiHist && snap.kpiHist.tps) || []
  let peak = 0
  for (const v of hist) if (v != null && isFinite(v) && v > peak) peak = v

  const cells = [
    {
      src: `DECODE · ${hexFrom(feed, 2)}`,
      label: 'READOUT 01',
      sub: 'DECODE TOK/S',
      value: !ghosted && decode > 0 ? String(Math.round(decode)) : '—',
      meta: `PEAK ${peak > 0 ? Math.round(peak) : '—'} T/S`,
      frame: `TICK ${pad(Math.max(0, Math.floor(tick)), 5)}`,
    },
    {
      src: `THINK · ${hexFrom(String(feed).slice(1) || 'ic', 2)}`,
      label: 'READOUT 02',
      sub: 'THINK TOKENS',
      value: !ghosted && r.thinking_tokens != null ? r.thinking_tokens.toLocaleString('en-US') : '—',
      meta: `MTP ${r.mtp_accept_pct != null ? `${Math.round(r.mtp_accept_pct)}%` : k.mtp != null ? `${Math.round(k.mtp)}%` : '—'}`,
      frame: `TICK ${pad(Math.max(0, Math.floor(tick)), 5)}`,
    },
  ]
  return (
    <div className="grid min-w-0 flex-1 grid-cols-2 gap-1" aria-label="Intercept readouts">
      {cells.map((c, i) => (
        <div key={i} className="flex min-w-0 flex-col justify-between border border-acc/25 bg-bgg/50 px-1.5 py-1">
          <div className="flex justify-between text-[6.5px] uppercase tracking-[0.12em]">
            <span className="text-ink-3">SOURCE</span>
            <span className="tabular-nums text-ink-2">{c.src.toUpperCase()}</span>
          </div>
          <div className="flex justify-between text-[6.5px] uppercase tracking-[0.12em]">
            <span className="text-ink-3">UNIT</span>
            <span className="tabular-nums text-ink-2">{c.sub}</span>
          </div>
          <div className="mt-0.5 text-[8px] tracking-[0.18em] text-acc">{c.label}</div>
          <div
            className="ic-vt text-[20px] font-semibold leading-none tabular-nums text-dat [text-shadow:0_0_10px_rgb(var(--dat)_/_0.45)] sm:text-[26px]"
          >
            {c.value}
          </div>
          <div className="mt-0.5 flex justify-between text-[6.5px] tracking-[0.1em]">
            <span className="text-ink-3">{c.meta}</span>
            <span className="tabular-nums text-acc">{c.frame}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

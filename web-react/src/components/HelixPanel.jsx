import { Waves } from 'lucide-react'
import Panel from './Panel'
import { useCanvas } from '../hooks/useCanvas'
import { paintHelix } from '../lib/paint'
import { fmtBig } from '../lib/format'

/** Helix reasoning: the double strand, amplitude driven by live load. */
export default function HelixPanel({ snap, pal, animated, revision, stagger }) {
  const hist = snap.kpiHist?.tps || []
  const maxTps = Math.max(1, ...hist.slice(-60))
  const energy = Math.min(1, (snap.kpi?.tps || 0) / Math.max(maxTps, snap.kpi?.tps || 1))
  const accept = snap.reasoning?.mtp_accept_pct
  const think = snap.reasoning?.thinking_tokens

  const ref = useCanvas((ctx, w, h, t) => paintHelix(ctx, w, h, t, pal.acc, pal.col, energy), {
    animated,
    revision,
  })

  return (
    <Panel
      title="SHE_10N / DEV"
      eyebrow="helix reasoning"
      icon={Waves}
      accent="col"
      right={accept != null ? `ACC ${accept.toFixed(1)}%` : 'ACC —'}
      stagger={stagger}
    >
      <canvas ref={ref} className="well h-[clamp(150px,26vh,240px)]" aria-label="Reasoning helix" />
      <div className="mt-2 flex items-center justify-between text-2xs text-ink-3">
        <span>
          ACC <span className="text-dat">{accept != null ? `${accept.toFixed(1)}%` : '—'}</span>
        </span>
        <span className="tabular-nums">THINK {think != null ? fmtBig(think) : '—'}</span>
      </div>
    </Panel>
  )
}

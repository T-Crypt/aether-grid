import { Activity } from 'lucide-react'
import Panel from './Panel'
import { useCanvas } from '../hooks/useCanvas'
import { paintTerrain } from '../lib/paint'

/** Brainwave terrain: the throughput series drawn as a wireframe mesh. */
export default function TerrainPanel({ snap, pal, animated, revision, stagger }) {
  const hist = snap.kpiHist?.tps || []
  const ref = useCanvas((ctx, w, h, t) => paintTerrain(ctx, w, h, t, hist, pal.acc, pal.dat), {
    animated,
    revision,
  })

  const win = hist.slice(-120)
  const peak = win.length ? Math.round(Math.max(...win)) : 0
  const mean = win.length ? Math.round(win.reduce((a, b) => a + b, 0) / win.length) : 0

  return (
    <Panel
      title="4_CKS / CTX"
      eyebrow="brainwave terrain"
      icon={Activity}
      right={`PEAK ${peak}`}
      stagger={stagger}
    >
      <canvas ref={ref} className="well h-[clamp(150px,26vh,240px)]" aria-label="Throughput terrain" />
      <div className="mt-2 flex items-center justify-between text-2xs text-ink-3">
        <span>
          88 FS CC · <span className="text-acc">TERRAIN</span>
        </span>
        <span className="tabular-nums">μ {mean} TOK/S</span>
      </div>
    </Panel>
  )
}

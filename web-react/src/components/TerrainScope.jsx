// 4_CKS / CTX. The brainwave terrain scope. The throughput series as a
// receding wireframe mesh, painted on the shared clock.

import { Activity } from 'lucide-react'
import Scope from '../scene/Scope'
import SceneCanvas from '../scene/Canvas'
import { paintTerrain } from '../scene/paint'
import { useScene } from '../scene/SceneRoot'

export default function TerrainScope() {
  const { snap, mode } = useScene()
  const hist = snap.kpiHist?.tps || []
  const ghost = mode === 'boot' || mode === 'offline' || hist.length < 2

  const win = hist.slice(-120)
  const peak = win.length ? Math.round(Math.max(...win)) : 0
  const mean = win.length ? Math.round(win.reduce((a, b) => a + b, 0) / win.length) : 0

  return (
    <Scope
      id="sc-terrain"
      title="4_CKS / CTX"
      eyebrow="brainwave terrain"
      right={ghost ? undefined : `PEAK ${peak}`}
      ghosted={ghost}
      ghostNote="no source"
      className="min-h-[180px] flex-1"
    >
      <div className="relative min-h-[120px] flex-1">
        <SceneCanvas draw={(ctx, w, h, c) => paintTerrain(ctx, w, h, c)} label="Throughput terrain" />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-2xs text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <Activity size={11} className="text-acc" aria-hidden="true" />
          88 FS CC · <span className="text-acc">TERRAIN</span>
        </span>
        <span className="tabular-nums">μ {mean} TOK/S</span>
      </div>
    </Scope>
  )
}

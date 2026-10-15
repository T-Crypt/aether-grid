import { Layers } from 'lucide-react'
import Panel from './Panel'
import { useCanvas } from '../hooks/useCanvas'
import { paintBackdrop, paintCables, paintScatter, paintScope } from '../lib/paint'

function LayerCanvas({ paint, pal, animated, revision, active, label }) {
  const ref = useCanvas((ctx, w, h, t) => paint(ctx, w, h, t), { animated, revision })
  return (
    <div className={`transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-30'}`}>
      <div className="mb-1.5 text-2xs text-ink-3">
        {label}
      </div>
      <canvas ref={ref} className="well h-[clamp(92px,12vh,132px)]" aria-label={label} />
    </div>
  )
}

function Switch({ id, label, on, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onToggle(id)}
      className={`inline-flex min-h-[26px] items-center gap-2 rounded border px-2 py-1.5 text-2xs transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-acc ${
        on ? 'border-acc/60 bg-acc/[0.12] text-ink-1' : 'border-ink-3/30 bg-transparent text-ink-3 hover:text-ink-2'
      }`}
    >
      <span className={`relative h-3 w-6 rounded-full transition-colors ${on ? 'bg-acc/50' : 'bg-ink-3/25'}`}>
        <span
          className={`absolute top-0.5 h-2 w-2 rounded-full transition-all duration-200 ${
            on ? 'left-3.5 bg-acc' : 'left-0.5 bg-ink-3'
          }`}
        />
      </span>
      {label}
    </button>
  )
}

/** Deterministic scatter points from queue / vram / p95 excursions. */
function scatterPoints(snap) {
  const q = snap.kpiHist?.queue || []
  const v = snap.kpiHist?.vram || []
  const p = snap.kpiHist?.p95 || []
  const n = Math.max(1, Math.min(q.length, 48))
  return Array.from({ length: 12 }, (_, i) => {
    const idx = Math.floor((i / 11) * (n - 1))
    const qq = Math.min(1, (q[idx] ?? 0) / 14)
    const vv = (v[idx] ?? 0) / 24
    const pp = Math.min(1, (p[idx] ?? 0) / 900)
    return { x: i / 11, y: 1 - Math.max(vv, pp * 0.5), r: 2 + qq * 4.5, phase: i * 0.7, crit: qq > 0.65 }
  })
}

/**
 * Field layers: the four overlays (declination, scope-omega, loom-9,
 * safehouse) as live miniatures behind real switches. Turning one off dims its
 * miniature and stops its clock, so the toggle does something you can see.
 */
export default function FieldLayersPanel({ snap, pal, active, onToggle, animated, revision, stagger }) {
  const tps = snap.kpi?.tps || 0
  const maxTps = Math.max(1, ...(snap.kpiHist?.tps || [1]).slice(-60))
  const load = Math.min(1, tps / maxTps)

  const models = (snap.models || []).slice(0, 5)
  const cables = models.length
    ? models.map((_, i) => ({ load: Math.max(0.15, load * (1 - i * 0.16)) }))
    : [{ load }]
  const points = scatterPoints(snap)

  const layers = [
    {
      id: 'declination',
      label: 'DECLINATION · BACKDROP',
      paint: (ctx, w, h, t) => paintBackdrop(ctx, w, h, t, snap.kpiHist?.tps || [], pal.acc),
    },
    {
      id: 'scopeOmega',
      label: 'SCOPE-OMEGA · SCATTER',
      paint: (ctx, w, h, t) => paintScatter(ctx, w, h, t, points, pal.acc, pal.col),
    },
    {
      id: 'loom9',
      label: 'LOOM-9 · CABLES',
      paint: (ctx, w, h, t) => paintCables(ctx, w, h, t, cables, pal.acc, pal.dat),
    },
    {
      id: 'safehouse',
      label: 'SAFEHOUSE · SCOPE',
      paint: (ctx, w, h, t) => paintScope(ctx, w, h, t, pal.acc, load),
    },
  ]

  return (
    <Panel
      title="FIELD LAYERS"
      eyebrow="overlays"
      icon={Layers}
      right={`${Object.values(active).filter(Boolean).length}/4 on`}
      stagger={stagger}
      bodyClassName="gap-3"
    >
      <div className="flex flex-wrap gap-1.5">
        {layers.map((l) => (
          <Switch key={l.id} id={l.id} label={l.id === 'scopeOmega' ? 'scope-omega' : l.id === 'loom9' ? 'loom-9' : l.id} on={active[l.id]} onToggle={onToggle} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {layers.map((l) => (
          <LayerCanvas
            key={l.id}
            paint={l.paint}
            pal={pal}
            active={active[l.id]}
            animated={animated && active[l.id]}
            revision={revision}
            label={l.label}
          />
        ))}
      </div>
    </Panel>
  )
}

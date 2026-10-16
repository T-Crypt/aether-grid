// The three full-bleed field layers, out of the boxed "Field Layers" row and
// onto the scene itself:
//
//   DECLINATION  full-screen backdrop behind everything (z 1)
//   LOOM-9       router cables crossing panel boundaries (z 2)
//   SCOPE-OMEGA  anomaly scatter over the whole frame (z 3)
//
// The switch cluster (bottom-left, on the chrome band, always reachable)
// still controls them. The fourth layer, SAFEHOUSE, reports through the
// reasoning dial beside those switches (the same radar, sized to the band),
// so it reads without a panel floating over the log and the data band.

import { Layers } from 'lucide-react'
import SceneCanvas from '../scene/Canvas'
import { paintBackdrop, paintCables, paintScatter, paintScope } from '../scene/paint'
import { useScene } from '../scene/SceneRoot'

function Switch({ id, label, on, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={label}
      onClick={() => onToggle(id)}
      className={`inline-flex min-h-[26px] items-center gap-2 border px-2 py-1 text-2xs transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-acc ${
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
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

// The reasoning dial: the SAFEHOUSE layer's read, in the chrome band. It is
// the radar that layer used to draw in a panel pinned over the log
// (paintScope: sweep angle, per-slot blips, pressure ring), sized to the band
// with the load figure beside it. The switch next to it gates the painter, so
// an off layer paints nothing and the dial dims.
function ReasoningDial({ on, tps }) {
  const load = Math.round((tps || 0) / 2.8)
  return (
    <span className={`ml-1 flex items-center gap-2 border-l pl-2 transition-opacity duration-300 ${on ? 'border-acc/25 opacity-100' : 'border-acc/10 opacity-40'}`}>
      <span className="relative block h-[32px] w-[32px]">
        <SceneCanvas draw={(ctx, w, h, c) => paintScope(ctx, w, h, c)} label="Safehouse reasoning dial" className="h-full w-full" />
      </span>
      <span className="micro hidden tabular-nums text-ink-3 xl:inline-flex xl:flex-col">
        <span>
          load <span className="text-acc">{on ? `${load}%` : 'held'}</span>
        </span>
        <span className="mt-0.5">
          sweep <span className="text-col">1.0x</span>
        </span>
      </span>
    </span>
  )
}

export default function LayerStack() {
  const { layers, setLayer, snap } = useScene()

  return (
    <>
      {/* Full-bleed ambient canvases, behind the scene, above the texture. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[1]">
        <div className={`absolute inset-0 transition-opacity duration-300 ${layers.declination ? 'opacity-100' : 'opacity-0'}`}>
          <SceneCanvas draw={(ctx, w, h, c) => paintBackdrop(ctx, w, h, c)} viewport res={0.5} />
        </div>
      </div>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[2]">
        <div className={`absolute inset-0 transition-opacity duration-300 ${layers.loom9 ? 'opacity-100' : 'opacity-0'}`}>
          <SceneCanvas draw={(ctx, w, h, c) => paintCables(ctx, w, h, c)} viewport />
        </div>
      </div>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[3]">
        <div className={`absolute inset-0 transition-opacity duration-300 ${layers.scopeOmega ? 'opacity-100' : 'opacity-0'}`}>
          <SceneCanvas draw={(ctx, w, h, c) => paintScatter(ctx, w, h, c)} viewport />
        </div>
      </div>

      {/* Switch cluster and the reasoning dial: the four layer toggles plus
          the state the SAFEHOUSE layer shows. They live on the chrome band
          with the scene dock, so the scope reads without a panel floating
          over the log and the data band. */}
      <div className="fixed bottom-3 left-3 z-30 max-w-[calc(100vw-24px)] lg:left-5">
        <div className="scope flex flex-wrap items-center gap-1.5 px-2.5 py-1.5">
          <span className="micro mr-1 inline-flex items-center gap-1.5 text-ink-3">
            <Layers size={11} aria-hidden="true" />
            <span className="hidden sm:inline">field layers</span>
          </span>
          <Switch id="declination" label="declination" on={layers.declination} onToggle={setLayer} />
          <Switch id="scopeOmega" label="scope-omega" on={layers.scopeOmega} onToggle={setLayer} />
          <Switch id="loom9" label="loom-9" on={layers.loom9} onToggle={setLayer} />
          <Switch id="safehouse" label="safehouse" on={layers.safehouse} onToggle={setLayer} />
          <span className="micro hidden tabular-nums text-ink-3 sm:inline">
            {Object.values(layers).filter(Boolean).length}/4 on
          </span>
          <ReasoningDial on={layers.safehouse} tps={snap && snap.kpi ? snap.kpi.tps : null} />
        </div>
      </div>
    </>
  )
}

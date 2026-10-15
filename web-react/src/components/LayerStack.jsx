// The four field layers, out of the boxed "Field Layers" row and onto the
// scene itself:
//
//   DECLINATION  full-screen backdrop behind everything (z 1)
//   LOOM-9       router cables crossing panel boundaries (z 2)
//   SCOPE-OMEGA  anomaly scatter over the whole frame (z 3)
//   SAFEHOUSE    pinned corner overlay, its own hairline scope (z 30)
//
// The switch cluster (bottom-left, small, always reachable) still controls
// all four; turning one off hides its canvas and stops its paint.

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
      {label}
    </button>
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

      {/* SAFEHOUSE: pinned corner scope, always on unless toggled off.
          bottom-[56px] clears the app-level scene dock (bottom-3, ~30px). */}
      <div
        aria-hidden={layers.safehouse ? undefined : 'true'}
        className={`fixed bottom-[56px] right-3 z-30 w-[118px] transition-opacity duration-300 sm:w-[clamp(150px,13vw,210px)] lg:right-5 ${
          layers.safehouse ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="scope relative pb-2">
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
            <i className="scope-tick left-0 top-0 border-l border-t" />
            <i className="scope-tick right-0 top-0 border-r border-t" />
            <i className="scope-tick bottom-0 left-0 border-b border-l" />
            <i className="scope-tick bottom-0 right-0 border-b border-r" />
          </span>
          <div className="flex items-center justify-between px-3 pt-2">
            <span className="micro">reasoning scope</span>
            <h2 className="label-eyebrow text-col">SAFEHOUSE</h2>
          </div>
          <div className="relative mx-3 mt-1" style={{ aspectRatio: '1' }}>
            <SceneCanvas draw={(ctx, w, h, c) => paintScope(ctx, w, h, c)} label="Safehouse reasoning scope" />
          </div>
          <div className="mt-1.5 px-3 text-2xs text-ink-3">
            <span className="tabular-nums">
              LOAD <span className="text-acc">{Math.round((snap.kpi?.tps || 0) / 2.8)}%</span>
            </span>
            <span className="ml-2 tabular-nums">
              SWEEP <span className="text-col">1.0x</span>
            </span>
          </div>
        </div>
      </div>

      {/* Switch cluster: the four layer toggles, small and pinned. */}
      <div className="fixed bottom-10 left-3 z-30 max-w-[46vw] lg:left-5">
        <div className="scope flex flex-wrap items-center gap-1.5 px-2.5 py-1.5">
          <span className="micro mr-1 inline-flex items-center gap-1.5 text-ink-3">
            <Layers size={11} aria-hidden="true" />
            field layers
          </span>
          <Switch id="declination" label="declination" on={layers.declination} onToggle={setLayer} />
          <Switch id="scopeOmega" label="scope-omega" on={layers.scopeOmega} onToggle={setLayer} />
          <Switch id="loom9" label="loom-9" on={layers.loom9} onToggle={setLayer} />
          <Switch id="safehouse" label="safehouse" on={layers.safehouse} onToggle={setLayer} />
          <span className="micro tabular-nums text-ink-3">{Object.values(layers).filter(Boolean).length}/4 on</span>
        </div>
      </div>
    </>
  )
}

// The bulb rail: one wire of fourteen bare bulbs on GEN-1. The canvas
// paints wire, sockets, bulbs and dead sockets (the down engines); the DOM
// supplies the two end labels. The wall wash this rail casts is the
// .cy-light overlay in Scene.jsx. Hidden below 768 px (the reference's
// portrait strategy drops it first).

import { useScene } from '../../scene/SceneRoot'
import SceneCanvas from '../../scene/Canvas'
import { paintBulbRail } from './painters'
import { genStats } from './shared'

export default function BulbRail() {
  const { snap } = useScene()
  const g = genStats(snap, snap && snap.gpu, snap && snap.host)

  return (
    <div
      aria-label="Bulb rail"
      className="relative hidden h-[34px] shrink-0 bg-black/30 min-[769px]:block"
    >
      <SceneCanvas
        draw={(ctx, w, h, c) => paintBulbRail(ctx, w, h, c)}
        className="absolute inset-0 h-full w-full"
      />
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[8px] tracking-[0.12em] text-ink-3">
        CIRCUIT A · 14 × 60 W · GEN-1
      </span>
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[8px] tracking-[0.12em] text-ink-3 tabular-nums">
        {g.lit}/14 LIT · {g.volt} V · GEN-1 {g.pct}%
      </span>
    </div>
  )
}

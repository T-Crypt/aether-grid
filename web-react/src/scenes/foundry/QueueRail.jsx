// The queue rail: one bus bar of fourteen request-slot lamps. The canvas
// paints bus, sockets, lamps and empty slots; the DOM supplies the two end
// labels. Lit count is the queue depth; the newest slot flares when a
// request arrives. The wall wash this rail casts is the .fd-light overlay
// in Scene.jsx. Hidden below 768 px (the scene's portrait strategy drops it
// first).

import { useScene } from '../../scene/SceneRoot'
import SceneCanvas from '../../scene/Canvas'
import { paintQueueLamps } from './painters'
import { queueRail } from './shared'

export default function QueueRail() {
  const { snap } = useScene()
  const rail = queueRail(snap)
  const offline = !snap || snap.mode === 'offline'

  return (
    <div
      aria-label="Queue lamp rail"
      className="relative hidden h-[34px] shrink-0 bg-black/30 min-[769px]:block"
    >
      <SceneCanvas
        draw={(ctx, w, h, c) => paintQueueLamps(ctx, w, h, c)}
        className="absolute inset-0 h-full w-full"
      />
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[8px] tracking-[0.12em] text-ink-3">
        QUEUE LANE · 14 SLOTS
      </span>
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[8px] tracking-[0.12em] text-ink-3 tabular-nums">
        {offline ? 'NO SOURCE' : `${rail.lit}/14 OCCUPIED · ${rail.down ? 'ENGINE DOWN · ' : ''}Q ${rail.q != null ? rail.q : '—'}`}
      </span>
    </div>
  )
}

// SlotStrip: the 47-tick strip along the stage top. One tick per sampled
// slot position; base ticks take the accent (slot nominal), heavy ticks the
// data amber, ticks past the 85% evict line the alarm red, and the hottest
// tick pulses while an alert is live. Cheap DOM (47 divs, no canvas, no
// timers); cells come from stripCells (shared.js).

import { useScene } from '../../scene/SceneRoot'
import { stripCells, staleOf } from './shared'

export default function SlotStrip() {
  const { snap, conductor } = useScene()
  // Dormant strip: a stale feed stops the pulse and ghosts the cells (the
  // rails show "no source").
  const stale = staleOf(snap)
  const alert = stale ? 0 : Math.min(1, conductor.alert)
  const heat = stale ? 0 : Math.min(1, conductor.heat)

  const cells = stale ? null : stripCells(snap)
  const hottest = cells
    ? cells.reduce((best, c, i) => (c.cls === 'risk' && best === -1 ? i : best), -1)
    : -1

  const clsOf = (cls) => {
    if (!cells) return 'or-tick-dim'
    if (cls === 'risk') return 'or-tick-risk'
    if (cls === 'hot') return 'or-tick-hot'
    if (cls === 'dim') return 'or-tick-dim'
    return 'or-tick'
  }

  return (
    <div
      className="or-strip pointer-events-none absolute inset-x-0 top-0 z-[6] flex h-3 items-center gap-px px-2"
      aria-label="KV slot strip, 47 sampled positions"
    >
      {(cells || Array.from({ length: 47 }, (_, i) => ({ cls: 'dim', title: 'FEED HELD' }))).map((c, i) => {
        const live = cells && i === hottest && alert > 0.25
        return (
          <div
            key={i}
            title={c.title}
            className={`h-1.5 min-w-0 flex-1 ${clsOf(c.cls)} ${live ? 'or-tick-live' : ''}`}
            style={live ? { animationDuration: `${Math.max(0.45, 1.8 - heat * 1.2).toFixed(2)}s` } : undefined}
          />
        )
      })}
    </div>
  )
}

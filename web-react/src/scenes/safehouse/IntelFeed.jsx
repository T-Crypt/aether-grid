// IntelFeed: the last five feed events as a live intel stream (level +
// message), beside the seal in the right pane header row. Warn/err lines
// take the data amber; the panel ghosts when no events are buffered.

import { useScene } from '../../scene/SceneRoot'
import { Frame } from './frame.jsx'

function clock(e) {
  if (!e.t) return '--:--'
  const d = new Date(e.t * 1000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function IntelFeed() {
  const { snap } = useScene()
  const events = ((snap && snap.events) || []).slice(0, 5)
  const empty = events.length === 0

  return (
    <Frame title="INTEL FEED" tag={empty ? '—' : 'LIVE'} empty={empty} note="no source" className="h-full min-h-0">
      <div className="flex h-full flex-col justify-start overflow-hidden">
        {events.map((e, i) => {
          const hot = e.level === 'warn' || e.level === 'err' || e.level === 'alert'
          return (
            <div key={e.id ?? `${e.t}-${i}`} className="flex gap-1 px-1.5 py-px text-[7px] leading-[1.4] tracking-[0.04em]">
              <span className="shrink-0 tabular-nums text-ink-3">{clock(e)}</span>
              <span className={`min-w-0 flex-1 truncate ${hot ? 'text-dat' : 'text-ink-2'}`}>{String(e.msg || '').slice(0, 34)}</span>
            </div>
          )
        })}
      </div>
    </Frame>
  )
}

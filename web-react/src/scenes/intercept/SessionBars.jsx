// SessionBars: the SESSION THROUGHPUT block — one bar per session (top 14
// by decode share), the height the session's derived tok/s against the
// desk peak. Heights ease between feed ticks with a CSS transition. The
// panel ghosts when no session rate resolves.

import { useScene } from '../../scene/SceneRoot'
import { clamp01 } from '../../lib/format'
import { Frame } from './frame.jsx'
import { sessionRate, sessionState } from './shared'

const BARS = 14

export default function SessionBars() {
  const { snap } = useScene()
  const sessions = (((snap && snap.sessions) || []) || [])
    .map((s) => ({ id: s.id, rate: sessionRate(s, snap) || 0, st: sessionState(s) }))
    .filter((s) => s.rate > 0)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, BARS)
  const peak = sessions.reduce((a, s) => Math.max(a, s.rate), 0)
  const empty = sessions.length === 0

  return (
    <Frame title="SESSION THROUGHPUT" tag={`SESS ${sessions.length} OF ${(((snap && snap.sessions) || []) || []).length}`} empty={empty} note="no source" className="h-[46px] shrink-0" bodyClass="px-1.5 pt-0.5">
      <div className="flex h-full items-end gap-0.5">
        {sessions.map((s) => {
          const level = peak > 0 ? clamp01(s.rate / peak) : 0
          const hot = s.st === 'hot'
          return (
            <div key={s.id} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-px" aria-label={`session ${s.id} ${Math.round(s.rate)} tok/s`}>
              <div
                className={`w-full shadow-[0_0_3px_rgb(var(--acc)_/_0.35)] transition-[height] duration-300 ease-out ${
                  hot ? 'bg-alm' : 'bg-gradient-to-t from-acc to-dat'
                }`}
                style={{ height: `${Math.max(4, Math.round(level * 100))}%` }}
              />
              <span className="text-[5.5px] tracking-[0.04em] text-ink-3">{String(s.id || '—').slice(-4)}</span>
            </div>
          )
        })}
      </div>
    </Frame>
  )
}

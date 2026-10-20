// SessionRail: the 13-row session ladder beside the readout cells. Each
// row is one live session: id, context fill and a fill bar keyed to the KV
// well state (ok / watch / hot). Sorted hottest first, so the rows the
// desk cares about sit on top. Ghosts when no sessions are buffered.

import { useScene } from '../../scene/SceneRoot'
import { sessionFill, sessionState } from './shared'

const ROWS = 13

export default function SessionRail({ ghosted }) {
  const { snap } = useScene()
  const sessions = (((snap && snap.sessions) || []) || [])
    .slice()
    .sort((a, b) => (sessionFill(b) || 0) - (sessionFill(a) || 0))
    .slice(0, ROWS)
  const empty = sessions.length === 0

  return (
    <div className="flex min-w-0 flex-col gap-0.5" aria-label="Session rail">
      <div className="flex items-center justify-between border border-acc/25 bg-pan/40 px-1.5 py-px text-[6.5px] uppercase tracking-[0.12em] text-acc">
        <span>SESSION RAIL</span>
        <span className="text-ink-3">KV FILL</span>
      </div>
      {empty ? (
        <div className="flex flex-1 items-center justify-center border border-acc/25 text-[7px] uppercase tracking-[0.16em] text-ink-3">
          {ghosted ? 'NO SOURCE' : 'NO SESSIONS'}
        </div>
      ) : (
        sessions.map((s, i) => {
          const f = sessionFill(s)
          const st = sessionState(s)
          const pct = f != null ? Math.round(f * 100) : 0
          const tone = st === 'hot' ? 'bg-alm' : st === 'watch' ? 'bg-dat' : 'bg-acc'
          return (
            <div
              key={s.id ?? i}
              className="relative flex min-h-0 flex-1 items-center justify-between overflow-hidden border border-acc/25 px-1.5 text-[6.5px] uppercase tracking-[0.08em]"
              aria-label={`session ${s.id} fill ${pct}%`}
            >
              <span
                className="absolute inset-y-0 left-0 opacity-20"
                style={{ width: `${pct}%`, background: `rgb(var(--${st === 'hot' ? 'alm' : st === 'watch' ? 'dat' : 'acc'}))` }}
                aria-hidden="true"
              />
              <span className="relative tabular-nums text-ink-2">{String(s.id || '—').toUpperCase()}</span>
              <span className={`relative tabular-nums ${st === 'hot' ? 'text-alm' : st === 'watch' ? 'text-dat' : 'text-dat'}`}>
                {pct}%
              </span>
            </div>
          )
        })
      )}
    </div>
  )
}

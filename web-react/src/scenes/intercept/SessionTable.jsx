// SessionTable: the SESSION TERMINAL (the desk's 22-row master table).
// Rows bind to live sessions: context fill, KV well state and the engine's
// decode rate shared across sessions by fill (the TOK/S column sums back
// to the real engine decode figure). Rows sort hottest first; spare rows
// pad the table as dim blanks so the grid keeps its rhythm without
// inventing sessions. Row state: amber (watch) on KV fill past 0.6, red
// (hot) past 0.85 or on down engines, and a one-shot cyan flash re-keyed
// by the conductor's anomaly events (a finite CSS animation, no timer).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useScene } from '../../scene/SceneRoot'
import { Frame, hexFrom } from './frame.jsx'
import { sessionFill, sessionRate, sessionState, sessionEngine, upEngines } from './shared'

const ROWS = 22
const COLS = 'minmax(0,1.0fr) minmax(0,1.2fr) minmax(0,0.9fr) minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,0.9fr)'
const LABELS = ['SESSION', 'ENGINE', 'CTX TOK', 'KV %', 'TOK/S', 'STATE']

const STATE_LABEL = { ok: 'OK', watch: 'WATCH', hot: 'HOT', idle: 'IDLE' }

function Row({ row, flash, onDone }) {
  const state = row.state
  const cls =
    state === 'hot'
      ? 'text-alm'
      : state === 'watch'
        ? 'text-dat'
        : 'text-ink-2/85'
  return (
    <div
      className={`grid gap-2 whitespace-nowrap px-1 text-[6.5px] leading-[1.3] transition-colors duration-500 ${cls} ${
        flash ? 'ic-flash' : ''
      }`}
      style={{ gridTemplateColumns: COLS }}
      onAnimationEnd={flash ? onDone : undefined}
    >
      {row.cells.map((c, i) => (
        <span key={i} className={`truncate ${i === 0 ? '' : 'tabular-nums'}`}>
          {c}
        </span>
      ))}
    </div>
  )
}

export default function SessionTable({ ghosted = false, note }) {
  const { snap, conductor } = useScene()
  const [flash, setFlash] = useState(null) // { i, seq }
  // One-shot boundary: the class clears when the finite animation ends, so
  // a later anomaly on the same row replays by remounting on the new seq
  // key. A redelivered seq is a no-op (dedupe), never a restart. No timer.
  const lastSeq = useRef(null)
  useEffect(() => {
    return conductor.on('anomaly', (ev) => {
      if (ev.seq === lastSeq.current) return
      lastSeq.current = ev.seq
      setFlash({ i: ev.seq % ROWS, seq: ev.seq })
    })
  }, [conductor])
  const clearFlash = (seq) => setFlash((f) => (f && f.seq === seq ? null : f))

  const rows = useMemo(() => {
    const sessions = (((snap && snap.sessions) || []) || []).slice()
    sessions.sort((a, b) => (sessionFill(b) || 0) - (sessionFill(a) || 0))
    const out = []
    for (let i = 0; i < Math.min(ROWS, sessions.length); i++) {
      const s = sessions[i]
      const eng = sessionEngine(s, snap)
      const st = sessionState(s)
      const rate = sessionRate(s, snap)
      const fill = sessionFill(s)
      out.push({
        key: `${s.engine}-${s.id}`,
        cells: [
          String(s.id || '—').toUpperCase(),
          String((eng && (eng.key || eng.label)) || s.engine || '—').toUpperCase(),
          s.used != null ? s.used.toLocaleString('en-US') : '—',
          fill != null ? `${Math.round(fill * 100)}%` : '—',
          rate != null ? Math.round(rate) : '—',
          STATE_LABEL[st] || '—',
        ],
        state: st === 'hot' ? 'hot' : st === 'watch' ? 'watch' : '',
      })
    }
    for (let i = out.length; i < ROWS; i++) {
      out.push({ key: `pad-${i}`, cells: ['·', '·', '·', '·', '·', '·'], state: '' })
    }
    return out.slice(0, ROWS)
  }, [snap])

  const up = upEngines(snap)
  const lock = up[0] || null
  const tag = lock ? `ENG-${hexFrom(lock.key || lock.label || 'eng', 2)}` : 'NO ENG'

  return (
    <Frame title="SESSION TERMINAL" tag={tag} empty={ghosted} note={note} className="flex-[24] min-h-[170px] md:min-h-0">
      <div className={`grid gap-2 whitespace-nowrap border-b border-acc/25 px-1 pb-0.5 text-[7px] uppercase tracking-[0.06em] text-ink-3`} style={{ gridTemplateColumns: COLS }}>
        {LABELS.map((c) => (
          <span key={c} className="truncate">
            {c}
          </span>
        ))}
      </div>
      <div className="h-full overflow-hidden pt-0.5" role="table" aria-label="Live session rows">
        {rows.map((r, i) => {
          const hot = !!(flash && flash.i === i)
          return (
            <Row
              key={hot ? `${r.key}-${flash.seq}` : r.key}
              row={r}
              flash={hot}
              onDone={hot ? () => clearFlash(flash.seq) : undefined}
            />
          )
        })}
      </div>
    </Frame>
  )
}

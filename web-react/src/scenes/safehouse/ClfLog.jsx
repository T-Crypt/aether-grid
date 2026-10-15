// ClfLog: the SIGNAL CLASSIFICATION HISTORY — 30 rows of canonical feed
// events. level maps onto the reference's class ladder (err -> SUSPECT,
// warn -> TONE, ok -> SPEECH, info -> NOISE); the keyword-hit column is
// the real event text; flagged rows (err) take the alarm tint with a
// FLAGGED tier, and the header counts them.

import { useScene } from '../../scene/SceneRoot'
import { Frame, hashCode, pad } from './frame.jsx'

const CLASS = { err: 'SUSPECT', alert: 'SUSPECT', warn: 'TONE', ok: 'SPEECH', info: 'NOISE' }
const TIER = { err: 'FLAGGED', alert: 'FLAGGED', warn: 'T2-RVW', ok: 'T1-OK', info: 'T1-OK' }

function clock(e) {
  if (!e.t) return '--:--:--'
  const d = new Date(e.t * 1000)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function chanOf(e) {
  const seed = hashCode(e.id || `${e.t}-${e.msg}`)
  return `CH-${pad((seed % 128) + 1, 3)}`
}

export default function ClfLog() {
  const { snap } = useScene()
  const events = ((snap && snap.events) || []).slice(0, 30)
  const flagged = events.filter((e) => e.level === 'err' || e.level === 'alert').length
  const empty = events.length === 0

  return (
    <Frame
      title="SIGNAL CLASSIFICATION HISTORY"
      tag={`CLF-A3 · ${pad(flagged, 2)} FLAGGED`}
      empty={empty}
      note="no source"
      className="min-h-0 flex-[150]"
      bodyClass="overflow-hidden"
    >
      <div className="grid grid-cols-[0.95fr_0.7fr_0.6fr_1.6fr_0.7fr] gap-1.5 whitespace-nowrap border-b border-acc/25 px-1.5 pb-0.5 text-[6px] uppercase tracking-[0.1em] text-ink-3">
        <span>TIME GMT+1</span>
        <span>CHAN</span>
        <span>CLASS</span>
        <span>KEYWORD HIT</span>
        <span className="text-right">TIER</span>
      </div>
      <div className="h-full overflow-hidden">
        {events.map((e, i) => {
          const level = e.level || 'info'
          const flag = level === 'err' || level === 'alert'
          return (
            <div
              key={e.id ?? `${e.t}-${i}`}
              className={`grid grid-cols-[0.95fr_0.7fr_0.6fr_1.6fr_0.7fr] gap-1.5 whitespace-nowrap px-1.5 text-[6.5px] leading-[1.4] tracking-[0.04em] transition-colors duration-500 ${
                flag ? 'bg-alm/10 text-alm' : 'text-ink-2/85'
              }`}
            >
              <span className="tabular-nums text-ink-3">{clock(e)}</span>
              <span className={`tabular-nums ${flag ? 'text-alm' : 'text-acc'}`}>{chanOf(e)}</span>
              <span className={`tracking-[0.1em] ${flag ? 'text-alm' : 'text-dat'}`}>{CLASS[level] || 'NOISE'}</span>
              <span className="truncate">“{String(e.msg || '').slice(0, 26).toUpperCase()}”</span>
              <span className="text-right tracking-[0.1em] text-ink-3">{TIER[level] || 'T1-OK'}</span>
            </div>
          )
        })}
      </div>
    </Frame>
  )
}

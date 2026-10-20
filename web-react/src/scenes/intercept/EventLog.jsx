// EventLog: the SESSION EVENT LOG — 30 rows of canonical feed events.
// Class maps from the event's own text and level: prefill and arrival
// lines class PREFILL, decode lines DECODE, thinking lines THINK,
// eviction lines EVICT, and error-level lines ERROR. The SRC column is a
// decorative hex identifier derived from the event id (hexFrom), the
// severity pill is the real level. Error rows take the alarm tint and the
// header counts them.

import { useScene } from '../../scene/SceneRoot'
import { Frame, hashCode, hexFrom, pad } from './frame.jsx'

const CLASS = { err: 'ERROR', alert: 'ERROR', warn: 'DECODE', ok: 'DECODE', info: 'DECODE' }
const PILL = { err: 'ERR', alert: 'ERR', warn: 'WRN', ok: 'OK', info: 'OK' }

// Class from the event's own message: eviction and overflow lines class
// EVICT even when they land at error level, prefill and arrival lines
// PREFILL, thinking and MTP lines THINK, error lines ERROR.
function classOf(level, msg) {
  const m = String(msg || '').toLowerCase()
  if (/evict|overflow|reingest/.test(m)) return 'EVICT'
  if (level === 'err' || level === 'alert') return 'ERROR'
  if (/think|reason|mtp/.test(m)) return 'THINK'
  if (/prefill|queue|arriv|request|surge|waiting/.test(m)) return 'PREFILL'
  return 'DECODE'
}

function clock(e) {
  if (!e.t) return '--:--:--'
  const d = new Date(e.t * 1000)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function srcOf(e) {
  const seed = hashCode(e.id || `${e.t}-${e.msg}`)
  return hexFrom(String(seed), 4)
}

export default function EventLog() {
  const { snap } = useScene()
  const events = ((snap && snap.events) || []).slice(0, 30)
  const errored = events.filter((e) => e.level === 'err' || e.level === 'alert').length
  const empty = events.length === 0

  return (
    <Frame
      title="SESSION EVENT LOG"
      tag={`EVT · ${pad(errored, 2)} ERROR`}
      empty={empty}
      note="no source"
      className="min-h-0 flex-[150]"
      bodyClass="overflow-hidden"
    >
      <div className="grid grid-cols-[minmax(0,0.95fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,1.6fr)_minmax(0,0.5fr)] gap-1.5 whitespace-nowrap border-b border-acc/25 px-1.5 pb-0.5 text-[6px] uppercase tracking-[0.1em] text-ink-3">
        <span>TIME</span>
        <span>SRC</span>
        <span>CLASS</span>
        <span>EVENT</span>
        <span className="text-right">LVL</span>
      </div>
      <div className="scrollbar-thin-x h-full overflow-x-hidden overflow-y-auto">
        {events.map((e, i) => {
          const level = e.level || 'info'
          const flag = level === 'err' || level === 'alert'
          const cls = classOf(level, e.msg)
          return (
            <div
              key={e.id ?? `${e.t}-${i}`}
              className={`grid grid-cols-[minmax(0,0.95fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,1.6fr)_minmax(0,0.5fr)] gap-1.5 whitespace-nowrap px-1.5 text-[6.5px] leading-[1.4] tracking-[0.04em] transition-colors duration-500 ${
                flag ? 'bg-alm/10 text-alm' : 'text-ink-2/85'
              }`}
            >
              <span className="tabular-nums text-ink-3">{clock(e)}</span>
              <span className={`tabular-nums ${flag ? 'text-alm' : 'text-acc'}`}>{srcOf(e)}</span>
              <span className={`tracking-[0.1em] ${cls === 'ERROR' || cls === 'EVICT' ? 'text-alm' : 'text-dat'}`}>{cls}</span>
              <span className="truncate">{String(e.msg || '').slice(0, 26).toUpperCase()}</span>
              <span className="text-right tracking-[0.1em] text-ink-3">{PILL[level] || 'OK'}</span>
            </div>
          )
        })}
      </div>
    </Frame>
  )
}

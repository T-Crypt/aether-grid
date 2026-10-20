// TracePanels: the two intercept scopes of the right pane. Trace A plots
// the real decode history (kpiHist.tps) in the data colour; trace B plots
// arrivals times the mean prompt size of the newest requests, spread per
// second, in the accent. The rulers are tok/s and time, not level meters.
// Cell A surfaces the newest feed event as a live event line. The readouts
// are the real figures — decode tok/s and the derived prefill figure (*
// when derived).

import SceneCanvas from '../../scene/Canvas'
import { useScene } from '../../scene/SceneRoot'
import { paintTrace } from './painters'
import { decodeOf, prefillOf } from './shared'

const TPS_SCALE = ['300', '200', '100', '0'] // decode: fixed 0..300 tok/s
const PK_SCALE = ['PK', '75', '50', '25', '0'] // prefill: percent of peak

function Cell({ kind, tag, readout, eventLine, ghosted }) {
  const running = readout != null
  const ruler = kind === 'a' ? TPS_SCALE : PK_SCALE
  return (
    <div
      className={`relative min-h-0 min-w-0 flex-1 overflow-hidden border border-acc/25 bg-bgg/85 transition-opacity duration-500 ${
        ghosted ? 'ic-ghost' : ''
      }`}
    >
      <SceneCanvas
        draw={paintTrace(kind)}
        label={`${tag} trace`}
        className="absolute inset-0 h-full w-full"
      />
      <span className="pointer-events-none absolute left-1.5 top-1 text-[7.5px] tracking-[0.16em] text-acc">{tag}</span>
      <span className="pointer-events-none absolute right-1.5 top-1 text-[7.5px] tabular-nums tracking-[0.1em] text-dat">{readout ?? '—'}</span>
      {!running && (
        <span className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center text-[9px] tracking-[0.22em] text-ink-3">
          NO SOURCE
        </span>
      )}
      <div className="pointer-events-none absolute bottom-[12px] left-[2px] top-[16px] z-10 flex flex-col justify-between text-[5.5px] tracking-[0.04em] text-ink-3">
        {ruler.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="pointer-events-none absolute bottom-[1px] left-[24px] right-2 z-10 flex justify-between text-[5.5px] tracking-[0.04em] text-ink-3">
        <span>-2M</span>
        <span>NOW</span>
      </div>
      {eventLine ? (
        <div className="pointer-events-none absolute bottom-[12px] left-[16px] z-10 max-w-[calc(100%-24px)] truncate text-[8px] uppercase tracking-[0.14em] [text-shadow:0_0_4px_rgb(0_0_0_/_0.85)]">
          <span className="tracking-[0.16em] text-acc">EVENT</span>
          <span className="ml-1.5 tracking-[0.1em] tabular-nums text-ink-3">{eventLine.time}</span>
          <span className="ml-1.5 font-semibold tracking-[0.18em] text-dat">{eventLine.msg}</span>
        </div>
      ) : null}
    </div>
  )
}

export default function TracePanels({ ghosted }) {
  const { snap } = useScene()
  const decode = decodeOf(snap)
  const pf = prefillOf(snap)
  const running = snap && snap.mode !== 'offline' && snap.mode !== 'boot' && decode > 0
  const events = (snap && snap.events) || []
  const last = events[0] || null
  let eventLine = null
  if (last && last.msg) {
    const d = new Date(last.t * 1000)
    eventLine = {
      time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      msg: String(last.msg).slice(0, 34),
    }
  }
  return (
    <div className="flex min-h-[200px] min-w-0 flex-[178] flex-col gap-1 md:min-h-0" aria-label="Decode and prefill traces">
      <Cell
        kind="a"
        tag="TRACE A · DECODE TOK/S"
        readout={running && decode > 0 ? `${Math.round(decode)} T/S` : null}
        eventLine={eventLine}
        ghosted={ghosted}
      />
      <Cell
        kind="b"
        tag={`TRACE B · PREFILL TOK/S${pf.derived ? ' *' : ''}`}
        readout={running && pf.v != null ? `${Math.round(pf.v)} T/S` : null}
        ghosted={ghosted}
      />
    </div>
  )
}

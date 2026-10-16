// LOG / EXP. Events and requests as dense, hoverable rows on the shared
// surface. Rows arrive at feed rate (the translator's anomaly events and
// the feed's new_records); the flow rail above the list sweeps in step
// with the token rate via CSS --flow.

import { useState } from 'react'
import Scope from '../scene/Scope'
import { fmtKpi, relAge } from '../lib/format'
import { useScene } from '../scene/SceneRoot'

const LEVEL_BADGE = {
  ok: 'border-acc/40 text-acc',
  warn: 'border-dat/50 text-dat',
  err: 'border-alm/50 text-alm',
  alert: 'border-alm/50 text-alm',
  info: 'border-ink-3/30 text-ink-3',
}

function Tab({ id, label, count, active, onClick }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative min-h-[26px] px-2.5 py-1 text-2xs transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-acc ${
        active ? 'text-ink-1' : 'text-ink-3 hover:text-ink-2'
      }`}
    >
      {label}
      <span className="ml-1.5 tabular-nums text-ink-3">{count}</span>
      {active ? <span className="absolute inset-x-1 -bottom-px h-px bg-acc" /> : null}
    </button>
  )
}

export default function LogScope() {
  const { snap } = useScene()
  const [tab, setTab] = useState('events')
  const events = snap.events || []
  const requests = snap.requests || []

  return (
    <Scope
      id="sc-log"
      title="LOG / EXP"
      eyebrow="events · requests"
      accent="dat"
      right={`${events.length + requests.length} rows`}
      className="min-h-[200px] flex-1"
    >
      <div role="tablist" aria-label="Log source" className="flex items-center gap-1 border-b border-acc/12 pb-1">
        <Tab id="events" label="events" count={events.length} active={tab === 'events'} onClick={() => setTab('events')} />
        <Tab id="requests" label="requests" count={requests.length} active={tab === 'requests'} onClick={() => setTab('requests')} />
      </div>

      <div className="scrollbar-thin-x flow-rail mt-1.5 min-h-0 flex-1 overflow-y-auto pr-1" style={{ maxHeight: 320 }}>
        {tab === 'events' ? (
          events.length ? (
            <ul className="flex flex-col gap-px">
              {events.slice(0, 40).map((e) => (
                <li
                  key={e.id ?? `${e.t}-${e.msg}`}
                  className={`flex items-center gap-2 border-l-2 px-2 py-1 text-2xs transition-colors ${
                    e.level === 'err' || e.level === 'alert'
                      ? 'border-alm/60 bg-alm/[0.06] hover:bg-alm/[0.12]'
                      : e.level === 'warn'
                        ? 'border-dat/50 bg-dat/[0.04] hover:bg-dat/[0.10]'
                        : 'border-acc/30 bg-acc/[0.03] hover:bg-acc/[0.08]'
                  }`}
                >
                  <span className={`shrink-0 border px-1 py-px text-3xs uppercase ${LEVEL_BADGE[e.level] || LEVEL_BADGE.info}`}>
                    {e.level || 'info'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink-2">{e.msg}</span>
                  <span className="shrink-0 tabular-nums text-ink-3">{relAge(e.t)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-2xs text-ink-3">no events buffered</p>
          )
        ) : requests.length ? (
          <table className="w-full border-collapse text-2xs">
            <thead>
              <tr className="text-left text-ink-3">
                <th className="sticky top-0 z-10 bg-space-950/85 px-2 py-1 font-normal backdrop-blur-sm">id</th>
                <th className="sticky top-0 z-10 bg-space-950/85 px-2 py-1 font-normal backdrop-blur-sm">model</th>
                <th className="sticky top-0 z-10 bg-space-950/85 px-2 py-1 text-right font-normal backdrop-blur-sm">in→out</th>
                <th className="sticky top-0 z-10 bg-space-950/85 px-2 py-1 text-right font-normal backdrop-blur-sm">tok/s</th>
                <th className="sticky top-0 z-10 bg-space-950/85 px-2 py-1 text-right font-normal backdrop-blur-sm">age</th>
              </tr>
            </thead>
            <tbody>
              {requests.slice(0, 40).map((r) => (
                <tr key={r.id} className="border-t border-acc/10 transition-colors hover:bg-acc/[0.08]">
                  <td className="px-2 py-1 tabular-nums text-ink-3">{r.id}</td>
                  <td className="max-w-[9rem] truncate px-2 py-1 text-ink-2">{r.model}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-ink-2">
                    {r.prompt}→{r.output}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums text-acc">{fmtKpi('tps', r.decode_tps) ?? '—'}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-ink-3">{relAge(r.t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-4 text-center text-2xs text-ink-3">no requests buffered</p>
        )}
      </div>
    </Scope>
  )
}

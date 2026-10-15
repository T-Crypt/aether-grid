import { useState } from 'react'
import { motion } from 'framer-motion'
import { ScrollText } from 'lucide-react'
import Panel from './Panel'
import { fmtKpi, relAge } from '../lib/format'

const LEVEL_BADGE = {
  ok: 'border-acc/40 text-acc',
  warn: 'border-dat/50 text-dat',
  err: 'border-col/50 text-col',
  alert: 'border-col/50 text-col',
  info: 'border-ink-3/30 text-ink-3',
}

function Tab({ id, label, count, active, onClick }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative min-h-[26px] rounded px-2.5 py-1.5 text-2xs transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-acc ${
        active ? 'text-ink-1' : 'text-ink-3 hover:text-ink-2'
      }`}
    >
      {label}
      <span className="ml-1.5 tabular-nums text-ink-3">{count}</span>
      {active ? (
        <motion.span layoutId={`tab-${id}-u`} className="absolute inset-x-1 -bottom-px h-px bg-acc" />
      ) : null}
    </button>
  )
}

/**
 * Log / export panel: events and requests as dense, hoverable rows with status
 * badges and a custom scrollbar, instead of two stacked blinking lists.
 */
export default function LogPanel({ snap, stagger }) {
  const [tab, setTab] = useState('events')
  const events = snap.events || []
  const requests = snap.requests || []

  return (
    <Panel
      title="LOG / EXP"
      eyebrow="events · requests"
      icon={ScrollText}
      accent="dat"
      right={`${events.length + requests.length} rows`}
      stagger={stagger}
      bodyClassName="min-h-0"
    >
      <div role="tablist" aria-label="Log source" className="flex items-center gap-1 border-b border-acc/12 pb-1">
        <Tab id="events" label="events" count={events.length} active={tab === 'events'} onClick={() => setTab('events')} />
        <Tab id="requests" label="requests" count={requests.length} active={tab === 'requests'} onClick={() => setTab('requests')} />
      </div>

      <div className="scrollbar-thin-x mt-1.5 max-h-[240px] overflow-y-auto pr-1">
        {tab === 'events' ? (
          events.length ? (
            <ul className="flex flex-col gap-px">
              {events.slice(0, 40).map((e) => (
                <motion.li
                  key={e.id ?? `${e.t}-${e.msg}`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.26 }}
                  className="flex items-center gap-2 rounded-sm border-l-2 border-acc/30 bg-acc/[0.03] px-2 py-1 text-2xs transition-colors hover:bg-acc/[0.08]"
                >
                  <span className={`rounded border px-1 py-px text-3xs uppercase ${LEVEL_BADGE[e.level] || LEVEL_BADGE.info}`}>
                    {e.level || 'info'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink-2">{e.msg}</span>
                  <span className="shrink-0 tabular-nums text-ink-3">{relAge(e.t)}</span>
                </motion.li>
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
    </Panel>
  )
}

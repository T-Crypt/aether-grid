// SessionIo: the bottom I/O row of the engine bay — SESSION INGRESS (what
// arrives: queue, arrival rate, latency) and SESSION OUTFLOW (what the
// engines emit: sessions, context tokens, decode and prefill rates,
// reasoning), plus the event-class legend the log on the right pane keys
// on. PREFILL derives from arrivals when the engine does not report it
// (marked *); every other figure is a snapshot key or a direct sum.

import { useScene } from '../../scene/SceneRoot'
import { Frame } from './frame.jsx'
import { ctxUsed, decodeOf, prefillOf, upEngines, wellCounts } from './shared'

function IoBlock({ title, rows, ghosted = false, note }) {
  return (
    <Frame title={title} empty={ghosted} note={note} className="min-h-0 flex-1" bodyClass="px-1.5 pt-0.5 overflow-hidden">
      <div className="flex h-full flex-col justify-start">
        {rows.map(([k, v, tone]) => (
          <div key={k} className="flex items-baseline justify-between text-[7.5px] leading-[1.45]">
            <span className="text-ink-3">{k}</span>
            <span className={`tabular-nums ${tone || 'text-ink-2'}`}>{v}</span>
          </div>
        ))}
      </div>
    </Frame>
  )
}

const BTN =
  'flex min-h-0 flex-1 items-center justify-center border border-acc/25 bg-pan/40 px-1 text-[7.5px] tracking-[0.16em] uppercase transition-colors duration-300'

export default function SessionIo({ target, ghosted }) {
  const { snap } = useScene()
  const k = (snap && snap.kpi) || {}
  const alerts = (snap && snap.alerts) || []
  const feed = snap ? snap.mode || 'live' : '—'
  const wells = wellCounts(snap)
  const decode = decodeOf(snap)
  const pf = prefillOf(snap)
  const r = (snap && snap.reasoning) || {}

  const inRows = [
    ['QUEUE', k.queue != null ? String(Math.round(k.queue)) : '—'],
    ['REQ/MIN', k.rpm != null ? String(Math.round(k.rpm)) : '—'],
    ['P95', k.p95 != null ? `${(k.p95 / 1000).toFixed(1)}S` : '—'],
    ['TTFT', k.ttft != null ? `${(k.ttft / 1000).toFixed(2)}S` : '—'],
    ['HOT SESS', String(wells.hot)],
    ['WATCH SESS', String(wells.watch)],
    ['STATUS', alerts.length ? `ALRT ${alerts.length}` : 'OK', alerts.length ? 'text-dat' : ''],
  ]
  const outRows = [
    ['SESS', String((((snap && snap.sessions) || []) || []).length)],
    ['CTX TOK', ctxUsed(snap).toLocaleString('en-US')],
    ['DECODE', decode > 0 ? `${Math.round(decode)} TOK/S` : '—', 'text-dat'],
    ['PREFILL', pf.v != null ? `${Math.round(pf.v)}${pf.derived ? '*' : ''} TOK/S` : '—'],
    ['MTP', r.mtp_accept_pct != null ? `${Math.round(r.mtp_accept_pct)}%` : k.mtp != null ? `${Math.round(k.mtp)}%` : '—'],
    ['THINK', r.thinking_tokens != null ? r.thinking_tokens.toLocaleString('en-US') : '—'],
    ['ENG', `${upEngines(snap).length}/${(((snap && snap.engines) || []) || []).length}`],
  ]

  const legend = [
    { l: 'PREFILL', c: 'text-acc' },
    { l: 'DECODE', c: 'text-dat' },
    { l: 'THINK', c: 'text-col' },
    { l: 'EVICT', c: 'text-dat' },
    { l: 'ERROR', c: 'text-alm' },
  ]

  return (
    <div className="grid min-h-[120px] flex-[18] grid-cols-2 gap-1.5 md:min-h-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_64px]">
      <IoBlock title="SESSION INGRESS" rows={inRows} ghosted={ghosted} note="no source" />
      <IoBlock title="SESSION OUTFLOW" rows={outRows} ghosted={ghosted} note="no source" />
      <div className="col-span-2 flex flex-wrap gap-1 md:col-span-1 md:flex-col">
        {legend.map((b) => (
          <div key={b.l} className={BTN} aria-hidden="true">
            <span className={b.c}>{b.l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

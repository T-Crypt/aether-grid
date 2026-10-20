// Plate A — REQUEST INSPECTOR. The hero: the inspection bay (two stacked
// SceneCanvas layers: the chassis and the live CRT face), the four co-cards
// that call it out (DOM, hidden on phones) and the request ledger window.
// Bindings: the newest request record → the lock (hash, model, prompt and
// completion tokens, decode tok/s); kpi.ttft / kpi.p95 → the latency lines;
// the engine set → the lock lamp and status; requests → the ledger (newest
// first, flashed once as it lands). No event-stream rows here: events are
// the detection scene's charter.

import { useEffect, useRef } from 'react'
import { useScene } from '../../scene/SceneRoot'
import SceneCanvas from '../../scene/Canvas'
import { paintBay, paintFace } from './painters'
import { clockHms, ledgerRows, lockedRequest, grp } from './shared'

function CoCard({ no, label, body, sub, top }) {
  return (
    <div className="absolute right-0 w-[148px]" style={{ top, transform: 'translateY(-50%)' }}>
      <div className="flex h-[46px] flex-col justify-center gap-0.5 border border-black/60 bg-[rgb(0_0_0_/_0.42)] px-1.5 shadow-[inset_0_1px_0_rgb(var(--text-1)_/_0.06),0_1px_3px_rgb(0_0_0_/_0.5)]">
        <span className="text-[7.5px] tracking-[0.14em] text-ink-3">
          {no} · {label}
        </span>
        <span className="text-[10px] font-semibold tracking-[0.06em] text-ink-1 tabular-nums truncate whitespace-nowrap">{body}</span>
        <span className="text-[8px] tracking-[0.06em] text-ink-3 tabular-nums truncate whitespace-nowrap">{sub}</span>
      </div>
    </div>
  )
}

const LED_COLS = 'grid grid-cols-[6.5ch_minmax(0,1fr)_5.2ch_5.2ch_3.5ch_minmax(0,1fr)] items-center gap-x-1 text-[10px]'

export default function InspectorPlate() {
  const { snap, tick } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const lock = lockedRequest(snap)
  const rows = ledgerRows(snap)
  const hm = clockHms(tick)
  const k = (snap && snap.kpi) || {}
  const total = ((snap && snap.requests) || []).length
  // One-shot boundary: ids already rendered never re-flash, so a held feed
  // or a list shift cannot restart the finite row animation on an old row.
  // Only genuinely new request ids take the class (stable keys mean no
  // per-tick remount either). The first paint stays silent: mounting is not
  // an event. Scene-local refs, no store.
  const seenRows = useRef(new Set())
  const announced = useRef(false)
  for (const r of rows) {
    r.fresh = announced.current && r.id != null && !seenRows.current.has(r.id)
  }
  // The boundary updates post-commit: writing it during render would mark
  // ids seen before StrictMode's second render pass and eat the one-shot.
  useEffect(() => {
    announced.current = true
    seenRows.current = new Set(rows.map((r) => r.id))
  })
  const hashS = offline ? null : lock.hash || '——'
  const tpsS = lock.tps != null ? Math.round(lock.tps) : null
  const headLine = offline
    ? 'NO SOURCE · BAY HELD'
    : `LOCK ${hashS} · TTFT ${lock.ttft != null ? Math.round(lock.ttft) : '—'} MS · ${hm}`

  return (
    <section aria-label="Request inspector" className="fd-plate flex min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="fd-ph flex items-baseline justify-between gap-2 px-2.5 pt-1.5 pb-1">
        <span className="flex items-baseline gap-1.5">
          <i className="fd-st">A</i>
          <b className="text-[12.5px] font-semibold tracking-[0.18em] text-ink-1">REQUEST INSPECTOR</b>
          <span className="text-[8px] tracking-[0.12em] text-ink-3">NEWEST REQUEST UNDER LOCK · RIG 01</span>
        </span>
        <span className="hidden min-w-0 truncate text-[9px] tracking-[0.08em] text-ink-3 tabular-nums min-[1280px]:block">
          {headLine}
        </span>
        <span className="min-w-0 flex-1 truncate text-right text-[9px] tracking-[0.08em] text-ink-3 tabular-nums min-[1280px]:hidden">
          {headLine}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 px-1.5 pb-1.5 min-[769px]:grid min-[769px]:grid-cols-[minmax(0,57fr)_minmax(0,43fr)] min-[769px]:gap-1.5">
        {/* left: the inspection bay */}
        <div className="fd-dev relative min-h-[300px] flex-1 min-[769px]:min-h-0">
          <SceneCanvas draw={(ctx, w, h, c) => paintBay(ctx, w, h, c)} className="absolute inset-0 h-full w-full" />
          <SceneCanvas draw={(ctx, w, h, c) => paintFace(ctx, w, h, c)} className="absolute inset-0 h-full w-full" />
          {/* the four co-cards: callout cards over the bay's right side;
              they show only when the bay is wide enough to hold them
              beside the device (bayLayout hides the card strip below a
              400 px bay, which is a 1536 px viewport) */}
          <div data-fd-co="cards" className="absolute inset-y-0 right-1 z-10 hidden min-[1536px]:block">
            <CoCard
              no="1"
              label="THE LOCK"
              body={offline ? 'LOCK · —' : `LOCK · ${hashS}`}
              sub={offline ? 'NO SOURCE' : `${hm} · ${lock.hash ? 'LOCKED' : 'OPEN'}`}
              top="9%"
            />
            <CoCard
              no="2"
              label="TTFT"
              body={offline ? '—' : `${lock.ttft != null ? Math.round(lock.ttft) : '—'} MS`}
              sub={offline ? 'NO SOURCE' : `P95 ${lock.p95 != null ? Math.round(lock.p95) : '—'} MS · GATE`}
              top="36%"
            />
            <CoCard
              no="3"
              label="DECODE"
              body={offline ? '—' : `${tpsS != null ? tpsS : '—'} TOK/S`}
              sub={offline ? 'NO SOURCE' : `ENGINE ${lock.engine || '—'}`}
              top="62%"
            />
            <CoCard
              no="4"
              label="QUEUE"
              body={offline ? '—' : `${lock.queue != null ? Math.round(lock.queue) : '—'} DEEP`}
              sub={offline ? 'NO SOURCE' : `${grp(total)} LEDGERED · RIG 01`}
              top="80%"
            />
          </div>
        </div>

        {/* right: the request ledger */}
        <div className="fd-win flex min-h-[220px] flex-col px-1.5 pt-1 pb-1.5 min-[769px]:min-h-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[9px] font-semibold tracking-[0.14em] text-ink-2">REQUEST LEDGER</span>
            <span className="text-[8px] tracking-[0.08em] text-ink-3 tabular-nums">
              {offline
                ? 'NO SOURCE · LEDGER HELD'
                : `LAST 40 · ${grp(total)} RECORDS · ${k.rpm != null ? Math.round(k.rpm) : '—'} REQ/MIN`}
            </span>
          </div>
          <div className={LED_COLS + ' border-b border-black/40 px-0.5 pt-1 text-[8px] tracking-[0.05em] text-ink-3'}>
            <span className="px-0.5">HASH</span>
            <span className="px-0.5">MODEL</span>
            <span className="px-0.5">IN</span>
            <span className="px-0.5">OUT</span>
            <span className="px-0.5">T/S</span>
            <span className="px-0.5">STATUS</span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {rows.length === 0 && (
              <div className="flex h-full items-center justify-center text-[9px] tracking-[0.12em] text-ink-3">
                NO SOURCE · LEDGER HELD
              </div>
            )}
            {rows.map((r) => (
              <div
                key={r.id}
                className={LED_COLS + ' leading-[13px] ' + (r.fresh ? 'fd-flash' : '')}
              >
                <span className="fd-vt text-[11px] text-ink-1 tabular-nums">{r.hash}</span>
                <span className="truncate px-0.5 text-[10px] text-ink-2">{r.model}</span>
                <span className="px-0.5 text-[10px] text-ink-2 tabular-nums">{r.inT != null ? grp(r.inT) : '—'}</span>
                <span className="px-0.5 text-[10px] text-ink-2 tabular-nums">{r.outT != null ? grp(r.outT) : '—'}</span>
                <span className="px-0.5 text-[10px] text-ink-2 tabular-nums">{r.tps != null ? Math.round(r.tps) : '—'}</span>
                <span
                  className={
                    'px-0.5 truncate text-[10px] font-semibold ' +
                    (r.sx === 'DECODING'
                      ? 'text-[rgb(var(--acc))] [text-shadow:0_0_7px_rgb(var(--acc)_/_0.5)]'
                      : r.sx === 'QUEUED'
                        ? 'text-[rgb(var(--alm))] [text-shadow:0_0_7px_rgb(var(--alm)_/_0.5)]'
                        : r.sx === 'HELD'
                          ? 'text-ink-3'
                          : 'text-ink-2')
                  }
                >
                  {r.sx}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

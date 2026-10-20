// Logit Spectrum edge strips: the top meta bar (console/charter/spectrum/
// runtime/reason line/clock) and the bottom pills + anomaly flag + event
// ticker. Feed-rate DOM only; nothing here animates on its own.

import { clockOf, hmOf, metaOf, lockScore, runtimeOf, lanesOf, grp } from './shared'

export function EdgeTop({ snap, conductor }) {
  const meta = metaOf(snap)
  const offline = !snap || snap.mode === 'offline'
  const rt = runtimeOf(snap)
  const lock = lockScore(snap, conductor)
  const lanes = lanesOf(snap, conductor)
  const k = (snap && snap.kpi) || {}
  // The spectrum leads with what it is watching, not what it burns: model,
  // engine line and ledger size. Tok/s belongs to the throughput scene and
  // thermals to the capacity scene, so neither prints here.
  const runtime = offline
    ? 'HELD · NO SOURCE'
    : `${rt.model || 'NO MODEL'} · ENG ${rt.engine || '—'} · ${meta.ledger}`
  const reason = offline
    ? 'NO SOURCE'
    : `THINK ${lanes.think > 0 ? 'ACTIVE' : 'IDLE'} · LOCK ${lock.score != null ? lock.score : '—'}%`
  return (
    <header className="relative z-10 flex min-w-0 shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-acc/15 bg-pan/80 px-3 py-1.5 text-[9px] tracking-[0.14em] text-ink-2">
      <span className="min-w-0 truncate">
        <span className="text-ink-1">LOGIT SPECTRUM</span> <span className="text-ink-3">DETECTION · REASONING</span>
      </span>
      <span className="hidden min-w-0 truncate sm:block">
        <span className="text-ink-1">CONSOLE</span> <span className="text-ink-3">AETHER GRID · LOCAL LLM RUNTIME</span>
      </span>
      <span className="hidden min-w-0 truncate md:block">
        <span className="text-ink-1">SPEC</span> <span className="text-ink-3">128 BINS · 192 ROWS</span>
      </span>
      <span className="min-w-0 shrink truncate tabular-nums" title={runtime} aria-label="Runtime line">
        <span className="text-ink-1">RUNTIME</span>{' '}
        <span className={offline ? 'text-ink-3' : 'text-dat'}>{runtime}</span>
      </span>
      <span className="hidden min-w-0 truncate lg:block">
        <span className="text-ink-1">REASON</span> <span className="text-ink-3">{reason}</span>
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-4">
        <span className="tabular-nums">
          <span className="text-ink-3">CLOCK </span>
          <span className="text-ink-1">{offline ? '—' : clockOf(conductor.tick)}</span>
        </span>
        <span className="tabular-nums">
          <span className="text-ink-3">DECODE </span>
          <span className="text-acc">{offline ? '—' : k.tps != null ? `${Math.round(k.tps)} TOK/S` : '—'}</span>
        </span>
        <span className="hidden truncate text-ink-3 sm:block">{meta.up}</span>
      </span>
    </header>
  )
}

export function EdgeBot({ snap, conductor }) {
  const meta = metaOf(snap)
  const lock = lockScore(snap, conductor)
  const ai = (snap && snap.alerts) || []
  const offline = !snap || snap.mode === 'offline'
  const newest = meta.ticker[0]
  return (
    <footer className="relative z-10 min-w-0 shrink-0 border-t border-acc/15 bg-pan/80">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-1.5 pb-1 text-[9px] tracking-[0.14em]">
        <span className="shrink-0 border border-acc/25 px-1.5 py-0.5 text-acc">EVENT BUS</span>
        <span className="shrink-0 border border-acc/25 px-1.5 py-0.5 text-acc">AUTO·CLASS</span>
        <span className="hidden shrink-0 border border-acc/25 px-1.5 py-0.5 text-acc sm:block">REASON LOCK</span>
        <span className="hidden shrink-0 border border-acc/25 px-1.5 py-0.5 text-acc md:block">
          FEED <span className="text-ink-3">{offline ? 'HELD' : 'LIVE'}</span>
        </span>
        <span className="hidden min-w-0 truncate text-ink-3 lg:block">ROWS THINK · DECODE · MTP · TIME FALLS TO NOW</span>
        {lock.confirmed && !offline && (
          <span key="flare" className="sp-flare ml-auto flex shrink-0 items-center gap-1.5 border border-col/60 px-1.5 py-0.5 text-col">
            <i className="sp-pip inline-block h-[7px] w-[7px] rounded-full bg-col" aria-hidden="true" />
            ANOMALY · {Math.max(1, ai.length)} ACTIVE · LOCK {lock.score != null ? lock.score : '—'}%
          </span>
        )}
      </div>
      <div className="flex min-w-0 items-center gap-2 overflow-hidden border-t border-acc/10 px-3 py-1 text-[9px] tracking-[0.06em]">
        <span className="shrink-0 tracking-[0.18em] text-ink-3">EVENT LOG</span>
        <span className="min-w-0 flex-1 truncate tabular-nums text-ink-2">
          {offline || !newest ? (
            <span className="text-alm">NO SOURCE · HOLDING LAST FRAME</span>
          ) : (
            <>
              <span className="text-ink-3">{hmOf(newest.t)} · </span>
              <span className={newest.level === 'err' || newest.level === 'alert' ? 'text-alm' : newest.level === 'warn' ? 'text-dat' : 'text-ink-1'}>
                {String(newest.msg || '').slice(0, 90).toUpperCase()}
              </span>
              <span className="text-ink-3"> · +{grp(Math.max(0, meta.ticker.length - 1))} MORE</span>
            </>
          )}
        </span>
        <span className="shrink-0 tabular-nums text-ink-3">{meta.rpm}</span>
      </div>
    </footer>
  )
}

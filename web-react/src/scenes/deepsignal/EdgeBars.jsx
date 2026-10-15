// Deepsignal edge strips: the top meta bar (outpost/contract/obs/pointing/
// SAST clock/band) and the bottom pills + WOW!-2 flag + bot-log ticker.
// Feed-rate DOM only; nothing here animates on its own.

import { metaOf, sastOf, candScore, runtimeOf } from './shared'

export function EdgeTop({ snap }) {
  const meta = metaOf(snap)
  const offline = !snap || snap.mode === 'offline'
  const rt = runtimeOf(snap)
  const runtime = offline
    ? 'HELD · NO SOURCE'
    : `${rt.model || 'NO MODEL'} · ${rt.tps != null ? `${Math.round(rt.tps)} TOK/S` : '— TOK/S'} · ENG ${rt.engine || '—'} · ${rt.temp != null ? `${Math.round(rt.temp)} °C` : '—'}`
  return (
    <header className="relative z-10 flex min-w-0 shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-acc/15 bg-pan/80 px-3 py-1.5 text-[9px] tracking-[0.14em] text-ink-2">
      <span className="min-w-0 truncate">
        <span className="text-ink-1">OUTPOST</span> <span className="text-ink-3">KAROO LL-S</span>
      </span>
      <span className="hidden min-w-0 truncate sm:block">
        <span className="text-ink-1">CONTRACT</span> <span className="text-ink-3">UESA SRP · K-2207</span>
      </span>
      <span className="hidden min-w-0 truncate md:block">
        <span className="text-ink-1">OBS</span> <span className="text-ink-3">1420 MHz · H-LINE</span>
      </span>
      <span className="min-w-0 shrink truncate tabular-nums" title={runtime} aria-label="Runtime line">
        <span className="text-ink-1">RUNTIME</span>{' '}
        <span className={offline ? 'text-ink-3' : 'text-dat'}>{runtime}</span>
      </span>
      <span className="hidden min-w-0 truncate lg:block">
        <span className="text-ink-1">POINTING</span> <span className="text-ink-3">RA 10h14m · DEC −12°55′</span>
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-4">
        <span className="tabular-nums">
          <span className="text-ink-3">SAST </span>
          <span className="text-ink-1">{offline ? '—' : sastOf(snap)}</span>
        </span>
        <span className="tabular-nums">
          <span className="text-ink-3">BAND </span>
          <span className="text-acc">1.40–1.50</span>
        </span>
        <span className="hidden truncate text-ink-3 sm:block">{meta.shift}</span>
      </span>
    </header>
  )
}

export function EdgeBot({ snap, conductor }) {
  const meta = metaOf(snap)
  const cs = candScore(snap, conductor)
  const offline = !snap || snap.mode === 'offline'
  const newest = meta.ticker[0]
  return (
    <footer className="relative z-10 min-w-0 shrink-0 border-t border-acc/15 bg-pan/80">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-1.5 pb-1 text-[9px] tracking-[0.14em]">
        <span className="shrink-0 border border-acc/25 px-1.5 py-0.5 text-acc">AUTO·CLASS</span>
        <span className="shrink-0 border border-acc/25 px-1.5 py-0.5 text-acc">ARRAY</span>
        <span className="hidden shrink-0 border border-acc/25 px-1.5 py-0.5 text-acc sm:block">TRACKING</span>
        <span className="hidden shrink-0 border border-acc/25 px-1.5 py-0.5 text-acc md:block">
          PEER <span className="text-ink-3">PENDING</span>
        </span>
        <span className="hidden min-w-0 truncate text-ink-3 lg:block">OPERATOR AIYANA J-V · TUE–THU OVERNIGHT</span>
        {cs.confirmed && !offline && (
          <span key="wow" className="ds-wow ml-auto flex shrink-0 items-center gap-1.5 border border-col/60 px-1.5 py-0.5 text-col">
            <i className="ds-pip inline-block h-[7px] w-[7px] rounded-full bg-col" aria-hidden="true" />
            WOW!-2 · SCORE {cs.score}
          </span>
        )}
      </div>
      <div className="flex min-w-0 items-center gap-2 overflow-hidden border-t border-acc/10 px-3 py-1 text-[9px] tracking-[0.06em]">
        <span className="shrink-0 tracking-[0.18em] text-ink-3">BOT-LOG</span>
        <span className="min-w-0 flex-1 truncate tabular-nums text-ink-2">
          {offline || !newest ? (
            <span className="text-alm">NO SOURCE · HOLDING LAST FRAME</span>
          ) : (
            <>
              <span className="text-ink-3">{newest.t} · </span>
              <span className={newest.level === 'err' || newest.level === 'alert' ? 'text-alm' : newest.level === 'warn' ? 'text-dat' : 'text-ink-1'}>
                {String(newest.msg || '').slice(0, 90).toUpperCase()}
              </span>
              <span className="text-ink-3"> · +{meta.ticker.length - 1} MORE</span>
            </>
          )}
        </span>
        <span className="shrink-0 tabular-nums text-ink-3">{meta.cands}</span>
      </div>
    </footer>
  )
}

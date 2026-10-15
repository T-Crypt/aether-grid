// Plate A — THE ASSAY. The hero: the handheld device (two stacked SceneCanvas
// layers: the body and the live CRT face), the four co-cards that call it
// out (DOM, hidden on phones), the stoop ledger window and the scan log.
// Bindings: engine up/down → the lamp (amber up, violet down); reasoning
// mtp_accept_pct (or the conductor reason) → the reading; sessions → boots
// ranks; requests → the scan log (newest at the bottom, flashed once as it
// lands); events → the stoop ledger rows.

import { useScene } from '../../scene/SceneRoot'
import SceneCanvas from '../../scene/Canvas'
import { paintDevBody, paintDevLive } from './painters'
import { assayLamp, ledgerRows, scanRows, priceStats, clockHm, clockHms, readingOf, grp, docketOf, activeModelOf } from './shared'

const BOOT_FROM_CODE = { b0: 'GREY', b1: 'TAN', b2: 'RED', b3: 'BLACK' }

function CoCard({ no, label, body, sub, top }) {
  return (
    <div className="absolute right-0 w-[148px]" style={{ top, transform: 'translateY(-50%)' }}>
      <div className="flex h-[46px] flex-col justify-center gap-0.5 border border-black/60 bg-[rgb(0_0_0_/_0.42)] px-1.5 shadow-[inset_0_1px_0_rgb(var(--text-1)_/_0.06),0_1px_3px_rgb(0_0_0_/_0.5)]">
        <span className="text-[7.5px] tracking-[0.14em] text-ink-3">
          {no} · {label}
        </span>
        <span className="text-[10px] font-semibold tracking-[0.06em] text-ink-1 tabular-nums whitespace-nowrap">{body}</span>
        <span className="text-[8px] tracking-[0.06em] text-ink-3 tabular-nums whitespace-nowrap">{sub}</span>
      </div>
    </div>
  )
}

const LED_COLS = 'grid grid-cols-[4.2ch_1.25fr_1.4ch_0.9fr_2.6ch_1fr] items-center gap-x-1'

export default function AssayPlate() {
  const { snap, tick, conductor } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const lamp = assayLamp(snap, conductor.alert)
  const rd = readingOf(conductor, snap)
  const pr = priceStats(snap, snap && snap.gpu)
  const ledger = ledgerRows(snap).slice(0, 8)
  const scans = scanRows(snap, lamp, tick)
  const lastScan = scans.length ? scans[scans.length - 1] : null
  const word = lamp === 'A' ? 'AMBER' : 'VIOLET'
  const boots = lastScan ? BOOT_FROM_CODE[lastScan.boots] || 'GREY' : 'GREY'
  const dk = offline ? null : docketOf(snap)
  const hm = clockHms(tick)
  const scansCount = 3928 + ((snap && snap.requests) || []).length
  const act = activeModelOf(snap)
  const screenLineShort = offline
    ? 'NO SOURCE'
    : `${act.model || 'NO MODEL'} · ${act.tps != null ? `${Math.round(act.tps)} TOK/S` : '— TOK/S'} · ${act.temp != null ? `${Math.round(act.temp)}°C` : '—'}`
  const screenLine = offline
    ? 'NO SOURCE'
    : `LAST ${hm} · DOCKET ${dk} · LAMP ${word} · ${act.model || 'NO MODEL'} · ${act.tps != null ? `${Math.round(act.tps)} TOK/S` : '— TOK/S'} · ${act.temp != null ? `${Math.round(act.temp)}°C` : '—'} · Q ${act.queue != null ? Math.round(act.queue) : '—'} · P95 ${act.p95 != null ? Math.round(act.p95) : '—'}`

  return (
    <section aria-label="The Assay" className="cy-plate flex min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="cy-ph flex items-baseline justify-between gap-2 px-2.5 pt-1.5 pb-1">
        <span className="flex items-baseline gap-1.5">
          <i className="cy-st">A</i>
          <b className="text-[12.5px] font-semibold tracking-[0.18em] text-ink-1">THE ASSAY</b>
          <span className="text-[8px] tracking-[0.12em] text-ink-3">HANDHELD · SERIAL 0061-K</span>
        </span>
        <span className="hidden min-w-0 truncate text-[9px] tracking-[0.08em] text-ink-3 tabular-nums min-[1280px]:block">
          {screenLine}
        </span>
        <span className="min-w-0 flex-1 truncate text-right text-[9px] tracking-[0.08em] text-ink-3 tabular-nums min-[1280px]:hidden">
          {screenLineShort}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 px-1.5 pb-1.5 min-[769px]:grid min-[769px]:grid-cols-[minmax(0,57fr)_minmax(0,43fr)] min-[769px]:gap-1.5">
        {/* left: the device + the stoop ledger */}
        <div className="flex min-h-0 flex-col gap-1.5">
          <div className="a-dev relative min-h-[300px] flex-1 min-[769px]:min-h-0">
            <SceneCanvas draw={(ctx, w, h, c) => paintDevBody(ctx, w, h, c)} className="absolute inset-0 h-full w-full" />
            <SceneCanvas draw={(ctx, w, h, c) => paintDevLive(ctx, w, h, c)} className="absolute inset-0 h-full w-full" />
            {/* the four co-cards: callout cards over the device's right side */}
            <div data-cy-co="cards" className="absolute inset-y-0 right-1 z-10 hidden min-[769px]:block">
              <CoCard
                no="1"
                label="THE LAMP"
                body={offline ? 'LAMP · —' : `LAMP · ${word}`}
                sub={offline ? 'NO SOURCE' : `${hm} · LIT`}
                top="9%"
              />
              <CoCard
                no="2"
                label="READING"
                body={offline ? '0.000 · UNIT n/a' : `${rd.toFixed(3)} · UNIT n/a`}
                sub={offline ? 'NO SOURCE' : `MTP ACCEPT ${((snap && snap.reasoning && snap.reasoning.mtp_accept_pct != null ? snap.reasoning.mtp_accept_pct : 0) / 100).toFixed(2)}%`}
                top="36%"
              />
              <CoCard
                no="3"
                label="BOOTS"
                body={offline ? '—' : `${boots} BOOT ENTERED`}
                sub={offline ? 'NO SOURCE' : `${hm} · HAND`}
                top="62%"
              />
              <CoCard
                no="4"
                label="THE AGE"
                body="61 YR · 0061-K"
                sub={`${grp(scansCount)} SCANS · NO MANUAL`}
                top="80%"
              />
            </div>
          </div>

          <div className="cy-win flex flex-col shrink-0 px-1.5 pt-1 pb-1.5 min-[769px]:h-[126px]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[9px] font-semibold tracking-[0.14em] text-ink-2">STOOP LEDGER · WHO TO WHOM</span>
              <span className="text-[8px] tracking-[0.08em] text-ink-3 tabular-nums">
                {offline ? 'NO SOURCE' : `YEAR 3,927 · POST 3`}
              </span>
            </div>
            <div className={LED_COLS + ' border-b border-black/40 text-[8px] tracking-[0.1em] text-ink-3'}>
              <span className="px-0.5 pt-1">DOCKET</span>
              <span className="px-0.5">TRAVELLER</span>
              <span className="px-0.5">SH</span>
              <span className="px-0.5">BOOTS</span>
              <span className="px-0.5">READ</span>
              <span className="px-0.5">STATUS</span>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {ledger.length === 0 && (
                <div className="flex h-full items-center justify-center text-[9px] tracking-[0.12em] text-ink-3">
                  NO SOURCE · LEDGER HELD
                </div>
              )}
              {ledger.map((r, i) => (
                <div
                  key={r.id}
                  className={
                    LED_COLS +
                    ' leading-[13px] ' +
                    (i === ledger.length - 1 ? 'cy-flash' : '') +
                    (r.level === 'V' ? ' cy-flash-v' : '')
                  }
                >
                  <span className="px-0.5 text-[10px] font-semibold text-ink-1 tabular-nums">{r.to}</span>
                  <span className="truncate px-0.5 text-[10px] text-ink-2">{r.from}</span>
                  <span className="px-0.5 text-[10px] text-ink-3 tabular-nums">{clockHm(Math.floor((r.t || 0) / 1000))}</span>
                  <span className="px-0.5 text-[10px] text-ink-3">
                    {r.level === 'V' ? 'GREY' : r.level === 'A' ? 'TAN' : '—'}
                  </span>
                  <span className="px-0.5 text-[10px] text-ink-2 tabular-nums">×{r.n}</span>
                  <span
                    className={
                      'px-0.5 truncate text-[10px] font-semibold ' +
                      (r.level === 'V' ? 'text-[rgb(var(--col))] [text-shadow:0_0_7px_rgb(var(--col)_/_0.5)]' : r.level === 'A' ? 'text-[rgb(var(--acc))] [text-shadow:0_0_7px_rgb(var(--acc)_/_0.5)]' : 'text-ink-2')
                    }
                  >
                    {r.note}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* right: the scan log */}
        <div className="cy-win flex min-h-[220px] flex-col px-1.5 pt-1 pb-1.5 min-[769px]:min-h-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[9px] font-semibold tracking-[0.14em] text-ink-2">SCAN LOG</span>
            <span className="text-[8px] tracking-[0.08em] text-ink-3 tabular-nums">
              {offline
                ? 'NO SOURCE · LOG HELD'
                : `LAST 40 · 0061-K · ${pr.price != null ? pr.price.toFixed(1) : '—'} B/L TODAY`}
            </span>
          </div>
          <div className="grid grid-cols-[4.6ch_1.8ch_2.8ch_1.2fr_3.2ch_1.6fr] items-center gap-x-1 border-b border-black/40 px-0.5 pt-1 text-[8px] tracking-[0.1em] text-ink-3">
            <span>DOCKET</span>
            <span>SH</span>
            <span>LAMP</span>
            <span>BOOTS</span>
            <span>READ</span>
            <span>STOOPS · STATUS</span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {scans.length === 0 && (
              <div className="flex h-full items-center justify-center text-[9px] tracking-[0.12em] text-ink-3">
                NO SOURCE · LOG HELD
              </div>
            )}
            {scans.map((r) => (
              <div
                key={r.id}
                className={
                  'grid grid-cols-[4.6ch_1.8ch_2.8ch_1.2fr_3.2ch_1.6fr] items-center gap-x-1 px-0.5 leading-[13px] ' +
                  (r.fresh ? 'cy-flash' : '')
                }
              >
                <span className="cy-vt text-[11px] text-ink-1 tabular-nums">{r.dk.toLocaleString('en-US')}</span>
                <span className="cy-vt text-[11px] text-ink-3 tabular-nums">{r.tm}</span>
                <span
                  className={
                    'cy-vt text-[11px] ' +
                    (r.lamp === 'A'
                      ? 'text-[rgb(var(--acc))] [text-shadow:0_0_7px_rgb(var(--acc)_/_0.5)]'
                      : 'text-[rgb(var(--col))] [text-shadow:0_0_7px_rgb(var(--col)_/_0.5)]')
                  }
                >
                  {r.lamp === 'A' ? 'AMBER' : 'VIOLET'}
                </span>
                <span className="cy-vt text-[11px] text-ink-2">{r.boots}</span>
                <span className="cy-vt text-[11px] text-ink-2 tabular-nums">{r.rd}</span>
                <span className="cy-vt truncate text-[11px] text-ink-3">
                  {r.so} · {r.sx}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

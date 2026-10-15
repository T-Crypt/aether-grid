// Identity strip (row T): the top beam of the booth wall. POST / SHIFT /
// ASSAYED / PRICE (the big VT323 number with the held up-arrow — the
// reference's alarm that never blinks) / DOCKET / officer line / the assays
// spark (hidden below 1280 px, as in the reference) / the shift clock.
// Bindings: host.uptime → shift, tick → clock, kpi.rpm → assayed count,
// kpi.vram → the posted price (kpiHist.vram gives the climb since open).

import { useScene } from '../../scene/SceneRoot'
import SceneCanvas from '../../scene/Canvas'
import { paintSpark } from './painters'
import { clockHm, priceStats, talliesOf, docketOf } from './shared'

function Cell({ children, className = '', title }) {
  return (
    <div
      title={title}
      className={`flex min-w-0 flex-col justify-center gap-0.5 overflow-hidden border-r border-black/55 px-2.5 shadow-[1px_0_0_rgb(var(--text-1)_/_0.05)] last:border-r-0 ${className}`}
    >
      {children}
    </div>
  )
}

const R1 = 'text-[10.5px] font-medium tracking-[0.1em] text-ink-1 tabular-nums whitespace-nowrap'
const R2 = 'text-[8px] tracking-[0.08em] text-ink-3 tabular-nums whitespace-nowrap'

export default function IdentityStrip() {
  const { snap, tick } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const k = (snap && snap.kpi) || {}
  const host = (snap && snap.host) || null
  const gpu = (snap && snap.gpu) || null
  const pr = priceStats(snap, gpu)
  const tallies = talliesOf(snap)
  const assayed = k.rpm != null ? Math.min(999, Math.round(k.rpm / 15)) : null
  const amberPct =
    tallies.amb + tallies.vio > 0 ? ((tallies.amb / (tallies.amb + tallies.vio)) * 100).toFixed(1) : null
  const shift = host && host.uptime != null ? (11 + Math.floor(host.uptime / 86400)) % 24 : 11
  const clock = clockHm(tick)
  const price = pr.price != null ? pr.price.toFixed(1) : null
  const priceBig = pr.price != null ? pr.price.toFixed(2) : null
  const delta = pr.delta != null ? (pr.delta >= 0 ? `+${pr.delta.toFixed(2)}` : pr.delta.toFixed(2)) : null
  const pct = pr.pct != null ? (pr.pct >= 0 ? `+${pr.pct.toFixed(1)}%` : `${pr.pct.toFixed(1)}%`) : null
  const dk = offline ? null : docketOf(snap)

  return (
    <header
      aria-label="Identity strip"
      className="cy-strip relative flex h-[54px] shrink-0 items-stretch overflow-hidden bg-pan shadow-[inset_0_-1px_0_rgb(0_0_0_/_0.5),0_2px_6px_rgb(0_0_0_/_0.6)] min-[769px]:h-[56px]"
      style={{
        backgroundImage: 'linear-gradient(180deg, rgb(0 0 0 / 0.3), rgb(0 0 0 / 0.45)), rgb(var(--pan))',
        borderBottom: '1px solid rgb(0 0 0 / 0.7)',
      }}
    >
      <Cell className="pl-3">
        <span className="text-[8px] tracking-[0.14em] text-ink-3">
          CUSTOMS POST 3 · CYBER PASS · 2,140 M<span className="hidden min-[1280px]:inline"> · LOWER WORKS – UPPER BENCHES</span>
        </span>
        <span className="text-[8px] tracking-[0.1em] text-ink-3">
          SHIFT {offline ? '—' : shift} · OFFICER EKUNDAYO · <span className="text-ink-2">{clock}</span>
        </span>
      </Cell>

      <Cell title="shift from host uptime">
        <span className={R1}>
          SHIFT <b className="font-bold">{offline ? '—' : shift}</b>
        </span>
        <span className={R2}>06:00–18:00 · 1 OFFICER</span>
      </Cell>

      <Cell title="kpi.rpm as the assayed count">
        <span className={R1}>
          ASSAYED TODAY <b className="font-bold">{offline ? '—' : assayed}</b>
        </span>
        <span className={R2}>
          YEAR 3,927 · AMBER {amberPct != null ? `${amberPct}%` : '—'}
        </span>
      </Cell>

      {/* the posted price: the alarm is the held up arrow, never blinked */}
      <Cell
        className="shadow-[inset_2px_0_0_rgb(var(--alm)),-2px_0_10px_rgb(var(--alm)_/_0.35)]"
        title="kpi.vram as the posted price of a litre, B/L"
      >
        <div className="flex items-baseline gap-1.5">
          <span className="text-[9px] font-semibold tracking-[0.16em] text-ink-2">PRICE</span>
          <span className="cy-vt min-w-[2.2ch] text-right text-[30px] leading-[0.8] text-ink-1 [text-shadow:0_0_10px_rgb(var(--alm)_/_0.6)] min-[1280px]:text-[36px]">
            {priceBig || '—'}
          </span>
          <span className="cy-vt text-[14px] text-ink-2">B/L</span>
          <i className="cy-up" aria-label="price held up" />
        </div>
        <span className="min-w-[26ch] text-[8px] tracking-[0.08em] text-ink-3 tabular-nums">
          {offline || price == null
            ? 'NO SOURCE · PRICE HELD'
            : `${priceBig} · ${delta || '+0.00'} SINCE ${pr.openHm || clockHm(0)} · ${pct || '±0%'}`}
        </span>
      </Cell>

      <Cell className="shadow-[inset_2px_0_0_rgb(var(--col)),-2px_0_10px_rgb(var(--col)_/_0.35)]" title="the docket in post">
        <span className={R1}>
          DOCKET <b className="font-bold text-[rgb(var(--col))] [text-shadow:0_0_8px_rgb(var(--col)_/_0.55)]">{dk || '—'}</b> IN POST
        </span>
        <span className="min-w-[31ch] text-[8px] tracking-[0.08em] text-ink-3 tabular-nums">
          {offline ? 'NO SOURCE · DOCKET HELD' : `VIOLET · BOOTS GREY · TIN ${String(1940 - ((k.queue || 0) * 12) % 120)}`}
        </span>
      </Cell>

      <Cell title="the officer line">
        <span className={R1}>OFFICER EKUNDAYO</span>
        <span className="min-w-[21ch] text-[8px] tracking-[0.08em] text-ink-3 tabular-nums">
          {offline ? 'NO SOURCE' : `VIOLET · BOOTS RED · STOOPED ${tallies.stoops % 9}`}
        </span>
      </Cell>

      {/* assays / 30 min spark (hidden below 1280, as in the reference) */}
      <div className="hidden w-[230px] shrink-0 flex-col justify-center gap-1 border-r border-black/55 px-2.5 pt-0.5 min-[1280px]:flex">
        <span className="text-[8px] tracking-[0.14em] text-ink-3">ASSAYS / 30 MIN · TODAY</span>
        <div className="relative h-[20px] w-full">
          <SceneCanvas
            draw={(ctx, w, h, c) => paintSpark(ctx, w, h, c, ((c.snap && c.snap.kpiHist && c.snap.kpiHist.tps) || []).slice(-32), 'acc')}
            className="h-full w-full"
          />
        </div>
      </div>

      <Cell className="border-r-0 pr-3" title="the shift clock marches on the feed tick">
        <span className="text-[26px] font-semibold leading-none tracking-[0.04em] text-ink-1 tabular-nums min-[1280px]:text-[30px]">
          {offline ? '--:--' : clock}
        </span>
        <span className={R2}>SHIFT REPLAY ×15</span>
      </Cell>

      {/* keep the strip from overflowing mid widths */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ boxShadow: 'inset -12px 0 18px -12px rgb(0 0 0 / 0.7)' }} />
    </header>
  )
}

// Plate B — THE BUTTON EXCHANGE: the posted-price hero. A tall rate header,
// the chart (the year of closes across the break to today's steps, one
// canvas carrying ch-cv + ch-fx), the tap ticker tape, and the bottom row of
// three boards: TIN (the declared 2,000 B as a grid of buttons), STRONGBOX
// (the post's steps with runner marks) and CISTER (the tank, in litres of
// vram used-window). Bindings: kpi.vram → price/tin/cistern, kpi.queue →
// strongbox, kpi.tps → the tariff line.

import { useScene } from '../../scene/SceneRoot'
import SceneCanvas from '../../scene/Canvas'
import { paintChart, paintTicker, paintTin, paintBox, paintCistern } from './painters'
import { priceStats, tinSpentOf } from './shared'

function BoardHead({ t, sub }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[9px] font-semibold tracking-[0.14em] text-ink-2">{t}</span>
      <span className="text-[8px] tracking-[0.08em] text-ink-3 tabular-nums">{sub}</span>
    </div>
  )
}

export default function ExchangePlate() {
  const { snap } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const gpu = (snap && snap.gpu) || null
  const pr = priceStats(snap, gpu)
  const k = (snap && snap.kpi) || {}
  const qHist = ((snap && snap.kpiHist && snap.kpiHist.queue) || []).slice(-48)
  const tin = tinSpentOf(snap, pr.price)
  const spent = 2000 - tin
  const box = qHist.length ? Math.round(qHist[qHist.length - 1] * 52) : 0
  const litres =
    k.vram != null && gpu && gpu.vramTotal
      ? Math.round((k.vram / gpu.vramTotal) * 4000)
      : gpu && gpu.vram != null && gpu.vramTotal
        ? Math.round((gpu.vram / gpu.vramTotal) * 4000)
        : 0
  const worth = Math.round(litres * ((pr.price || 14.2) / 14.2) * 0.9)
  const sold = Math.round(spent * 0.42)
  const soldB = Math.round((spent / Math.max(1, pr.price || 14.2)) * 10)

  return (
    <section aria-label="The Button Exchange" className="cy-plate flex min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="cy-ph flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-2.5 pt-1.5 pb-1">
        <span className="flex items-baseline gap-1.5">
          <i className="cy-st">B</i>
          <b className="text-[12.5px] font-semibold tracking-[0.18em] text-ink-1">BUTTON EXCHANGE</b>
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-[8px] tracking-[0.12em] text-ink-3">POSTED</span>
          <span className="cy-vt text-[22px] leading-none text-ink-1 [text-shadow:0_0_10px_rgb(var(--alm)_/_0.55)] tabular-nums">
            {pr.price != null ? pr.price.toFixed(2) : '—'}
          </span>
          <span className="text-[11px] text-ink-2">B/L</span>
          <i className="cy-up" aria-label="price held up" />
          <b className="text-[12px] font-semibold text-[rgb(var(--alm))] tabular-nums">
            {pr.delta != null ? (pr.delta >= 0 ? `+${pr.delta.toFixed(2)}` : pr.delta.toFixed(2)) : '—'}
          </b>
        </span>
        <span className="hidden text-[8px] tracking-[0.08em] text-ink-3 tabular-nums min-[1280px]:block">
          {offline
            ? 'NO SOURCE · RATE HELD'
            : `OPEN ${pr.price != null ? pr.open.toFixed(2) : '—'} · ${pr.openHm} · TIN DECLARED ${pr.openHm} · 40 POSTINGS TODAY`}
        </span>
        <span className="hidden text-[8px] tracking-[0.08em] text-ink-3 tabular-nums min-[1280px]:block">
          {offline
            ? 'NO SOURCE'
            : `12-MO ${pr.lo != null ? pr.lo.toFixed(1) : '—'}–${pr.hi != null ? pr.hi.toFixed(1) : '—'} · RE-POSTED AT EACH ASSAY`}
        </span>
      </div>

      <div className="cy-win relative mx-1.5 flex min-h-[170px] flex-1 overflow-hidden min-[769px]:mx-1.5">
        <SceneCanvas draw={(ctx, w, h, c) => paintChart(ctx, w, h, c)} className="absolute inset-0 h-full w-full" />
      </div>

      <div className="cy-win relative mx-1.5 mt-1.5 h-[26px] shrink-0 overflow-hidden">
        <SceneCanvas draw={(ctx, w, h, c) => paintTicker(ctx, w, h, c)} className="absolute inset-0 h-full w-full" />
      </div>

      <div className="grid shrink-0 grid-cols-1 gap-1.5 p-1.5 min-[769px]:grid-cols-[minmax(0,35fr)_minmax(0,35fr)_minmax(0,30fr)]">
        {/* TIN */}
        <div className="cy-win flex flex-col gap-1 px-1.5 py-1.5">
          <BoardHead t="TIN" sub={offline ? 'NO SOURCE' : `DOCKET ${pr.openHm} · 1 CELL = 10 B`} />
          <div className="flex items-baseline gap-1">
            <span className="cy-vt text-[21px] leading-none text-ink-1 [text-shadow:0_0_9px_rgb(var(--dat)_/_0.45)] tabular-nums">
              {offline ? '—' : tin.toLocaleString('en-US')}
            </span>
            <span className="text-[9px] text-ink-3 tabular-nums">/ 2,000 B = {(tin / 10).toFixed(0)} L</span>
          </div>
          <div className="text-[9px] text-ink-2 tabular-nums">
            {offline ? 'NO SOURCE' : `SPENT ${spent.toLocaleString('en-US')} B · LAST ${pr.openHm} · 15 B`}
          </div>
          <div className="relative h-[42px]">
            <SceneCanvas draw={(ctx, w, h, c) => paintTin(ctx, w, h, c)} className="absolute inset-0 h-full w-full" />
          </div>
        </div>

        {/* STRONGBOX */}
        <div className="cy-win flex flex-col gap-1 px-1.5 py-1.5">
          <BoardHead t="STRONGBOX · POST 3" sub={offline ? 'NO SOURCE' : 'RUNNER 06:52'} />
          <div className="flex items-baseline gap-1">
            <span className="cy-vt text-[21px] leading-none text-ink-1 [text-shadow:0_0_9px_rgb(var(--dat)_/_0.45)] tabular-nums">
              {offline ? '—' : box.toLocaleString('en-US')}
            </span>
            <span className="text-[9px] text-ink-3 tabular-nums">
              B = {((box / Math.max(1, pr.price || 14.2)) * 10).toFixed(0)} L
            </span>
          </div>
          <div className="text-[9px] text-ink-2 tabular-nums">
            {offline ? 'NO SOURCE' : `TARIFF 40 B / TRAVELLER = ${(40 / Math.max(0.1, pr.price || 14.2)).toFixed(2)} L`}
          </div>
          <div className="relative h-[42px]">
            <SceneCanvas draw={(ctx, w, h, c) => paintBox(ctx, w, h, c)} className="absolute inset-0 h-full w-full" />
          </div>
        </div>

        {/* CISTER */}
        <div className="cy-win flex flex-col gap-1 px-1.5 py-1.5">
          <BoardHead
            t="CISTER · TAP 1"
            sub={offline ? 'NO SOURCE' : 'PUMP ON · LOAD ' + ((k.tps != null ? k.tps : 0) > 250 ? 'HIGH' : 'STEADY')}
          />
          <div className="flex items-center gap-2">
            <div className="relative h-[52px] w-[30px] shrink-0">
              <SceneCanvas draw={(ctx, w, h, c) => paintCistern(ctx, w, h, c)} className="absolute inset-0 h-full w-full" />
            </div>
            <div className="min-w-0">
              <span className="cy-vt text-[21px] leading-none text-ink-1 [text-shadow:0_0_9px_rgb(var(--col)_/_0.5)] tabular-nums">
                {offline ? '—' : litres.toLocaleString('en-US')}
              </span>
              <span className="text-[9px] text-ink-3"> / 4,000 L</span>
            </div>
          </div>
          <div className="text-[9px] text-ink-2 tabular-nums">
            {offline ? 'NO SOURCE' : `WORTH ${worth.toLocaleString('en-US')} B`}
          </div>
          <div className="text-[9px] text-ink-3 tabular-nums">SOLD TODAY {sold.toLocaleString('en-US')} L · {soldB.toLocaleString('en-US')} B</div>
        </div>
      </div>
    </section>
  )
}

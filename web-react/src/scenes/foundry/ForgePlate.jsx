// Plate B — THROUGHPUT FORGE: the decode-rate hero. A tall figure header,
// the chart (tok/s over time with the p95 latency band and the queue-depth
// underlay, one canvas), the request tape, and the bottom row of three
// boards: SERVED TOK (the integral of the decode rate as a cell grid),
// QUEUE DEPTH (the step chart with drain marks) and VRAM POOL (the tank, in
// GB against the pool, with the cost per active session). Bindings:
// kpiHist.tps/p95/queue/rpm → the chart, kpi.tps → the hero, kpi.queue →
// the queue board, kpi.vram + gpu.vramTotal + snap.sessions → the pool.

import { useScene } from '../../scene/SceneRoot'
import SceneCanvas from '../../scene/Canvas'
import { paintForge, paintTape, paintCells, paintQueueSteps, paintPool } from './painters'
import { servedTokens, samplerOf, vramStats } from './shared'

function BoardHead({ t, sub }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="whitespace-nowrap text-[9px] font-semibold tracking-[0.14em] text-ink-2">{t}</span>
      <span className="min-w-0 truncate whitespace-nowrap text-[8px] tracking-[0.08em] text-ink-3 tabular-nums">{sub}</span>
    </div>
  )
}

function Legend({ items }) {
  return (
    <span className="flex items-center gap-2">
      {items.map(([tone, label]) => (
        <span key={label} className="flex items-center gap-1 text-[8px] tracking-[0.08em] text-ink-3">
          <i
            className="inline-block h-[6px] w-[6px]"
            style={{
              background: tone === 'acc' ? 'rgb(var(--acc))' : tone === 'col' ? 'rgb(var(--col))' : tone === 'alm' ? 'rgb(var(--alm))' : 'rgb(var(--dat))',
              boxShadow: `0 0 5px rgb(var(--${tone}) / 0.6)`,
            }}
          />
          {label}
        </span>
      ))}
    </span>
  )
}

export default function ForgePlate() {
  const { snap } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const k = (snap && snap.kpi) || {}
  const gpu = (snap && snap.gpu) || null
  const vr = vramStats(snap, gpu)
  const served = servedTokens(snap)
  const smp = samplerOf(snap)
  const sessions = ((snap && snap.sessions) || []).length
  const perReq = vr.gb != null ? vr.gb / Math.max(1, sessions || 1) : null

  return (
    <section aria-label="Throughput forge" className="fd-plate flex min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="fd-ph flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-2.5 pt-1.5 pb-1">
        <span className="flex items-baseline gap-1.5">
          <i className="fd-st">B</i>
          <b className="text-[12.5px] font-semibold tracking-[0.18em] text-ink-1">THROUGHPUT FORGE</b>
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-[8px] tracking-[0.12em] text-ink-3">DECODE</span>
          <span className="fd-vt text-[22px] leading-none text-ink-1 [text-shadow:0_0_10px_rgb(var(--dat)_/_0.55)] tabular-nums">
            {k.tps != null ? Math.round(k.tps) : '—'}
          </span>
          <span className="text-[11px] text-ink-2">TOK/S</span>
        </span>
        <span className="flex items-baseline gap-1.5 tabular-nums">
          <span className="text-[9px] text-ink-3">P95</span>
          <b className="text-[12px] font-semibold text-[rgb(var(--col))]">{k.p95 != null ? Math.round(k.p95) : '—'}</b>
          <span className="text-[9px] text-ink-2">MS</span>
          <span className="text-[9px] text-ink-3">· QUEUE</span>
          <b className="text-[12px] font-semibold text-ink-1">{k.queue != null ? Math.round(k.queue) : '—'}</b>
        </span>
        <Legend
          items={[
            ['acc', 'TOK/S'],
            ['col', 'P95 MS'],
            ['dat', 'QUEUE'],
            ['alm', 'ARRIVAL'],
          ]}
        />
        <span className="hidden text-[8px] tracking-[0.08em] text-ink-3 tabular-nums min-[1280px]:block">
          {offline ? 'NO SOURCE · FORGE HELD' : `${k.rpm != null ? Math.round(k.rpm) : '—'} REQ/MIN · WINDOW ${served.samples}S`}
        </span>
      </div>

      <div className="fd-win relative mx-1.5 flex min-h-[170px] flex-1 overflow-hidden min-[769px]:mx-1.5">
        <SceneCanvas draw={(ctx, w, h, c) => paintForge(ctx, w, h, c)} className="absolute inset-0 h-full w-full" />
      </div>

      <div className="fd-win relative mx-1.5 mt-1.5 h-[26px] shrink-0 overflow-hidden">
        <SceneCanvas draw={(ctx, w, h, c) => paintTape(ctx, w, h, c)} className="absolute inset-0 h-full w-full" />
      </div>

      <div className="grid shrink-0 grid-cols-1 gap-1.5 p-1.5 min-[769px]:grid-cols-[minmax(0,35fr)_minmax(0,35fr)_minmax(0,30fr)]">
        {/* SERVED TOK (the decode integral as a cell grid) */}
        <div className="fd-win flex flex-col gap-1 px-1.5 py-1.5">
          <BoardHead t="SERVED TOK" sub={offline ? 'NO SOURCE' : `${served.samples}S WINDOW · 1 CELL = 1,000 TOK`} />
          <div className="flex items-baseline gap-1">
            <span className="fd-vt text-[21px] leading-none text-ink-1 [text-shadow:0_0_9px_rgb(var(--dat)_/_0.45)] tabular-nums">
              {offline ? '—' : served.tokens.toLocaleString('en-US')}
            </span>
            <span className="text-[9px] text-ink-3 tabular-nums">TOK SERVED</span>
          </div>
          <div className="text-[9px] text-ink-2 tabular-nums">
            {offline ? 'NO SOURCE' : 'DECODE INTEGRAL · 1 SAMPLE PER FEED TICK'}
          </div>
          <div className="relative h-[42px]">
            <SceneCanvas draw={(ctx, w, h, c) => paintCells(ctx, w, h, c)} className="absolute inset-0 h-full w-full" />
          </div>
        </div>

        {/* QUEUE DEPTH (the step chart with drain marks) */}
        <div className="fd-win flex flex-col gap-1 px-1.5 py-1.5">
          <BoardHead t="QUEUE DEPTH" sub={offline ? 'NO SOURCE' : 'DRAIN MARKS · LAST 90 TICKS'} />
          <div className="flex items-baseline gap-1">
            <span className="fd-vt text-[21px] leading-none text-ink-1 [text-shadow:0_0_9px_rgb(var(--dat)_/_0.45)] tabular-nums">
              {offline ? '—' : k.queue != null ? Math.round(k.queue) : '—'}
            </span>
            <span className="text-[9px] text-ink-3 tabular-nums">REQUESTS QUEUED</span>
          </div>
          <div className="text-[9px] text-ink-2 tabular-nums">
            {offline ? 'NO SOURCE' : 'MARKS DROP WHERE THE QUEUE DRAINED'}
          </div>
          <div className="relative h-[42px]">
            <SceneCanvas draw={(ctx, w, h, c) => paintQueueSteps(ctx, w, h, c)} className="absolute inset-0 h-full w-full" />
          </div>
        </div>

        {/* VRAM POOL */}
        <div className="fd-win flex flex-col gap-1 px-1.5 py-1.5">
          <BoardHead
            t="VRAM POOL"
            sub={offline ? 'NO SOURCE' : `COST ${perReq != null ? perReq.toFixed(2) : '—'} GB / SESSION`}
          />
          <div className="flex items-center gap-2">
            <div className="relative h-[52px] w-[30px] shrink-0">
              <SceneCanvas draw={(ctx, w, h, c) => paintPool(ctx, w, h, c)} className="absolute inset-0 h-full w-full" />
            </div>
            <div className="min-w-0">
              <span className="fd-vt text-[21px] leading-none text-ink-1 [text-shadow:0_0_9px_rgb(var(--col)_/_0.5)] tabular-nums">
                {offline ? '—' : vr.gb != null ? vr.gb.toFixed(1) : '—'}
              </span>
              <span className="text-[9px] text-ink-3"> / {vr.total != null ? vr.total.toFixed(0) : '—'} GB</span>
            </div>
          </div>
          <div className="text-[9px] text-ink-2 tabular-nums">
            {offline ? 'NO SOURCE' : `KV CACHE ${smp.cache != null ? Math.round(smp.cache) : '—'}% · ${sessions} SESSIONS`}
          </div>
          <div className="text-[9px] text-ink-3 tabular-nums">
            {offline ? 'NO SOURCE' : `REINGEST ${smp.reingest != null ? Math.round(smp.reingest) : '—'}% · VRAM ÷ SESSIONS`}
          </div>
        </div>
      </div>
    </section>
  )
}

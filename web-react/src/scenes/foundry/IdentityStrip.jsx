// Identity strip (row T): the top beam of the foundry wall. FOUNDRY title /
// QUEUE DEPTH / REQ RATE / VRAM COST (the big VT323 number — the memory a
// request occupies) / DECODE / ENGINES / the decode spark (hidden below
// 1280 px) / the runtime clock. Bindings: kpi.queue → the queue depth,
// kpi.rpm → the arrival rate, kpi.vram → the cost hero, kpi.tps / ttft / p95
// → the decode cell, the engine set → the engines cell, tick → clock.

import { useScene } from '../../scene/SceneRoot'
import SceneCanvas from '../../scene/Canvas'
import { paintSpark } from './painters'
import { clockHm, vramStats, queueRail, activeModelOf } from './shared'

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
  const gpu = (snap && snap.gpu) || null
  const vr = vramStats(snap, gpu)
  const rail = queueRail(snap)
  const act = activeModelOf(snap)
  const engines = ((snap && snap.engines) || [])
  const upN = engines.filter((e) => e && e.up !== false).length
  const total = ((snap && snap.requests) || []).length
  const clock = clockHm(tick)
  const gbS = vr.gb != null ? vr.gb.toFixed(2) : null
  const delta = vr.delta != null ? (vr.delta >= 0 ? `+${vr.delta.toFixed(2)}` : vr.delta.toFixed(2)) : null
  const pct = vr.pct != null ? `${vr.pct.toFixed(1)}%` : null

  return (
    <header
      aria-label="Identity strip"
      className="fd-strip relative flex h-[54px] shrink-0 items-stretch overflow-hidden bg-pan shadow-[inset_0_-1px_0_rgb(0_0_0_/_0.5),0_2px_6px_rgb(0_0_0_/_0.6)] min-[769px]:h-[56px]"
      style={{
        backgroundImage: 'linear-gradient(180deg, rgb(0 0 0 / 0.3), rgb(0 0 0 / 0.45)), rgb(var(--pan))',
        borderBottom: '1px solid rgb(0 0 0 / 0.7)',
      }}
    >
      <Cell className="pl-3">
        <span className="whitespace-nowrap text-[8px] tracking-[0.14em] text-ink-3">
          TOKEN FOUNDRY · REQUEST GRID<span className="hidden min-[1536px]:inline"> · LOCAL LLM RUNTIME</span>
        </span>
        <span className="min-w-0 max-w-full truncate text-[8px] tracking-[0.1em] text-ink-3">
          MODEL {offline ? '—' : act.model || '—'} · <span className="text-ink-2">{clock}</span>
        </span>
      </Cell>

      <Cell title="kpi.queue as the queue depth">
        <span className={R1}>
          QUEUE <b className="font-bold">{offline ? '—' : k.queue != null ? Math.round(k.queue) : '—'}</b> DEEP
        </span>
        <span className={R2}>SLOTS {offline ? '—' : rail.lit}/14</span>
      </Cell>

      <Cell title="kpi.rpm as the arrival rate">
        <span className={R1}>
          REQ/MIN <b className="font-bold">{offline ? '—' : k.rpm != null ? Math.round(k.rpm) : '—'}</b>
        </span>
        <span className={R2}>LEDGER {offline ? '—' : total}</span>
      </Cell>

      {/* the vram cost hero: the memory a request occupies, GB + % of pool */}
      <Cell
        className="shadow-[inset_2px_0_0_rgb(var(--dat)),-2px_0_10px_rgb(var(--dat)_/_0.3)]"
        title="kpi.vram as the cost of a request, GB of the pool"
      >
        <div className="flex items-baseline gap-1.5">
          <span className="text-[9px] font-semibold tracking-[0.16em] text-ink-2">VRAM COST</span>
          <span className="fd-vt min-w-[2.2ch] text-right text-[30px] leading-[0.8] text-ink-1 [text-shadow:0_0_10px_rgb(var(--dat)_/_0.6)] min-[1280px]:text-[36px]">
            {gbS || '—'}
          </span>
          <span className="fd-vt text-[14px] text-ink-2">GB</span>
        </div>
        <span className="min-w-0 max-w-full truncate text-[8px] tracking-[0.08em] text-ink-3 tabular-nums">
          {offline || gbS == null
            ? 'NO SOURCE · FIGURE HELD'
            : `${pct} POOL · ${delta || '+0.00'} GB · SINCE ${vr.openHm || clockHm(0)}`}
        </span>
      </Cell>

      <Cell className="shadow-[inset_2px_0_0_rgb(var(--col)),-2px_0_10px_rgb(var(--col)_/_0.35)]" title="decode rate + latency">
        <span className={R1}>
          DECODE <b className="font-bold text-[rgb(var(--col))] [text-shadow:0_0_8px_rgb(var(--col)_/_0.55)]">{offline ? '—' : k.tps != null ? Math.round(k.tps) : '—'}</b> TOK/S
        </span>
        <span className="min-w-0 max-w-full truncate text-[8px] tracking-[0.08em] text-ink-3 tabular-nums">
          {offline ? 'NO SOURCE · FIGURE HELD' : `TTFT ${k.ttft != null ? Math.round(k.ttft) : '—'} MS · P95 ${k.p95 != null ? Math.round(k.p95) : '—'} MS`}
        </span>
      </Cell>

      <Cell title="the engine set">
        <span className={R1}>
          ENGINES <b className="font-bold">{offline ? '—' : `${upN}/${engines.length || '—'}`}</b> UP
        </span>
        <span className={R2}>{offline ? 'NO SOURCE' : rail.down ? 'DEGRADED · HELD' : 'NOMINAL'}</span>
      </Cell>

      {/* decode spark (hidden below 1280) */}
      <div className="hidden w-[230px] shrink-0 flex-col justify-center gap-1 border-r border-black/55 px-2.5 pt-0.5 min-[1280px]:flex">
        <span className="text-[8px] tracking-[0.14em] text-ink-3">DECODE TOK/S · LAST 32 TICKS</span>
        <div className="relative h-[20px] w-full">
          <SceneCanvas
            draw={(ctx, w, h, c) => paintSpark(ctx, w, h, c, ((c.snap && c.snap.kpiHist && c.snap.kpiHist.tps) || []).slice(-32), 'acc')}
            className="h-full w-full"
          />
        </div>
      </div>

      <Cell className="border-r-0 pr-3" title="the runtime clock marches on the feed tick">
        <span className="text-[26px] font-semibold leading-none tracking-[0.04em] text-ink-1 tabular-nums min-[1280px]:text-[30px]">
          {offline ? '--:--' : clock}
        </span>
        <span className={R2}>FEED {offline ? 'HELD' : 'LIVE'}</span>
      </Cell>

      {/* keep the strip from overflowing mid widths */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ boxShadow: 'inset -12px 0 18px -12px rgb(0 0 0 / 0.7)' }} />
    </header>
  )
}

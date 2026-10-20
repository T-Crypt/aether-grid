// Logit Spectrum gauge rails: two dense text-module columns flanking the
// bezel viewport. Left rail carries the detection chain (lock, alert index,
// think tokens, phase activity, class mix, the anomaly log); right rail the
// reasoning trace (think share, the two ratio dials, the engine bars, the
// request pipeline, latency). Hidden below 769 px. Every row is min-w-0 +
// truncate; nothing here owns a timer.

import SceneCanvas from '../../scene/Canvas'
import { paintPhaseSpec, paintSeries, paintEngines } from './painters'
import {
  lockScore,
  alertIndex,
  thinkRate,
  phaseMix,
  classMix,
  history12,
  engineLevels,
  pipelineStages,
  sharesOf,
  latOf,
  metaOf,
  grp,
} from './shared'

function Mod({ title, right, children }) {
  return (
    <section className="sp-mod min-w-0 shrink-0">
      <div className="sp-mod-h">
        <span className="min-w-0 truncate">{title}</span>
        {right && <span className="shrink-0 tabular-nums text-ink-3">{right}</span>}
      </div>
      <div className="min-w-0 px-2 py-1">{children}</div>
    </section>
  )
}

function BigVal({ v, unit, tone }) {
  const cls = tone === 'amber' ? 'text-col' : tone === 'alarm' ? 'text-alm' : tone === 'green' ? 'text-dat' : 'text-ink-1'
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <span className={`sp-vt min-w-0 truncate text-[19px] leading-none tabular-nums ${cls}`}>{v}</span>
      {unit && <span className="shrink-0 text-[8.5px] tracking-[0.14em] text-ink-3">{unit}</span>}
    </div>
  )
}

// Ratio dial: one needle over a 0..100 percent arc. The needle angle is the
// share itself, so a held feed holds the needle.
function Dial({ label, pct, title }) {
  const a = (clamp01(pct != null ? pct / 100 : 0) * Math.PI) - Math.PI / 2
  const cx = 30
  const cy = 30
  const nx = cx + Math.cos(a) * 20
  const ny = cy + Math.sin(a) * 20
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5" title={title}>
      <svg viewBox="0 0 60 60" className="h-[44px] w-[44px] shrink-0" aria-hidden="true">
        <path d="M 8 30 A 22 22 0 0 1 52 30" fill="none" stroke="rgb(var(--acc) / 0.25)" strokeWidth="1" />
        <path d="M 12 30 A 18 18 0 0 1 48 30" fill="none" stroke="rgb(var(--acc) / 0.12)" strokeWidth="1" />
        {[0, 25, 50, 75, 100].map((t) => {
          const ra = (t / 100) * Math.PI - Math.PI / 2
          return (
            <line key={t} x1={cx + Math.cos(ra) * 19} y1={cy + Math.sin(ra) * 19} x2={cx + Math.cos(ra) * 23} y2={cy + Math.sin(ra) * 23} stroke="rgb(var(--acc) / 0.5)" strokeWidth="1" />
          )
        })}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="rgb(var(--col) / 0.9)" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="2" fill="rgb(var(--acc) / 0.8)" />
      </svg>
      <div className="min-w-0">
        <div className="truncate text-[8px] tracking-[0.14em] text-ink-3">{label}</div>
        <div className="truncate text-[14px] tabular-nums text-ink-1">
          {pct != null ? pct.toFixed(0) : '—'} <span className="text-[8px] text-ink-3">%</span>
        </div>
      </div>
    </div>
  )
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

export function LeftRail({ snap, conductor }) {
  const lock = lockScore(snap, conductor)
  const ai = alertIndex(snap, conductor)
  const think = thinkRate(snap)
  const phases = phaseMix(snap, conductor)
  const mix = classMix(snap)
  const hist = history12(snap)
  const offline = !snap || snap.mode === 'offline'
  return (
    <aside className="hidden w-[208px] min-w-0 shrink-0 flex-col gap-1.5 overflow-y-auto overflow-x-hidden p-1.5 min-[769px]:flex" aria-label="Detection modules">
      <Mod title="REASONING LOCK" right={offline ? 'HOLD' : lock.confirmed ? 'LOCKED' : 'WATCH'}>
        <BigVal v={offline ? '—' : lock.score != null ? lock.score : '—'} unit="% MTP" tone={lock.confirmed && !offline ? 'amber' : 'green'} />
      </Mod>
      <Mod title="ALERT INDEX" right={offline ? 'HOLD' : ai.alerts.length ? `${ai.alerts.length} ACTIVE` : 'CLEAR'}>
        <BigVal v={offline ? '—' : ai.index} unit="/ 100" tone={ai.index >= 25 ? 'alarm' : ''} />
      </Mod>
      <Mod title="THINK · TOKENS" right={think.rate != null && !offline ? `${Math.round(think.rate)} TOK/S` : 'RATE —'}>
        <BigVal v={offline ? '—' : think.total != null ? grp(think.total) : '—'} unit="TOK" />
      </Mod>
      <Mod title="PHASE ACTIVITY" right={offline ? 'HOLD' : '4 PHASES'}>
        <div className="flex min-w-0 flex-col gap-[4px]">
          {phases.map((p) => (
            <div key={p.name} className="flex min-w-0 items-center gap-1.5">
              <span className="w-[52px] shrink-0 truncate text-[7.5px] tracking-[0.1em] text-ink-3">{p.name}</span>
              <div className="h-[4px] min-w-0 flex-1 overflow-hidden rounded-sm bg-acc/10" aria-hidden="true">
                <div className={`h-full ${p.v > 0.8 ? 'bg-col/80' : 'bg-acc/70'} transition-[width] duration-300 ease-out`} style={{ width: `${Math.round(offline ? 0 : p.v * 100)}%` }} />
              </div>
              <span className="w-[42px] shrink-0 truncate text-right text-[7.5px] tabular-nums text-ink-3">{offline ? '—' : p.src}</span>
            </div>
          ))}
        </div>
      </Mod>
      <Mod title="SPECTRUM · PHASE SLICE" right="48">
        <SceneCanvas draw={paintPhaseSpec} label="Phase slice, think decode mtp lobes" className="h-[28px] w-full" />
      </Mod>
      <Mod title="CLASS MIX · BUS" right={offline ? 'HOLD' : 'LAST 40'}>
        <div className="flex min-w-0 flex-col gap-[3px]">
          {mix.map((b) => (
            <div key={b.name} className="flex min-w-0 items-center gap-1.5">
              <span className="w-[74px] shrink-0 truncate text-[7.5px] tracking-[0.1em] text-ink-3">{b.name}</span>
              <div className="h-[4px] min-w-0 flex-1 overflow-hidden rounded-sm bg-acc/10" aria-hidden="true">
                <div className={`h-full ${b.v > 45 ? 'bg-col/80' : 'bg-dat/70'} transition-[width] duration-300 ease-out`} style={{ width: `${Math.round(offline ? 0 : b.v)}%` }} />
              </div>
              <span className="w-[26px] shrink-0 text-right text-[8px] tabular-nums text-ink-2">{offline ? '—' : b.n}</span>
            </div>
          ))}
        </div>
      </Mod>
      <Mod title="ANOMALY LOG" right="LAST 12">
        <div className="flex min-w-0 flex-col">
          {hist.length === 0 && <span className="truncate text-[8.5px] text-ink-3">NO EVENTS · FEED HELD</span>}
          {hist.map((e) => (
            <div key={e.id} className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[8.5px] leading-[13px]">
              <span className="shrink-0 tabular-nums text-ink-3">{e.t}</span>
              <span className={`min-w-0 flex-1 truncate tabular-nums ${e.level === 'err' || e.level === 'alert' ? 'text-alm' : e.level === 'warn' ? 'text-dat' : 'text-ink-2'}`}>
                {e.msg}
              </span>
            </div>
          ))}
        </div>
      </Mod>
      <Mod title="ALERT STATE" right="LIVE">
        <div className="truncate text-[8.5px] tabular-nums text-ink-2">
          {offline ? 'HOLD · NO SOURCE' : ai.alerts.length ? ai.alerts[0].toUpperCase().slice(0, 40) : 'NONE · NOMINAL'}
        </div>
      </Mod>
    </aside>
  )
}

export function RightRail({ snap, conductor }) {
  const engines = engineLevels(snap)
  const pipe = pipelineStages(snap, conductor)
  const lat = latOf(snap)
  const meta = metaOf(snap)
  const shares = sharesOf(snap, conductor)
  const offline = lat.offline
  return (
    <aside className="hidden w-[232px] min-w-0 shrink-0 flex-col gap-1.5 overflow-y-auto overflow-x-hidden p-1.5 min-[769px]:flex" aria-label="Reasoning trace modules">
      <Mod title="THINK SHARE" right={offline ? 'HOLD' : 'THIS TICK'}>
        <div className="h-[5px] w-full overflow-hidden rounded-sm bg-acc/10" aria-hidden="true">
          <div className="h-full bg-dat/80 transition-[width] duration-300 ease-out" style={{ width: `${Math.round(shares.thinkShare || 0)}%` }} />
        </div>
        <div className="mt-0.5 truncate text-[7.5px] tracking-[0.1em] text-ink-3">
          {offline ? 'NO SOURCE' : `THINK ${Math.round(shares.thinkRate)} TOK/S · DECODE ${Math.round(shares.tps)} TOK/S`}
        </div>
      </Mod>
      <Mod title="RATIO DIALS" right="NEEDLES">
        <div className="flex min-w-0 items-center justify-between gap-1">
          <Dial label="THINK" pct={shares.thinkShare} title="Think rate over generated tokens, percent" />
          <Dial label="DECODE" pct={shares.decodeShare} title="Decode activity over prefill activity, percent" />
        </div>
      </Mod>
      <Mod title="MTP ACCEPT · LAST 60" right="TICKS">
        <SceneCanvas draw={(ctx, w, h, c) => paintSeries(ctx, w, h, c, 'mtp', 'acc')} label="MTP acceptance sparkline" className="h-[24px] w-full" />
      </Mod>
      <Mod title="ENGINES · DECODE TOK/S" right={`${engines.filter((e) => e.up).length}/${engines.length}`}>
        <SceneCanvas draw={paintEngines} label="Per-engine decode rate bars" className="h-[40px] w-full" />
        <div className="flex justify-between gap-1 text-[7px] tabular-nums text-ink-3">
          {engines.slice(0, 6).map((e) => (
            <span key={e.id} className={`min-w-0 truncate ${e.up ? '' : 'text-alm'}`}>{e.id} {e.up ? `${e.tps != null ? Math.round(e.tps) : '—'}` : 'DOWN'}</span>
          ))}
        </div>
      </Mod>
      <Mod title="PIPELINE · 5 STG" right="LIT BY STATE">
        <div className="flex min-w-0 flex-col gap-[2px]">
          {pipe.map((s) => (
            <div key={s.name} className="flex min-w-0 items-center justify-between gap-2 text-[8px] tracking-[0.08em]">
              <span className="min-w-0 truncate text-ink-2">{s.name}</span>
              <span className={`shrink-0 ${s.state === 'RUN' || s.state === 'DONE' ? 'text-dat' : s.state === 'WAIT' ? 'text-col' : s.state === 'HOLD' ? 'text-alm' : 'text-ink-3'}`}>{s.state}</span>
            </div>
          ))}
        </div>
      </Mod>
      <Mod title="LATENCY · TTFT / P95" right="MS">
        <SceneCanvas draw={(ctx, w, h, c) => paintSeries(ctx, w, h, c, 'p95', 'dat')} label="P95 latency sparkline" className="h-[16px] w-full" />
        <div className="mt-0.5 flex min-w-0 justify-between gap-2 text-[8.5px] tabular-nums">
          <span className="min-w-0 truncate text-ink-3">TTFT <span className="text-ink-1">{lat.ttft != null ? lat.ttft : '—'}</span></span>
          <span className="shrink-0 text-ink-3">P95 <span className="text-ink-1">{lat.p95 != null ? lat.p95 : '—'}</span></span>
        </div>
      </Mod>
      <Mod title="RUNTIME" right={meta.rpm}>
        <div className="min-w-0 truncate text-[8.5px] tabular-nums text-ink-3">{offline ? 'HELD · NO SOURCE' : `${meta.up} · ${meta.ledger}`}</div>
      </Mod>
    </aside>
  )
}

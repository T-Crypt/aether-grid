// The bottom band of the foundry wall: five small plates.
//   A MODEL TALLY   — requests grouped by model, the arrival rate, marks
//   D EVENT LOG     — the feed's event stream, newest at the bottom
//   E GPU DRAW      — power, util bar, temp, vram figures
//   F SAMPLER       — mtp acceptance, tpot, kv cache, reingest
//   G PRESSURE LADDER — guard lines against the live figures
// On phones the band stacks; the ladder drops first (Scene.jsx hides
// nothing here — LadderPlate renders its own hidden-on-phone wrapper).

import { useEffect, useRef } from 'react'
import { useScene } from '../../scene/SceneRoot'
import SceneCanvas from '../../scene/Canvas'
import { paintSpark } from './painters'
import { eventRows, gpuStats, modelTally, pressureLines, samplerOf } from './shared'

function PlateHead({ letter, t, sub, className = '' }) {
  return (
    <div className={`flex items-baseline justify-between gap-2 px-2 pt-1.5 pb-0.5 ${className}`}>
      <span className="flex items-baseline gap-1.5">
        <i className="fd-st">{letter}</i>
        <b className="text-[10.5px] font-semibold tracking-[0.16em] text-ink-1 whitespace-nowrap">{t}</b>
      </span>
      <span className="truncate text-[8px] tracking-[0.06em] text-ink-3 tabular-nums">{sub}</span>
    </div>
  )
}

function Bar({ label, pct, tone = 'acc' }) {
  const cls = tone === 'col' ? 'bg-[rgb(var(--col))] shadow-[0_0_5px_rgb(var(--col)_/_0.5)]' : 'bg-[rgb(var(--acc))] shadow-[0_0_5px_rgb(var(--acc)_/_0.5)]'
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-[52px] shrink-0 text-[8.5px] tracking-[0.08em] text-ink-3">{label}</span>
      <div className="h-[5px] min-w-[40px] flex-1 bg-black/40">
        <div className={`h-full ${cls} transition-[width] duration-300 ease-out`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function ModelTallyPlate() {
  const { snap } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const t = modelTally(snap)
  const peak = t.models.length ? Math.max(...t.models.map(([, n]) => n)) : 0

  return (
    <section aria-label="Model tally" className="fd-plate flex min-h-0 min-w-0 flex-col overflow-hidden">
      <PlateHead letter="A" t="MODEL TALLY" sub={offline ? 'NO SOURCE' : `BY RECORDS · ${t.total} LEDGERED`} />
      <div className="flex min-h-0 flex-1 flex-col gap-[3px] px-2 pb-1.5">
        {t.models.length === 0 && <Bar label="NO MODEL" pct={0} />}
        {t.models.map(([m, n]) => (
          <Bar key={m} label={m.toUpperCase().slice(0, 8)} pct={offline ? 0 : (n / Math.max(1, peak)) * 100} />
        ))}
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="text-[8px] tracking-[0.1em] text-ink-3">REQ/MIN</span>
          <span className="fd-vt text-[22px] leading-none text-ink-1 [text-shadow:0_0_8px_rgb(var(--dat)_/_0.45)] tabular-nums">
            {offline ? '—' : t.rpm != null ? t.rpm : '—'}
          </span>
          <span className="text-[8px] tracking-[0.06em] text-ink-3 tabular-nums">ARRIVAL RATE · LIVE</span>
        </div>
        <div className="relative h-[34px] min-h-[26px]">
          <SceneCanvas
            draw={(ctx, w, h, c) => paintSpark(ctx, w, h, c, ((c.snap && c.snap.kpiHist && c.snap.kpiHist.rpm) || []).slice(-60), 'acc')}
            className="absolute inset-0 h-full w-full"
          />
        </div>
        <div className="text-[8px] tracking-[0.06em] text-ink-3 tabular-nums">ARRIVALS / MIN · LAST 60 TICKS</div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------

export function EventLogPlate() {
  const { snap } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const entries = eventRows(snap)
  // One-shot boundary like the ledger: only unseen event ids flash; the
  // first paint stays silent (mounting is not an event).
  const seen = useRef(new Set())
  const announced = useRef(false)
  for (const e of entries) {
    e.flash = announced.current && e.id != null && !seen.current.has(e.id)
  }
  // Post-commit boundary update (see InspectorPlate: render-time writes eat
  // the one-shot under double-render).
  useEffect(() => {
    announced.current = true
    seen.current = new Set(entries.map((e) => e.id))
  })

  return (
    <section aria-label="Event log" className="fd-plate flex min-h-0 min-w-0 flex-col overflow-hidden">
      <PlateHead letter="D" t="EVENT LOG" sub={offline ? 'NO SOURCE' : 'FEED EVENTS · LAST 26 · NEWEST LOW'} />
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-[1.5px] overflow-hidden px-2 pb-1.5 [mask-image:linear-gradient(to_bottom,transparent_0,#000_14px)]">
        {entries.length === 0 && (
          <div className="flex h-full items-center justify-center text-[9px] tracking-[0.12em] text-ink-3">NO SOURCE · LOG HELD</div>
        )}
        {entries.map((e) => {
          const fresh = !!e.flash
          const tone =
            e.cls === 'v'
              ? 'text-[rgb(var(--col))] [text-shadow:0_0_7px_rgb(var(--col)_/_0.5)]'
              : e.cls === 'a'
                ? 'text-[rgb(var(--acc))] [text-shadow:0_0_7px_rgb(var(--acc)_/_0.5)]'
                : e.cls === 'w'
                  ? 'text-[rgb(var(--alm))] [text-shadow:0_0_7px_rgb(var(--alm)_/_0.5)]'
                  : 'text-ink-2'
          return (
            <div key={e.id} className={'flex gap-1.5 whitespace-nowrap text-[9.5px] leading-[12.5px] ' + (fresh ? 'fd-flash' : '')}>
              <span className="fd-vt shrink-0 text-[11px] text-ink-3 tabular-nums">{e.t}</span>
              <span className={
                'fd-vt shrink-0 text-[11px] ' +
                (e.tag === 'KV'
                  ? 'text-[rgb(var(--col))]'
                  : e.tag === 'GPU'
                    ? 'text-[rgb(var(--dat))]'
                    : e.tag === 'FLOW'
                      ? 'text-[rgb(var(--acc))]'
                      : e.tag === 'QUEUE'
                        ? 'text-[rgb(var(--alm))]'
                        : 'text-ink-3')
              }>
                {e.tag}
              </span>
              <span className={'truncate ' + tone}>{e.tx}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------

export function GpuDrawPlate() {
  const { snap } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const g = gpuStats(snap, snap && snap.gpu)
  const util = g.util != null ? Math.round(g.util) : null
  const trace = ((snap && snap.kpiHist && snap.kpiHist.tps) || []).slice(-48)

  return (
    <section aria-label="GPU draw" className="fd-plate flex min-h-0 min-w-0 flex-col overflow-hidden">
      <PlateHead letter="E" t="GPU DRAW" sub={offline ? 'NO SOURCE' : 'NVIDIA-SMI · 1 HZ'} />
      <div className="flex min-h-0 flex-1 flex-col gap-1 px-2 pb-1.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[8px] tracking-[0.1em] text-ink-3">POWER</span>
          <span className="fd-vt text-[20px] leading-none text-ink-1 tabular-nums">{offline ? '—' : g.power != null ? Math.round(g.power) : '—'}</span>
          <span className="text-[9px] text-ink-2 tabular-nums">{offline ? '' : `W · UTIL ${util != null ? util : '—'}% · ${g.temp != null ? Math.round(g.temp) : '—'}°C`}</span>
        </div>
        <div className="relative h-[7px] w-full bg-black/45">
          <div className="absolute inset-y-0 left-0 bg-[rgb(var(--acc))] shadow-[0_0_6px_rgb(var(--acc)_/_0.6)] transition-[width] duration-300 ease-out" style={{ width: `${offline || util == null ? 0 : util}%` }} />
          <div className="absolute inset-y-[-2px] left-[85%] w-px bg-[rgb(var(--col))]" title="85% marker" />
        </div>
        <div className="relative h-[34px] min-h-[24px]">
          <SceneCanvas draw={(ctx, w, h, c) => paintSpark(ctx, w, h, c, trace, 'acc')} className="absolute inset-0 h-full w-full" />
        </div>
        <div className="text-[9px] text-ink-3 tabular-nums">DECODE TRACE · LAST 48 TICKS</div>
        <div className="text-[9px] text-ink-2 tabular-nums">
          {offline ? 'NO SOURCE' : `VRAM ${g.vram != null ? g.vram.toFixed(1) : '—'} / ${g.total != null ? g.total.toFixed(0) : '—'} GB`}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------

export function SamplerPlate() {
  const { snap } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const s = samplerOf(snap)

  return (
    <section aria-label="Sampler" className="fd-plate flex min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex items-baseline justify-between gap-2 px-2 pt-1.5 pb-0.5">
        <span className="flex items-baseline gap-1.5">
          <i className="fd-st">F</i>
          <b className="text-[10.5px] font-semibold tracking-[0.16em] text-ink-1">SAMPLER</b>
        </span>
        <span className="rounded-full border border-black/60 bg-[rgb(0_0_0_/_0.35)] px-1.5 text-[8px] tracking-[0.06em] text-ink-3">
          {offline ? 'NO SOURCE' : `MTP ${s.mtp != null ? Math.round(s.mtp) : '—'}% ACCEPT`}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 px-2 pb-1.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[8px] tracking-[0.1em] text-ink-3">MTP</span>
          <span className="fd-vt text-[19px] leading-none text-ink-1 tabular-nums">{offline ? '—' : s.mtp != null ? Math.round(s.mtp) : '—'}</span>
          <span className="text-[9px] text-ink-2 tabular-nums">{offline ? '' : '% DRAFT ACCEPTED'}</span>
        </div>
        <Bar label="ACCEPT" pct={offline || s.mtp == null ? 0 : s.mtp} />
        <Bar label="KV CACHE" pct={offline || s.cache == null ? 0 : s.cache} tone="col" />
        <div className="text-[9px] text-ink-2 tabular-nums">
          {offline ? 'NO SOURCE' : `TPOT ${s.tpot != null ? Math.round(s.tpot) : '—'} MS/TOK`}
        </div>
        <div className="text-[9px] text-ink-3 tabular-nums">
          {offline ? 'NO SOURCE' : `REINGEST ${s.reingest != null ? Math.round(s.reingest) : '—'}% OF TOKENS`}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------

export function LadderPlate() {
  const { snap, conductor } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const lines = pressureLines(snap, snap && snap.gpu)
  const errN = offline ? 0 : ((snap.events || []).filter((e) => e && (e.level === 'err' || e.level === 'alert'))).length
  const alert = conductor.alert || 0
  return (
    <section
      aria-label="Pressure ladder"
      className="fd-plate hidden min-h-0 min-w-0 flex-col overflow-hidden min-[769px]:flex"
    >
      <PlateHead letter="G" t="PRESSURE LADDER" sub="GUARD LINES" />
      <div className="flex min-h-0 flex-1 flex-col gap-[4px] px-2 pb-1.5">
        {/* each guard as a bar read against its own limit: full bar = at the
            line, the alarm colour once the line is crossed at its critical
            level */}
        {lines.map((l) => {
          const over = l.on && l.crit
          const tone = over ? 'alm' : l.on ? 'col' : 'acc'
          return (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className="w-[64px] shrink-0 text-[8px] tracking-[0.05em] text-ink-2">{l.label}</span>
              <div className="h-[5px] min-w-[24px] flex-1 bg-black/40">
                <div
                  className="h-full transition-[width] duration-300 ease-out"
                  style={{
                    width: `${Math.max(2, Math.min(100, l.fill))}%`,
                    background: tone === 'alm' ? 'rgb(var(--alm))' : tone === 'col' ? 'rgb(var(--col))' : 'rgb(var(--acc))',
                    boxShadow: `0 0 5px rgb(var(--${tone}) / 0.55)`,
                    opacity: l.on ? 1 : 0.5,
                  }}
                />
              </div>
              <span
                className={
                  'w-[38px] shrink-0 text-right text-[8.5px] font-semibold tabular-nums ' +
                  (over ? 'text-[rgb(var(--alm))]' : l.on ? 'text-[rgb(var(--col))]' : 'text-ink-3')
                }
              >
                {l.v}
              </span>
            </div>
          )
        })}
        <div
          className={
            'border-l-2 px-2 py-1 text-[9px] leading-[12px] ' +
            (alert > 0.45
              ? 'border-[rgb(var(--alm))] bg-[rgb(var(--alm)_/_0.1)] text-[rgb(var(--alm))] [text-shadow:0_0_8px_rgb(var(--alm)_/_0.6)]'
              : 'border-[rgb(var(--col)_/_0.5)] bg-[rgb(0_0_0_/_0.25)] text-ink-2')
          }
        >
          {alert > 0.45 ? 'ANOMALY PRESSURE HIGH · GUARDS LATCHED' : 'ALL GUARDS WITHIN LINE'}
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[8px] tracking-[0.04em] text-ink-3">
          <span className={errN > 8 ? 'font-semibold text-[rgb(var(--alm))]' : ''}>
            ERR EVENTS {offline ? '—' : errN} IN RING
          </span>
          <span>VRAM 75/90 · PWR 382 W · Q 12 · KV 85%</span>
        </div>
      </div>
    </section>
  )
}

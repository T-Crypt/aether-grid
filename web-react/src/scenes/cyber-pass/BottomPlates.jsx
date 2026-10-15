// The bottom band of the booth wall: five small plates.
//   A DAILY TALLIES  — lamp/boot counts as bars, the stoops as tally marks
//   D POST LOG       — the shift's events, newest at the bottom
//   E GENERATOR      — load, the bulb row, bus voltage, fuel
//   F WEATHER        — wind vane + cinder-fall bins (decorative, flagged)
//   G MANUAL CLAUSE  — the officer's manual excerpt (decorative; flagged)
// On phones the band stacks; the manual clause drops first (Scene.jsx hides
// nothing here — ClausePlate renders its own hidden-on-phone wrapper).

import { useEffect, useRef } from 'react'
import { useScene } from '../../scene/SceneRoot'
import SceneCanvas from '../../scene/Canvas'
import { paintSpark, paintTally, paintWeather } from './painters'
import { genStats, weatherOf, postLog, talliesOf, CLAUSE } from './shared'
function PlateHead({ letter, t, sub, className = '' }) {
  return (
    <div className={`flex items-baseline justify-between gap-2 px-2 pt-1.5 pb-0.5 ${className}`}>
      <span className="flex items-baseline gap-1.5">
        <i className="cy-st">{letter}</i>
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
        <div className={`h-full ${cls}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function TalliesPlate() {
  const { snap } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const t = talliesOf(snap)
  const total = Math.max(1, t.amb + t.vio)
  const sessions = ((snap && snap.sessions) || [])
  const ranks = { 0: 0, 1: 0, 2: 0, 3: 0 }
  for (const s of sessions) {
    const used = s && s.used != null ? s.used : 0
    ranks[Math.max(0, Math.min(3, Math.floor(used / 400)))]++
  }
  const rTot = Math.max(1, sessions.length)
  const bootLabels = ['GREY', 'TAN', 'RED', 'BLACK']

  return (
    <section aria-label="Daily tallies" className="cy-plate flex min-h-0 min-w-0 flex-col overflow-hidden">
      <PlateHead letter="A" t="DAILY TALLIES" sub={offline ? 'NO SOURCE' : 'YEAR 3,927 · POST 3'} />
      <div className="flex min-h-0 flex-1 flex-col gap-[3px] px-2 pb-1.5">
        <Bar label="AMBER" pct={offline ? 0 : (t.amb / total) * 100} />
        <Bar label="VIOLET" pct={offline ? 0 : (t.vio / total) * 100} tone="col" />
        <div className="mt-0.5 flex flex-col gap-[3px]">
          {bootLabels.map((b, i) => (
            <Bar key={b} label={b + ' SESSION'} pct={offline ? 0 : (ranks[i] / rTot) * 100} />
          ))}
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[8px] tracking-[0.1em] text-ink-3">STAMPS</span>
          <span className="cy-vt text-[22px] leading-none text-ink-1 [text-shadow:0_0_8px_rgb(var(--dat)_/_0.45)] tabular-nums">
            {offline ? '—' : t.stoops}
          </span>
          <span className="text-[8px] tracking-[0.06em] text-ink-3 tabular-nums">STAMPED 0000-0918</span>
        </div>
        <div className="relative h-[34px] min-h-[26px]">
          <SceneCanvas draw={(ctx, w, h, c) => paintTally(ctx, w, h, c)} className="absolute inset-0 h-full w-full" />
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------

export function PostLogPlate() {
  const { snap } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const entries = postLog(snap)
  // One-shot boundary like the assay plates: only unseen event ids flash;
  // the first paint stays silent (mounting is not an event).
  const seen = useRef(new Set())
  const announced = useRef(false)
  for (const e of entries) {
    e.flash = announced.current && e.id != null && !seen.current.has(e.id)
  }
  // Post-commit boundary update (see AssayPlate: render-time writes eat
  // the one-shot under double-render).
  useEffect(() => {
    announced.current = true
    seen.current = new Set(entries.map((e) => e.id))
  })
  const shift = snap && snap.host && snap.host.uptime != null ? (11 + Math.floor(snap.host.uptime / 86400)) % 24 : 11

  return (
    <section aria-label="Post log" className="cy-plate flex min-h-0 min-w-0 flex-col overflow-hidden">
      <PlateHead letter="D" t="POST LOG" sub={offline ? 'NO SOURCE' : `SHIFT ${shift} · T-2 · REPLAY ×15`} />
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-[1.5px] overflow-hidden px-2 pb-1.5">
        {entries.length === 0 && (
          <div className="flex h-full items-center justify-center text-[9px] tracking-[0.12em] text-ink-3">NO SOURCE · LOG HELD</div>
        )}
        {entries.map((e, i) => {
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
            <div key={e.id} className={'flex gap-1.5 whitespace-nowrap text-[9.5px] leading-[12.5px] ' + (fresh ? 'cy-flash' : '')}>
              <span className="cy-vt shrink-0 text-[11px] text-ink-3 tabular-nums">{e.t}</span>
              <span className={
                'cy-vt shrink-0 text-[11px] ' +
                (e.cls === 'v' ? 'text-[rgb(var(--col))]' : e.cls === 'a' ? 'text-[rgb(var(--acc))]' : e.cls === 'w' ? 'text-[rgb(var(--alm))]' : 'text-ink-3')
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

export function GeneratorPlate() {
  const { snap } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const g = genStats(snap, snap && snap.gpu, snap && snap.host)
  const fuelPerH = 3.2 * g.load
  const hours = fuelPerH > 0.01 ? 118.4 / fuelPerH : 0
  const loadHist = ((snap && snap.kpiHist && snap.kpiHist.tps) || []).slice(-48)
  const ch = ((snap && snap.hostHist && snap.hostHist.cpu) || [])
  const loadSeries = loadHist.map((v, i, a) => {
    const ci = ch.length - 1 - (a.length - 1 - i)
    const cpu = ci >= 0 ? ch[ci] : null
    return v != null && cpu != null ? v * 0.5 + cpu * 2.2 : v
  })

  return (
    <section aria-label="Generator" className="cy-plate flex min-h-0 min-w-0 flex-col overflow-hidden">
      <PlateHead letter="E" t="GENERATOR" sub={offline ? 'NO SOURCE' : 'GEN-1 · 3.0 KW · DIESEL'} />
      <div className="flex min-h-0 flex-1 flex-col gap-1 px-2 pb-1.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[8px] tracking-[0.1em] text-ink-3">LOAD</span>
          <span className="cy-vt text-[20px] leading-none text-ink-1 tabular-nums">{offline ? '—' : `${g.pct}%`}</span>
          <span className="text-[9px] text-ink-2 tabular-nums">{offline ? '' : `${g.kw} KW · ${g.lit}/14 LIT`}</span>
        </div>
        <div className="relative h-[7px] w-full bg-black/45">
          <div className="absolute inset-y-0 left-0 bg-[rgb(var(--acc))] shadow-[0_0_6px_rgb(var(--acc)_/_0.6)]" style={{ width: `${offline ? 0 : g.pct}%` }} />
          <div className="absolute inset-y-[-2px] left-[80%] w-px bg-[rgb(var(--col))]" title="80 % marker" />
        </div>
        <div className="relative h-[34px] min-h-[24px]">
          <SceneCanvas draw={(ctx, w, h, c) => paintSpark(ctx, w, h, c, loadSeries, 'acc')} className="absolute inset-0 h-full w-full" />
        </div>
        <div className="flex flex-wrap items-center gap-x-1" title="one chip per bulb on the wall">
          {Array.from({ length: 14 }, (_, i) => (
            <span
              key={i}
              className={
                'h-[7px] w-[7px] rounded-full ' +
                (offline || g.dead.includes(i)
                  ? 'bg-black/50'
                  : 'bg-[rgb(var(--dat))] shadow-[0_0_5px_rgb(var(--dat)_/_0.8)]')
              }
            />
          ))}
          <span className="ml-1 text-[8px] tracking-[0.08em] text-ink-3 tabular-nums">{offline ? '—' : `${g.lit}/14 LIT`}</span>
        </div>
        <div className="text-[9px] text-ink-2 tabular-nums">{offline ? 'NO SOURCE' : `BUS ${g.volt} V · ${g.hz} HZ`}</div>
        <div className="text-[9px] text-ink-3 tabular-nums">
          {offline ? 'NO SOURCE' : `FUEL ${g.fuel} L · ${g.fuelPct}% · ${hours.toFixed(1)} H AT LOAD`}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------

export function WeatherPlate() {
  const { snap, conductor } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const wx = weatherOf(conductor, snap)

  return (
    <section aria-label="Weather" className="cy-plate flex min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex items-baseline justify-between gap-2 px-2 pt-1.5 pb-0.5">
        <span className="flex items-baseline gap-1.5">
          <i className="cy-st">F</i>
          <b className="text-[10.5px] font-semibold tracking-[0.16em] text-ink-1">WEATHER</b>
        </span>
        <span className="rounded-full border border-black/60 bg-[rgb(0_0_0_/_0.35)] px-1.5 text-[8px] tracking-[0.06em] text-ink-3">
          {offline ? 'NO SOURCE' : wx.road}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 px-2 pb-1.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[8px] tracking-[0.1em] text-ink-3">WIND</span>
          <span className="cy-vt text-[19px] leading-none text-ink-1 tabular-nums">{offline ? '—' : wx.wind}</span>
          <span className="text-[9px] text-ink-2 tabular-nums">{offline ? '' : `M/S · ${wx.dir}°`}</span>
        </div>
        <div className="relative h-[46px] min-h-[34px]">
          <SceneCanvas draw={(ctx, w, h, c) => paintWeather(ctx, w, h, c)} className="absolute inset-0 h-full w-full" />
        </div>
        <div className="text-[9px] text-ink-2 tabular-nums">
          {offline ? 'NO SOURCE' : `CINDERS ${wx.cinders} MM/H · VIS ${wx.vis} KM`}
        </div>
        <div className="text-[9px] text-ink-3 tabular-nums">{offline ? 'NO SOURCE' : `AIR ${wx.air} AT BENCH · ${wx.hpa} HPA`}</div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------

export function ClausePlate() {
  const { snap, alert } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const alerts = offline ? 0 : Math.min(26, ((snap.events || []).filter((e) => e && e.level === 'alert').length))
  return (
    <section
      aria-label="Manual clause"
      className="cy-plate hidden min-h-0 min-w-0 flex-col overflow-hidden min-[769px]:flex"
    >
      <PlateHead letter="G" t="MANUAL CLAUSE" sub="ED. 7 · OFFICER'S COPY" />
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 px-2 pb-1.5">
        <p className="text-[9.5px] leading-[13px] text-ink-2">
          The button is pressed once per docket, in the light of the lamp, and never while the vane is against the
          wind.
        </p>
        <div
          className={
            'border-l-2 px-2 py-1.5 text-[9.5px] leading-[13px] ' +
            (alert > 0.45
              ? 'border-[rgb(var(--col))] bg-[rgb(var(--col)_/_0.1)] text-[rgb(var(--col))] [text-shadow:0_0_8px_rgb(var(--col)_/_0.6)]'
              : 'border-[rgb(var(--col)_/_0.5)] bg-[rgb(0_0_0_/_0.25)] text-ink-2')
          }
        >
          If the lamp reads violet, the officer may refuse the plate without reason, and the traveller may not
          appeal.
        </div>
        <p className="text-[9.5px] leading-[13px] text-ink-2">
          The assay is final. The tin is not returned. The cistern is never emptied.
        </p>
        <div className="mt-auto flex flex-wrap gap-x-2 gap-y-0.5 text-[8.5px] tracking-[0.04em]">
          <span className={alerts > 8 ? 'font-semibold text-[rgb(var(--alm))]' : 'text-ink-3'}>
            14(3) INVOKED {offline ? '—' : alerts} TODAY
          </span>
          <span className="text-ink-3">BUTTONS/TINS/PRICE · CLIMBING/ASSAY DEVICE · NO ENTRY</span>
        </div>
        <span className="sr-only">{CLAUSE.full}</span>
      </div>
    </section>
  )
}

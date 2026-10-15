// Deepsignal gauge rails: two dense text-module columns flanking the bezel
// viewport. Left rail carries the candidate + receiver chain; right rail the
// tracking + array + pipeline chain. Hidden below 769 px (reference stacks
// at <=768). Every row is min-w-0 + truncate; nothing here owns a timer.

import SceneCanvas from '../../scene/Canvas'
import { paintMiniSpec, paintLatencySpark, paintDishes } from './painters'
import {
  pad,
  candScore,
  gaugeVals,
  bandStrips,
  rfiCount,
  classifierBars,
  history12,
  dishLevels,
  pipeline7,
  latOf,
  pointingOf,
  metaOf,
} from './shared'

function Mod({ title, right, children }) {
  return (
    <section className="ds-mod min-w-0 shrink-0">
      <div className="ds-mod-h">
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
      <span className={`min-w-0 truncate text-[19px] leading-none tabular-nums ${cls}`}>{v}</span>
      {unit && <span className="shrink-0 text-[8.5px] tracking-[0.14em] text-ink-3">{unit}</span>}
    </div>
  )
}

// Azimuth/elevation SVG needle dial.
function Dial({ label, deg, max }) {
  const a = ((deg % 360) / 360) * Math.PI * 2 - Math.PI / 2
  const cx = 30
  const cy = 30
  const nx = cx + Math.cos(a) * 20
  const ny = cy + Math.sin(a) * 20
  return (
    <div className="flex min-w-0 items-center gap-2">
      <svg viewBox="0 0 60 60" className="h-[52px] w-[52px] shrink-0" aria-hidden="true">
        <circle cx={cx} cy={cy} r="26" fill="none" stroke="rgb(var(--acc) / 0.25)" strokeWidth="1" />
        <circle cx={cx} cy={cy} r="20" fill="none" stroke="rgb(var(--acc) / 0.12)" strokeWidth="1" />
        {[0, 90, 180, 270].map((t) => {
          const ra = (t / 360) * Math.PI * 2 - Math.PI / 2
          return <line key={t} x1={cx + Math.cos(ra) * 23} y1={cy + Math.sin(ra) * 23} x2={cx + Math.cos(ra) * 26} y2={cy + Math.sin(ra) * 26} stroke="rgb(var(--acc) / 0.5)" strokeWidth="1" />
        })}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="rgb(var(--col) / 0.9)" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="2" fill="rgb(var(--acc) / 0.8)" />
      </svg>
      <div className="min-w-0">
        <div className="truncate text-[8px] tracking-[0.18em] text-ink-3">{label}</div>
        <div className="truncate text-[15px] tabular-nums text-ink-1">
          {deg.toFixed(1)}° <span className="text-[8.5px] text-ink-3">/ {max}°</span>
        </div>
      </div>
    </div>
  )
}

// Inline star-chart for the GJ 1132 track solution (decorative pointing
// lore, token-driven, flagged in the report).
function StarMap() {
  const stars = [
    [8, 12], [22, 6], [34, 16], [46, 8], [58, 20], [70, 10], [82, 24], [92, 12],
    [14, 30], [30, 34], [48, 28], [64, 36], [80, 32], [40, 44], [56, 48],
  ]
  return (
    <svg viewBox="0 0 100 56" preserveAspectRatio="none" className="h-[64px] w-full" aria-label="GJ 1132 track solution star chart">
      {stars.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 7 ? 2 : 0.9} fill={i === 7 ? 'rgb(var(--col) / 0.95)' : 'rgb(var(--text-1) / 0.5)'} />
      ))}
      <circle cx="92" cy="12" r="4.5" fill="none" stroke="rgb(var(--col) / 0.6)" strokeWidth="0.8" />
      <line x1="8" y1="12" x2="92" y2="12" stroke="rgb(var(--acc) / 0.25)" strokeWidth="0.6" strokeDasharray="2 2" />
      <text x="70" y="52" fill="rgb(var(--text-1) / 0.6)" fontSize="6" fontFamily="monospace">GJ 1132 · TRACK SOLN</text>
    </svg>
  )
}

export function LeftRail({ snap, conductor }) {
  const cs = candScore(snap, conductor)
  const g = gaugeVals(snap)
  const strips = bandStrips(snap)
  const rfi = rfiCount(snap)
  const bars = classifierBars(snap, conductor)
  const hist = history12(snap)
  const offline = !snap || snap.mode === 'offline'
  return (
    <aside className="hidden w-[208px] min-w-0 shrink-0 flex-col gap-1.5 overflow-y-auto overflow-x-hidden p-1.5 min-[769px]:flex" aria-label="Candidate and receiver modules">
      <Mod title="CAND · SCORE" right={cs.confirmed ? 'WOW!-2' : 'SCAN'}>
        <BigVal v={offline ? '—' : cs.score} unit="/ 100" tone={cs.confirmed && !offline ? 'amber' : ''} />
      </Mod>
      <Mod title="S/N RATIO" right="dB">
        <BigVal v={offline ? '—' : g.snr} unit="dB" tone="green" />
      </Mod>
      <Mod title="INTEG TIME">
        <BigVal v={offline ? '—' : g.integ} />
      </Mod>
      <Mod title="ANT TEMP">
        <BigVal v={offline ? '—' : g.temp} />
      </Mod>
      {strips.map((s) => (
        <Mod key={s.name} title={s.name} right={offline ? '—' : `${Math.round(s.fill * 100)}%`}>
          <div className="h-[5px] w-full overflow-hidden rounded-sm bg-acc/10" aria-hidden="true">
            <div className={`h-full ${s.up ? 'bg-acc/70' : 'bg-alm/60'}`} style={{ width: `${Math.round(s.fill * 100)}%` }} />
          </div>
        </Mod>
      ))}
      <Mod title="RFI HITS · LAST HR" right={rfi.suppressed ? 'SUPP' : '↑12/HR'}>
        <BigVal v={offline ? '—' : rfi.hits} unit="/ HR" tone={rfi.suppressed ? '' : 'amber'} />
      </Mod>
      <Mod title="BANDW · MINISPEC" right="140">
        <SceneCanvas draw={paintMiniSpec} label="Mini spectrum, band overview" className="h-[28px] w-full" />
      </Mod>
      <Mod title="SIGNAL CLASSIFIER" right="PLEX">
        <div className="flex min-w-0 flex-col gap-[3px]">
          {bars.map((b) => (
            <div key={b.name} className="flex min-w-0 items-center gap-1.5">
              <span className="w-[74px] shrink-0 truncate text-[7.5px] tracking-[0.1em] text-ink-3">{b.name}</span>
              <div className="h-[4px] min-w-0 flex-1 overflow-hidden rounded-sm bg-acc/10" aria-hidden="true">
                <div className={`h-full ${b.v > 80 ? 'bg-col/80' : 'bg-dat/70'}`} style={{ width: `${Math.round(offline ? 0 : b.v)}%` }} />
              </div>
              <span className="w-[26px] shrink-0 text-right text-[8px] tabular-nums text-ink-2">{offline ? '—' : Math.round(b.v)}</span>
            </div>
          ))}
        </div>
      </Mod>
      <Mod title="CANDIDATE HISTORY" right="LAST 12">
        <div className="flex min-w-0 flex-col">
          {hist.length === 0 && <span className="truncate text-[8.5px] text-ink-3">NO EVENTS · NOISE FLOOR</span>}
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
      <Mod title="NOISE" right="FLOOR">
        <div className="truncate text-[8.5px] tabular-nums text-ink-3">−118 dBm · NOMINAL</div>
      </Mod>
    </aside>
  )
}

export function RightRail({ snap }) {
  const dishes = dishLevels(snap)
  const pipe = pipeline7(snap)
  const lat = latOf(snap)
  const pt = pointingOf(snap)
  const meta = metaOf(snap)
  const offline = lat.offline
  const lock = offline ? 0 : Math.round(88 + (dishes.filter((d) => d.up).length / 12) * 12)
  return (
    <aside className="hidden w-[232px] min-w-0 shrink-0 flex-col gap-1.5 overflow-y-auto overflow-x-hidden p-1.5 min-[769px]:flex" aria-label="Tracking and array modules">
      <Mod title="TRACK LOCK" right={offline ? 'HOLD' : `${lock}%`}>
        <div className="h-[5px] w-full overflow-hidden rounded-sm bg-acc/10" aria-hidden="true">
          <div className="h-full bg-dat/80" style={{ width: `${lock}%` }} />
        </div>
      </Mod>
      <Mod title="AZIMUTH">
        <Dial label="AZ · KAROO" deg={pt.az} max={360} />
      </Mod>
      <Mod title="ELEVATION">
        <Dial label="EL · KAROO" deg={pt.el} max={90} />
      </Mod>
      <Mod title="RA / DEC" right="J2000">
        <div className="flex min-w-0 flex-col gap-[3px] text-[8.5px] tabular-nums">
          <div className="flex min-w-0 justify-between gap-2"><span className="shrink-0 text-ink-3">RA</span><span className="min-w-0 truncate text-ink-1">{pt.ra}</span></div>
          <div className="flex min-w-0 justify-between gap-2"><span className="shrink-0 text-ink-3">DEC</span><span className="min-w-0 truncate text-ink-1">{pt.dec}</span></div>
        </div>
      </Mod>
      <Mod title="ARRAY · D-01…06" right="LEVEL">
        <SceneCanvas draw={paintDishes} label="Dish array levels, D-01 to D-06" className="h-[44px] w-full" />
        <div className="flex justify-between text-[7px] tabular-nums text-ink-3">
          {dishes.slice(0, 6).map((d) => (
            <span key={d.id} className={d.up ? '' : 'text-alm'}>{d.id}</span>
          ))}
        </div>
      </Mod>
      <Mod title="ARRAY · D-07…12" right="STATE">
        <div className="grid min-w-0 grid-cols-3 gap-1">
          {dishes.slice(6).map((d) => (
            <div key={d.id} className="min-w-0 truncate text-[8px] tabular-nums">
              <span className="text-ink-3">{d.id} </span>
              <span className={d.maint ? 'text-dat' : d.up ? 'text-ink-1' : 'text-alm'}>{d.maint ? 'MAINT' : d.up ? 'NOM' : 'DOWN'}</span>
            </div>
          ))}
        </div>
      </Mod>
      <Mod title="GJ 1132 · TRACK SOLN" right="M-DWARF">
        <div className="grid min-w-0 grid-cols-2 gap-x-2 text-[8.5px] tabular-nums">
          <span className="truncate text-ink-3">DIST <span className="text-ink-1">41 LY</span></span>
          <span className="truncate text-ink-3">MAG·V <span className="text-ink-1">13.5</span></span>
          <span className="truncate text-ink-3">PLANETS <span className="text-ink-1">2</span></span>
          <span className="truncate text-ink-3">AIRMASS <span className="text-ink-1">1.4</span></span>
        </div>
      </Mod>
      <Mod title="SOURCE · GJ 1132" right="CHART">
        <StarMap />
      </Mod>
      <Mod title="DECODER PIPELINE" right="7 STG">
        <div className="flex min-w-0 flex-col gap-[2px]">
          {pipe.map((s) => (
            <div key={s.name} className="flex min-w-0 items-center justify-between gap-2 text-[8px] tracking-[0.08em]">
              <span className="min-w-0 truncate text-ink-2">{s.name}</span>
              <span className={`shrink-0 ${s.state === 'RUN' ? 'text-dat' : s.state === 'QUEUE' ? 'text-col' : 'text-ink-3'}`}>{s.state}</span>
            </div>
          ))}
        </div>
      </Mod>
      <Mod title="LIVE LATENCY" right="CH 1">
        <SceneCanvas draw={paintLatencySpark} label="Queue latency sparkline" className="h-[16px] w-full" />
        <div className="mt-0.5 flex min-w-0 justify-between gap-2 text-[8.5px] tabular-nums">
          <span className="min-w-0 truncate text-ink-3">QUEUE <span className="text-ink-1">{lat.queue}s</span></span>
          <span className="shrink-0 text-ink-3">RTT <span className="text-ink-1">{lat.rtt}ms</span></span>
        </div>
      </Mod>
      <Mod title="CORRELATOR" right="6/6">
        <div className="truncate text-[8.5px] tabular-nums text-ink-2">{offline ? 'HOLD · NO SOURCE' : 'NOMINAL · 6/6'}</div>
      </Mod>
      <Mod title="SHIFT" right={meta.rpm}>
        <div className="min-w-0 truncate text-[8.5px] tabular-nums text-ink-3">{meta.shift} · {meta.cands}</div>
      </Mod>
    </aside>
  )
}

export { pad }

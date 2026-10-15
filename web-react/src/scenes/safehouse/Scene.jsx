// Safehouse scene root: the two-pane SIGINT workstation (uispace.org/safehouse
// recreation). LEFT = signal processing (TRM table, satellite track, telemetry,
// history, I/O), RIGHT = audio analysis (tabs, seal, waveforms, toggles,
// timecode, channel banks, clf history, frequency bars, database buttons),
// a vertical ops strip at far left, the TRM top bar, and a 60 s status
// marquee along the bottom. Everything animates off the shared conductor
// clock; the scene owns no timers. Below 768 px the panes stack and the
// right pane is promoted to hero, as in the reference.

import { useScene } from '../../scene/SceneRoot'
import OpsStrip from './OpsStrip'
import TrmTable from './TrmTable'
import SatPanel from './SatPanel'
import TelemetryGrid from './TelemetryGrid'
import SignalHistory from './SignalHistory'
import IoBlocks from './IoBlocks'
import WavePanels from './WavePanels'
import IntelFeed from './IntelFeed'
import ChannelBank from './ChannelBank'
import ClfLog from './ClfLog'
import FreqBars from './FreqBars'
import MarqueeStrip from './MarqueeStrip'
import { hexFrom, tickTimecode, frameCounter } from './frame.jsx'
// ---------------------------------------------------------------------------
// Right-pane chrome (decorative reference surfaces, token-driven)
// ---------------------------------------------------------------------------

const TABS = ['RECON', 'AUDIO', 'ENG', 'FFT', 'TEMPLATES', 'FILTERS', 'COMMAND', 'DATABASES', 'HARDWARE', 'SOURCE', 'META', 'LOG', 'ABOUT']

function RpTabs() {
  return (
    <div className="flex h-[22px] shrink-0 items-stretch gap-px overflow-hidden border-b border-acc/25 bg-pan/45" aria-label="Analysis tabs">
      {TABS.map((t) => (
        <span
          key={t}
          className={`flex min-w-0 flex-1 items-center justify-center px-0.5 text-[6.5px] uppercase tracking-[0.08em] ${
            t === 'AUDIO' ? 'bg-dat/10 font-semibold text-dat shadow-[inset_0_-2px_0_rgb(var(--dat))]' : 'text-ink-3'
          }`}
        >
          {t}
        </span>
      ))}
    </div>
  )
}

function Seal() {
  const ticks = Array.from({ length: 32 }, (_, i) => {
    const a = (i / 32) * Math.PI * 2 - Math.PI / 2
    const c = Math.cos(a)
    const s = Math.sin(a)
    return {
      x1: 50 + c * 41,
      y1: 50 + s * 41,
      x2: 50 + c * 44,
      y2: 50 + s * 44,
      k: i,
    }
  })
  return (
    <div className="hidden h-full w-[84px] shrink-0 items-center justify-center sm:flex" aria-hidden="true">
      <svg viewBox="0 0 100 100" className="h-full max-h-[92px] w-auto">
        <circle cx="50" cy="50" r="44" fill="none" stroke="rgb(var(--acc))" strokeWidth="1.2" opacity="0.85" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="rgb(var(--acc))" strokeWidth="0.5" opacity="0.55" />
        <g>
          {ticks.map((t) => (
            <line key={t.k} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="rgb(var(--acc))" strokeWidth="0.6" opacity="0.6" />
          ))}
        </g>
        <path d="M50 14 L52 50 L50 86 L48 50 Z" fill="rgb(var(--acc))" opacity="0.45" />
        <path d="M14 50 L50 52 L86 50 L50 48 Z" fill="rgb(var(--acc))" opacity="0.45" />
        <path d="M25 25 L50 50 L75 75 L50 50 Z" fill="rgb(var(--acc))" opacity="0.3" />
        <path d="M75 25 L50 50 L25 75 L50 50 Z" fill="rgb(var(--acc))" opacity="0.3" />
        <path d="M40 40 L60 40 L60 56 Q60 64 50 68 Q40 64 40 56 Z" fill="rgb(var(--acc) / 0.18)" stroke="rgb(var(--acc))" strokeWidth="0.8" />
        <path
          d="M50 32 L46 38 L42 36 L44 42 L40 44 L46 46 L44 52 L50 50 L56 52 L54 46 L60 44 L56 42 L58 36 L54 38 Z"
          fill="rgb(var(--acc))"
          opacity="0.85"
        />
        <circle cx="50" cy="34" r="1.4" fill="rgb(var(--dat))" />
        <g fill="rgb(var(--dat))">
          <circle cx="44" cy="58" r="0.8" />
          <circle cx="48" cy="60" r="0.8" />
          <circle cx="52" cy="60" r="0.8" />
          <circle cx="56" cy="58" r="0.8" />
          <circle cx="50" cy="62" r="0.8" />
        </g>
        <text x="50" y="92" textAnchor="middle" fontFamily="inherit" fontSize="4" fill="rgb(var(--acc))" letterSpacing="2" opacity="0.85">
          CENTRAL INTELLIGENCE
        </text>
        <text x="50" y="9.5" textAnchor="middle" fontFamily="inherit" fontSize="3.2" fill="rgb(var(--acc))" letterSpacing="1" opacity="0.65">
          UNITED STATES OF AMERICA
        </text>
      </svg>
    </div>
  )
}

function RHeader() {
  const { snap } = useScene()
  const feed = snap ? snap.mode || 'live' : 'boot'
  const k = (snap && snap.kpi) || {}
  const engines = (snap && snap.engines) || []
  const up = engines.filter((e) => e && e.up !== false)
  const fromTps = Array.isArray(k.tps_models) && k.tps_models.length ? String(k.tps_models[0]) : null
  const fromEng = up.length ? String(up[0].label || up[0].key) : null
  const models = (snap && snap.models) || []
  const active = fromTps || fromEng || (models.length ? String(models[0].id || models[0]) : null)
  const decode = up.reduce((a, e) => a + (e && e.rates && e.rates.decode_tps != null ? e.rates.decode_tps : 0), 0)
  const running = snap && snap.mode !== 'offline' && snap.mode !== 'boot' && up.length > 0
  const audioLine = !snap || snap.mode === 'offline'
    ? 'NO SOURCE'
    : `${active || 'NO MODEL'} · ${running && decode > 0 ? `${Math.round(decode)} TOK/S · RUN` : 'IDLE'}`
  return (
    <div className="flex min-w-0 flex-col justify-center overflow-hidden px-1" aria-label="Audio analysis header">
      <div className="truncate text-[10px] uppercase tracking-[0.18em] text-acc sm:text-[11px]">AUDIO ANALYSIS · NETWORK EF DATA ANALYSIS</div>
      <div className="mt-1 flex min-w-0 items-baseline gap-3">
        <span className="text-[18px] font-medium tabular-nums tracking-[0.04em] text-ink-1 sm:text-[22px]">AUDIO138</span>
        <span className="min-w-0 flex-1 truncate text-[8.5px] uppercase tracking-[0.18em] text-ink-3 sm:text-[9px]">{audioLine}</span>
        <span className="text-[24px] font-semibold leading-none tabular-nums text-dat sm:text-[30px]">07</span>
      </div>
      <div className="mt-1 truncate text-[6.5px] uppercase tracking-[0.14em] text-ink-3">
        <span>DEPLOY </span>
        <span className="tabular-nums text-dat">03</span>
        <span className="mx-1 text-acc/40">·</span>
        <span>DAY </span>
        <span className="tabular-nums text-dat">07</span>
        <span className="mx-1 text-acc/40">·</span>
        <span>WK </span>
        <span className="tabular-nums text-dat">14</span>
        <span> OBS · </span>
        <span className={feed === 'demo' ? 'text-dat' : 'text-acc'}>{feed.toUpperCase()}</span>
      </div>
    </div>
  )
}

const TOGGLES = [
  ['FILTER WIDTH', true],
  ['DATA EFFECT', false],
  ['FILTER DATA', false],
  ['ANALYZE SIGNAL', false],
  ['AVERAGE FILTER', true],
  ['ENHANCE SOURCE', false],
  ['EXTRACT SOURCE', false],
  ['NORMALIZE', false],
  ['SUPPRESS', true],
  ['GATE', false],
  ['TRIM', false],
  ['EXPAND', false],
  ['DENOISE', false],
  ['ENHANCE', false],
]

function Toggles() {
  return (
    <div className="flex min-w-0 flex-col gap-0.5" aria-label="Analysis toggles">
      {TOGGLES.map(([label, active]) => (
        <div
          key={label}
          className={`flex min-h-0 flex-1 items-center justify-between border px-1.5 text-[6.5px] uppercase tracking-[0.08em] ${
            active ? 'border-dat/60 text-dat' : 'border-acc/25 text-acc/80'
          }`}
          aria-hidden="true"
        >
          <span className="truncate">{label}</span>
          <span className={`h-[5px] w-[5px] shrink-0 rounded-full ${active ? 'bg-dat shadow-[0_0_4px_rgb(var(--dat))]' : 'bg-acc/25'}`} />
        </div>
      ))}
    </div>
  )
}

function TimecodeCells() {
  const { snap, tick } = useScene()
  const feed = snap ? snap.mode || 'live' : 'boot'
  const cells = [
    { src: `LIVE-${hexFrom(feed, 2)}`, seed: 36555, frame: 188 },
    { src: `LIVE-${hexFrom(String(feed).slice(1) || 'b', 2)}`, seed: 15753, frame: 63767 },
  ]
  return (
    <div className="grid min-w-0 flex-1 grid-cols-2 gap-1" aria-label="Timecode">
      {cells.map((c, i) => (
        <div key={i} className="flex min-w-0 flex-col justify-between border border-acc/25 bg-bgg/50 px-1.5 py-1">
          <div className="flex justify-between text-[6.5px] uppercase tracking-[0.12em]">
            <span className="text-ink-3">SOURCE</span>
            <span className="tabular-nums text-ink-2">{c.src.toUpperCase()}</span>
          </div>
          <div className="flex justify-between text-[6.5px] uppercase tracking-[0.12em]">
            <span className="text-ink-3">RATE</span>
            <span className="tabular-nums text-ink-2">48.0 KHZ</span>
          </div>
          <div className="mt-0.5 text-[8px] tracking-[0.18em] text-acc">TIME STAMP 0{i + 1}</div>
          <div
            className="text-[16px] font-semibold leading-none tabular-nums text-dat [text-shadow:0_0_8px_rgb(var(--dat)_/_0.35)] sm:text-[24px]"
          >
            {tickTimecode(tick, c.seed)}
          </div>
          <div className="mt-0.5 flex justify-between text-[6.5px] tracking-[0.1em]">
            <span className="text-ink-3">FRAME</span>
            <span className="tabular-nums text-acc">{frameCounter(tick, c.frame)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function DbButtons() {
  const active = 1
  return (
    <div className="grid h-[28px] shrink-0 grid-cols-4 gap-1.5" aria-label="Database selectors">
      {['R1', 'R2', 'R3', 'R4'].map((r, i) => (
        <div
          key={r}
          className={`flex items-center justify-center gap-1.5 border bg-pan/40 text-[8.5px] uppercase tracking-[0.14em] ${
            i === active ? 'border-dat text-dat shadow-[inset_0_0_8px_rgb(var(--dat)_/_0.18)]' : 'border-acc/25 text-acc'
          }`}
          aria-hidden="true"
        >
          <span className={`font-bold tracking-[0.06em] ${i === active ? 'text-dat' : 'text-dat/80'}`}>{r}</span>
          <span>DATABASE</span>
        </div>
      ))}
    </div>
  )
}

function StatusStrip() {
  const { snap, conductor } = useScene()
  const k = (snap && snap.kpi) || {}
  const gain = Math.min(1, conductor.heat)
  const phase = Math.min(1, conductor.alert)
  const cells = [
    ['FILTERING', 'FULL', true],
    ['BUS', '7A', false],
    ['GAIN', gain > 0.02 ? `-${(gain * 1.6).toFixed(2)}` : '0.00', false],
    ['PHASE', phase > 0.02 ? `-${(phase * 50).toFixed(1)}°` : '-0.0°', false],
    ['LOCK', 'LK-R3', true],
  ]
  return (
    <div className="flex h-[16px] shrink-0 items-center gap-3 overflow-hidden border-t border-acc/25 px-1.5 text-[7px] uppercase tracking-[0.12em] text-ink-3">
      {cells.map(([key, val, amber]) => (
        <span key={key} className="whitespace-nowrap">
          <span className="text-ink-3">{key}</span> · <span className={amber ? 'text-dat' : 'text-ink-2'}>{val}</span>
        </span>
      ))}
      <span className="hidden whitespace-nowrap text-ink-3 sm:inline">
        KPI {k.tps != null ? `${Math.round(k.tps)}` : '—'} TPS
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Scene root
// ---------------------------------------------------------------------------

export default function SafehouseScene() {
  const { snap, mode } = useScene()
  const engines = (snap && snap.engines) || []
  const target = engines.find((e) => e && e.up) || null
  const offline = mode === 'offline'
  const noEngines = engines.length === 0

  return (
    <div className="sh-stage relative flex min-h-dvh flex-col overflow-x-hidden font-mono md:h-dvh md:min-h-0 md:overflow-hidden">
      {/* stage layers: engineering grid, vignette, static film grain */}
      <div className="sh-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="sh-vignette pointer-events-none absolute inset-0 z-[60]" aria-hidden="true" />
      <div className="sh-grain pointer-events-none absolute inset-0 z-[70]" aria-hidden="true" />

      {/* top bar: TRM / DATA TERMINAL WINDOW / LK-R3 / SP1-7 */}
      <header className="z-10 flex h-[22px] shrink-0 items-center gap-3.5 border-b border-acc/25 bg-bgg/70 px-2.5 text-[9px] uppercase tracking-[0.1em] text-ink-3">
        <span className="text-[11px] font-semibold tracking-[0.2em] text-acc">TRM</span>
        <span className="hidden text-[8.5px] sm:inline">DATA TERMINAL WINDOW</span>
        <span className="flex-1" />
        <span className="tracking-[0.18em] text-dat">LK-R3</span>
        <span className="tracking-[0.18em] text-acc">SP1-7</span>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1">
        <OpsStrip />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1 p-1 md:flex-row">
          {/* PANE LEFT — signal processing */}
          <section
            aria-label="Signal processing pane"
            className="sh-pane order-2 min-h-0 min-w-0 border border-acc/25 p-1 md:order-1 md:w-1/2"
          >
            <div className="flex h-full min-h-0 flex-col gap-1">
              <TrmTable ghosted={offline || noEngines} />
              <SatPanel target={target} ghosted={offline || !target} />
              <div className="grid min-h-[90px] flex-[10] grid-cols-1 gap-1 sm:grid-cols-2 md:min-h-0">
                <TelemetryGrid target={target} ghosted={offline || !target} />
                <SignalHistory engines={engines} />
              </div>
              <IoBlocks target={target} ghosted={offline || !target} />
            </div>
          </section>

          {/* PANE RIGHT — audio analysis */}
          <section
            aria-label="Audio analysis pane"
            className="sh-pane order-1 min-h-0 min-w-0 border border-acc/25 p-1 md:order-2 md:w-1/2"
          >
            <div className="flex h-full min-h-0 flex-col gap-1">
              <RpTabs />

              <div className="grid h-[88px] shrink-0 grid-cols-1 gap-1 sm:min-h-0 lg:grid-cols-[84px_minmax(0,1fr)_172px] md:grid-cols-[84px_minmax(0,1fr)]">
                <div className="hidden md:block">
                  <Seal />
                </div>
                <RHeader />
                <div className="hidden w-[172px] shrink-0 lg:block">
                  <IntelFeed />
                </div>
              </div>

              <WavePanels ghosted={offline} />

              <div className="grid min-h-[130px] flex-[120] grid-cols-1 gap-1 sm:grid-cols-[124px_minmax(0,1fr)] md:min-h-0">
                <div className="flex min-w-0 flex-col">
                  <Toggles />
                </div>
                <TimecodeCells />
              </div>

              <div className="shrink-0">
                <ChannelBank engines={engines} ghosted={offline || noEngines} />
              </div>

              <ClfLog />
              <FreqBars />
              <StatusStrip />
              <DbButtons />
            </div>
          </section>
        </div>
      </div>

      <div className="relative z-10 px-1 pb-1">
        <MarqueeStrip />
      </div>
    </div>
  )
}

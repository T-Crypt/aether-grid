// Inference Intercept scene root: the two-pane engine-session console.
// LEFT = engine bay (session table, engine lock, engine telemetry, decode
// history, session I/O), RIGHT = decode intercept (tabs, emblem, header,
// event feed, traces, session rail, readout cells, slot banks, event log,
// session bars, status strip, engine registry), a vertical ops rail at far
// left, the top bar, and a 60 s status marquee along the bottom.
// Everything animates off the shared conductor clock; the scene owns no
// timers. The .ic-boot overlay plays a one-shot lock-on sweep on mount and
// degenerates instantly under reduced motion. Below 768 px the panes stack
// and the right pane is promoted to hero.

import '@fontsource/vt323'
import { useEffect, useState } from 'react'
import { useScene } from '../../scene/SceneRoot'
import OpsRail from './OpsRail'
import SessionTable from './SessionTable'
import EngineLock from './EngineLock'
import EngineTelemetry from './EngineTelemetry'
import DecodeHistory from './DecodeHistory'
import SessionIo from './SessionIo'
import TracePanels from './TracePanels'
import EventTicker from './EventTicker'
import SessionRail from './SessionRail'
import ReadoutCells from './ReadoutCells'
import SlotBank from './SlotBank'
import EventLog from './EventLog'
import SessionBars from './SessionBars'
import MarqueeStrip from './MarqueeStrip'
import { hexFrom } from './frame.jsx'
import { decodeOf, lockedEngine, modelOf, upEngines, wellCounts } from './shared'

// ---------------------------------------------------------------------------
// Right-pane chrome (token-driven)
// ---------------------------------------------------------------------------

const TABS = ['SESSIONS', 'DECODE', 'PREFILL', 'THINK', 'QUEUE', 'KV', 'MODEL', 'ENGINES', 'GPU', 'HOST', 'LOG', 'FEED', 'META']

function RpTabs() {
  return (
    <div className="flex h-[22px] shrink-0 items-stretch gap-px overflow-hidden border-b border-acc/25 bg-pan/45" aria-label="Intercept tabs">
      {TABS.map((t) => (
        <span
          key={t}
          className={`flex min-w-0 flex-1 items-center justify-center px-0.5 text-[6.5px] uppercase tracking-[0.08em] ${
            t === 'DECODE' ? 'bg-dat/10 font-semibold text-dat shadow-[inset_0_-2px_0_rgb(var(--dat))]' : 'text-ink-3'
          }`}
        >
          {t}
        </span>
      ))}
    </div>
  )
}

// The desk emblem: a lock-on reticle ring, not a crest. Ticks ride a slow
// rotation only while the scene animates (pure CSS, one-shot under reduced
// motion).
function Emblem() {
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
        {/* lock-on brackets at the cardinal points */}
        <g stroke="rgb(var(--dat))" strokeWidth="1.4" fill="none" opacity="0.9">
          <path d="M50 12 L50 20 M46 16 L54 16" />
          <path d="M50 88 L50 80 M46 84 L54 84" />
          <path d="M12 50 L20 50 M16 46 L16 54" />
          <path d="M88 50 L80 50 M84 46 L84 54" />
        </g>
        {/* the core: a token stream vanishing into the lock point */}
        <g stroke="rgb(var(--acc))" strokeWidth="0.9" opacity="0.85">
          <path d="M30 38 L42 46 M70 38 L58 46 M30 62 L42 54 M70 62 L58 54" />
        </g>
        <circle cx="50" cy="50" r="6" fill="rgb(var(--acc) / 0.2)" stroke="rgb(var(--acc))" strokeWidth="1" />
        <circle cx="50" cy="50" r="2" fill="rgb(var(--dat))" />
        <text x="50" y="95" textAnchor="middle" fontFamily="inherit" fontSize="4" fill="rgb(var(--acc))" letterSpacing="2" opacity="0.85">
          AETHER GRID
        </text>
        <text x="50" y="8.5" textAnchor="middle" fontFamily="inherit" fontSize="3.2" fill="rgb(var(--acc))" letterSpacing="1" opacity="0.65">
          LOCAL LLM RUNTIME
        </text>
      </svg>
    </div>
  )
}

function RHeader() {
  const { snap } = useScene()
  const feed = snap ? snap.mode || 'live' : 'boot'
  const tps = (snap && snap.kpi && snap.kpi.tps) || null
  const decode = decodeOf(snap)
  const engines = (((snap && snap.engines) || []) || [])
  const up = upEngines(snap)
  const lock = lockedEngine(snap)
  const sessions = (((snap && snap.sessions) || []) || []).length
  const model = modelOf(snap)
  const running = snap && snap.mode !== 'offline' && snap.mode !== 'boot' && up.length > 0
  const line = !snap || snap.mode === 'offline'
    ? 'NO SOURCE'
    : `SIG ${model ? String(model).toUpperCase() : 'NO MODEL'} · ${running && decode > 0 ? `DECODE ${Math.round(decode)} TOK/S · ON AIR` : 'STANDBY · DESK OPEN'}`
  return (
    <div className="flex min-w-0 flex-col justify-center overflow-hidden px-1" aria-label="Decode intercept header">
      <div className="truncate text-[10px] uppercase tracking-[0.18em] text-acc sm:text-[11px]">DECODE INTERCEPT · ENGINE SESSIONS</div>
      <div className="mt-1 flex min-w-0 items-baseline gap-3">
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium tabular-nums tracking-[0.04em] text-ink-1 sm:text-[18px]">
          {model ? String(model).toUpperCase() : 'NO MODEL'}
        </span>
        <span className="hidden min-w-0 flex-1 truncate text-[8.5px] uppercase tracking-[0.18em] text-ink-3 sm:inline sm:text-[9px]">{line}</span>
        <span
          className="ic-vt text-[26px] font-semibold leading-none tabular-nums text-dat sm:text-[32px]"
          style={{ textShadow: `0 0 ${12 + Math.min(1, (tps || 0) / 280) * 10}px rgb(var(--dat) / 0.55)` }}
        >
          {tps != null ? Math.round(tps) : '—'}
        </span>
      </div>
      <div className="mt-1 truncate text-[6.5px] uppercase tracking-[0.14em] text-ink-3">
        <span>ENG </span>
        <span className="tabular-nums text-dat">{`${up.length}/${engines.length}`}</span>
        <span className="mx-1 text-acc/70">·</span>
        <span>SESS </span>
        <span className="tabular-nums text-dat">{sessions}</span>
        <span className="mx-1 text-acc/70">·</span>
        <span>FEED </span>
        <span className={feed === 'demo' ? 'text-dat' : 'text-acc'}>{feed.toUpperCase()}</span>
      </div>
    </div>
  )
}

function StatusStrip() {
  const { snap, conductor } = useScene()
  const wells = wellCounts(snap)
  const up = upEngines(snap)
  const total = (((snap && snap.engines) || []) || []).length
  const lock = lockedEngine(snap)
  const cells = [
    ['ENG', `${up.length}/${total}`, false],
    ['SESS', String((((snap && snap.sessions) || []) || []).length), false],
    ['HOT', String(wells.hot), wells.hot > 0],
    ['QUEUE', (snap && snap.kpi && snap.kpi.queue) != null ? String(Math.round(snap.kpi.queue)) : '—', false],
    ['LOCK', lock ? String(lock.key || '—').toUpperCase() : '—', true],
  ]
  return (
    <div className="flex h-[16px] shrink-0 items-center gap-3 overflow-hidden border-t border-acc/25 px-1.5 text-[7px] uppercase tracking-[0.12em] text-ink-3">
      {cells.map(([key, val, amber]) => (
        <span key={key} className="whitespace-nowrap">
          <span className="text-ink-3">{key}</span> · <span className={amber ? 'text-dat' : 'text-ink-2'}>{val}</span>
        </span>
      ))}
      <span className="hidden whitespace-nowrap text-ink-3 sm:inline">
        KPI {(snap && snap.kpi && snap.kpi.tps) != null ? `${Math.round(snap.kpi.tps)}` : '—'} TOK/S
      </span>
      <span className="ml-auto hidden whitespace-nowrap text-ink-3 sm:inline" aria-hidden="true">
        DESK {(conductor.heat > 0.6 ? 'HOT' : conductor.alert > 0.4 ? 'ALERT' : 'NOMINAL')}
      </span>
    </div>
  )
}

// The engine registry strip: one cell per engine (first four), lit when
// the engine is up, the locked engine carrying the active data tint.
function DbButtons({ engines, ghosted }) {
  const lock = lockedEngine(ghosted ? null : { engines })
  const cells = Array.from({ length: 4 }, (_, i) => engines[i] || null)
  return (
    <div className="grid h-[28px] shrink-0 grid-cols-4 gap-1.5" aria-label="Engine registry">
      {cells.map((e, i) => {
        const active = e && lock && e.key === lock.key
        return (
          <div
            key={e ? e.key : `reg-${i}`}
            className={`flex min-w-0 items-center justify-center gap-1.5 border bg-pan/40 text-[8.5px] uppercase tracking-[0.14em] ${
              active
                ? 'border-dat text-dat shadow-[inset_0_0_8px_rgb(var(--dat)_/_0.18)]'
                : 'border-acc/25 text-acc/80'
            }`}
            aria-label={e ? `engine ${e.key} ${e.up ? 'up' : 'down'}` : 'registry slot empty'}
          >
            <span className={`min-w-0 truncate font-bold tracking-[0.06em] ${active ? 'text-dat' : 'text-dat/80'}`}>
              {e ? String(e.key || e.label || '—').toUpperCase() : '—'}
            </span>
            <span className="hidden sm:inline">ENGINE</span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Alarm flare: on a vram_pressure crossing or an err anomaly the stage
// flashes one glitch burst. The element is re-keyed per event so the finite
// CSS animation replays; nothing here owns a timer.
// ---------------------------------------------------------------------------

function FlareLayer({ conductor }) {
  const [flare, setFlare] = useState(null)
  useEffect(() => {
    const offVp = conductor.on('vram_pressure', (ev) => {
      if (ev.level !== 'ok') setFlare({ seq: 'vp' + ev.seq })
    })
    const offAn = conductor.on('anomaly', (ev) => {
      if (ev.level === 'err') setFlare({ seq: 'an' + ev.seq })
    })
    return () => {
      offVp()
      offAn()
    }
  }, [conductor])
  if (!flare) return null
  return <div key={flare.seq} className="ic-flare pointer-events-none absolute inset-0 z-[9]" aria-hidden="true" />
}

// ---------------------------------------------------------------------------
// Scene root
// ---------------------------------------------------------------------------

export default function InterceptScene() {
  const { snap, conductor, mode } = useScene()
  const engines = (snap && snap.engines) || []
  const target = engines.find((e) => e && e.up) || null
  const offline = mode === 'offline'
  const noEngines = engines.length === 0

  return (
    <div className="ic-stage relative flex min-h-dvh flex-col overflow-x-hidden pb-[var(--chrome-h)] font-mono md:h-dvh md:min-h-0 md:overflow-hidden">
      {/* stage layers: engineering grid, vignette, static film grain */}
      <div className="ic-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="ic-vignette pointer-events-none absolute inset-0 z-[60]" aria-hidden="true" />
      <div className="ic-grain pointer-events-none absolute inset-0 z-[70]" aria-hidden="true" />

      {/* top bar */}
      <header className="z-10 flex h-[22px] shrink-0 items-center gap-3.5 border-b border-acc/25 bg-bgg/70 px-2.5 text-[9px] uppercase tracking-[0.1em] text-ink-3">
        <span className="text-[11px] font-semibold tracking-[0.2em] text-acc">ICP</span>
        <span className="hidden text-[8.5px] sm:inline">ENGINE SESSION TERMINAL</span>
        <span className="flex-1" />
        <span className="tracking-[0.18em] text-dat">LK-{hexFrom('intercept-desk', 2)}</span>
        <span className="tracking-[0.18em] text-acc">AETHER GRID</span>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1">
        <OpsRail />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1 p-1 md:flex-row">
          {/* PANE LEFT — engine bay */}
          <section
            aria-label="Engine bay pane"
            className="ic-pane order-2 min-h-0 min-w-0 border border-acc/25 p-1 md:order-1 md:w-1/2"
          >
            <div className="flex h-full min-h-0 flex-col gap-1">
              <SessionTable ghosted={offline || noEngines} />
              <EngineLock target={target} ghosted={offline || !target} />
              <div className="grid min-h-[90px] flex-[10] grid-cols-1 gap-1 sm:grid-cols-2 md:min-h-0">
                <EngineTelemetry target={target} ghosted={offline || !target} />
                <DecodeHistory engines={engines} />
              </div>
              <SessionIo target={target} ghosted={offline || !target} />
            </div>
          </section>

          {/* PANE RIGHT — decode intercept */}
          <section
            aria-label="Decode intercept pane"
            className="ic-pane relative order-1 min-h-0 min-w-0 border border-acc/25 p-1 md:order-2 md:w-1/2"
          >
            {/* CRT scanlines over the pane */}
            <div className="ic-scan pointer-events-none absolute inset-0 z-[5]" aria-hidden="true" />
            <div className="relative z-[6] flex h-full min-h-0 flex-col gap-1">
              <RpTabs />

              <div className="grid h-[88px] shrink-0 grid-cols-1 gap-1 sm:min-h-0 lg:grid-cols-[84px_minmax(0,1fr)_172px] md:grid-cols-[84px_minmax(0,1fr)]">
                <div className="hidden md:block">
                  <Emblem />
                </div>
                <RHeader />
                <div className="hidden w-[172px] shrink-0 lg:block">
                  <EventTicker />
                </div>
              </div>

              <TracePanels ghosted={offline} />

              <div className="grid min-h-[130px] flex-[120] grid-cols-1 gap-1 sm:grid-cols-[124px_minmax(0,1fr)] md:min-h-0">
                <div className="scrollbar-thin-x flex min-w-0 flex-col overflow-x-hidden overflow-y-auto">
                  <SessionRail ghosted={offline || noEngines} />
                </div>
                <ReadoutCells ghosted={offline} />
              </div>

              <div className="shrink-0">
                <SlotBank engines={engines} ghosted={offline || noEngines} />
              </div>

              <EventLog />
              <SessionBars />
              <StatusStrip />
              <DbButtons engines={engines} ghosted={offline || noEngines} />
            </div>
          </section>
        </div>
      </div>

      <div className="relative z-10 px-1 pb-1">
        <MarqueeStrip />
      </div>

      <FlareLayer conductor={conductor} />

      {/* one-shot lock-on sweep on mount (finite; degenerates under
          reduced motion via the global rule) */}
      <div className="ic-boot pointer-events-none absolute inset-0 z-[80]" aria-hidden="true" />
    </div>
  )
}

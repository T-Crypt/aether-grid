// Context Orbit scene root: the KV slot system around the model core. A
// full-bleed orbit schematic stage (canvas + leader-line callouts + core
// glow + two inset canvases + pressure alert card + stamp plates) framed by
// asymmetric rails (left 156 px, right 200 px) with top/bottom edge bars.
// Everything animates off the shared conductor clock; the scene owns no
// timers. Below 768 px the rails hide, the canvas becomes a 55 vh hero, the
// edges wrap to strips and the stamps stack as full-width cards. The
// .or-boot overlay plays a one-shot lock-on sweep on mount and degenerates
// instantly under reduced motion.

import '@fontsource/vt323'
import { useEffect, useState } from 'react'
import SceneCanvas from '../../scene/Canvas'
import { useScene } from '../../scene/SceneRoot'
import { paintOrbit, paintDecodeScope, paintVramMap } from './painters'
import { CALLOUTS, calloutState, staleOf, vramStats, activeOf } from './shared'
import SlotStrip from './SlotStrip'
import PressureCard from './PressureCard'
import LeftRail from './LeftRail'
import RightRail from './RightRail'
import { EdgeTop, EdgeBot } from './EdgeBars'
import { StampTitle, StampPlate, StampData } from './StampPlates'

// ---------------------------------------------------------------------------
// Leader lines + callout chips: the 18 anchor dots with leader lines (SVG,
// stretched to the stage) and their DOM label chips. Each callout binds to a
// telemetry source (shared.js binds); the dot/line take the alarm tint when
// its bound state crosses into alert, amber on warn.
// ---------------------------------------------------------------------------

function LeaderLayer({ snap, alert, stale }) {
  const VBX = 1244
  const VBY = 834
  return (
    <>
      <svg
        viewBox={`0 0 ${VBX} ${VBY}`}
        preserveAspectRatio="none"
        className={`pointer-events-none absolute inset-0 z-[5] hidden h-full w-full transition-opacity duration-500 min-[769px]:block ${stale ? 'opacity-40' : ''}`}
        aria-hidden="true"
      >
        {CALLOUTS.map((c, i) => {
          const s = calloutState(c.bind, snap, 0, alert, stale).state
          const col =
            s === 'alarm'
              ? 'rgb(var(--alm) / 0.55)'
              : s === 'warn'
                ? 'rgb(var(--dat) / 0.5)'
                : 'rgb(var(--acc) / 0.30)'
          const dot = s === 'alarm' ? 'rgb(var(--alm) / 0.95)' : 'rgb(var(--acc) / 0.85)'
          const ax = c.a.x * (VBX / 100)
          const ay = c.a.y * (VBY / 100)
          const lx = c.l.x * (VBX / 100)
          const ly = c.l.y * (VBY / 100)
          // elbow: vertical run to the label column, then a short horizontal
          const ex = c.side === 'left' ? lx - 14 : lx + 14
          const d = `M ${ax} ${ay} L ${ex} ${ly} L ${lx} ${ly}`
          return (
            <g key={i}>
              <path d={d} fill="none" stroke={col} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={ax} cy={ay} r="1.8" fill={s === 'alarm' ? 'rgb(var(--alm) / 0.95)' : dot} />
            </g>
          )
        })}
      </svg>
      {CALLOUTS.map((c, i) => {
        const s = calloutState(c.bind, snap, 0, alert, stale)
        const valCls =
          s.state === 'alarm'
            ? 'text-alm [text-shadow:0_0_5px_rgb(var(--alm)_/_0.6)]'
            : s.state === 'warn'
              ? 'text-dat'
              : s.state === 'swept'
                ? 'text-ink-1'
                : 'text-col'
        return (
          <div
            key={i}
            className={`pointer-events-none absolute z-[6] hidden max-w-[220px] transition-opacity duration-500 min-[769px]:block ${stale ? 'opacity-50' : ''}`}
            style={{
              left: `${c.l.x}%`,
              top: `${c.l.y}%`,
              transform: c.side === 'left' ? 'translateX(-100%)' : 'none',
            }}
          >
            <span className="block truncate text-[7.5px] uppercase tracking-[0.14em] text-acc [text-shadow:0_0_3px_rgb(var(--acc)_/_0.45)]">
              {s.key}
            </span>
            <span className={`block whitespace-nowrap text-[9.5px] tracking-[0.04em] tabular-nums ${valCls}`}>
              {s.val}
              <span
                className={`ml-1.5 border px-1 text-[7.5px] tracking-[0.18em] ${
                  s.state === 'alarm'
                    ? 'border-alm/60 text-alm'
                    : s.state === 'warn'
                      ? 'border-dat/60 text-dat'
                      : 'border-ink-3/50 text-ink-3'
                }`}
              >
                {s.pill}
              </span>
            </span>
          </div>
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// The model core plate: the big glowing VRAM figure inside the core ring,
// DOM over the canvas so the numerals stay crisp. Sits dead centre; the
// glow strength rides the conductor heat.
// ---------------------------------------------------------------------------

function CorePlate({ snap, heat, stale }) {
  const vr = vramStats(snap)
  const act = activeOf(snap)
  const offline = !snap || snap.mode === 'offline'
  const glow = stale ? 0.35 : 0.45 + Math.min(1, heat) * 0.4
  const tone = vr.pct != null && vr.pct >= 0.9 ? 'var(--alm)' : vr.pct != null && vr.pct >= 0.75 ? 'var(--dat)' : 'var(--col)'
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[6] flex flex-col items-center justify-center gap-0.5 text-center"
      aria-label="Model core, VRAM ring gauge"
    >
      <span className="text-[8px] tracking-[0.3em] text-acc [text-shadow:0_0_4px_rgb(var(--acc)_/_0.5)]">MODEL CORE</span>
      <span
        className="or-vt text-[40px] leading-none tabular-nums text-ink-1"
        style={{ textShadow: `0 0 ${Math.round(10 + glow * 14)}px rgb(${tone} / 0.75), 0 0 3px rgb(var(--dat) / 0.5)` }}
      >
        {vr.gb != null ? vr.gb.toFixed(1) : '—'}
      </span>
      <span className="text-[10px] tracking-[0.2em] tabular-nums text-ink-2">
        / {vr.total != null ? vr.total.toFixed(0) : '—'} GB · VRAM
      </span>
      <span className="mt-1 max-w-[240px] truncate border border-acc/25 bg-black/45 px-2 py-px text-[8px] tracking-[0.14em] text-ink-2">
        {offline ? 'FEED HELD · CORE SETTLED' : `${(act.model || 'NO MODEL').toUpperCase()} · KV ${vr.cache != null ? vr.cache : '—'}%`}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inset canvases (decode scope bottom-left, VRAM map top-right). Hidden on
// phones where they would crowd the hero.
// ---------------------------------------------------------------------------

function ScopeInset() {
  const { tick, snap } = useScene()
  const k = (snap && snap.kpi) || {}
  const scan = ((Math.max(0, Math.floor(tick)) % 12) + 4) % 12 + 1
  return (
    <div className="or-inset absolute bottom-[18px] left-[18px] z-[7] hidden h-[132px] w-[168px] min-[769px]:block" aria-label="Decode scope inset">
      <SceneCanvas draw={paintDecodeScope} label="Decode rate trace, tok per second" className="h-full w-full" />
      <div className="or-crosshair" aria-hidden="true" />
      <div className="absolute top-1 left-1.5 text-[7.5px] tracking-[0.18em] text-acc [text-shadow:0_0_3px_rgb(0_0_0_/_0.85)]">
        SCOPE · DECODE<span className="ml-1 text-[6.5px] tracking-[0.2em] text-ink-3">· TOK/S · 120T</span>
      </div>
      <div className="absolute right-1.5 bottom-1 text-[7px] tracking-[0.1em] text-dat [text-shadow:0_0_3px_rgb(0_0_0_/_0.85)] tabular-nums">
        {k.tps != null ? `${Math.round(k.tps)} TOK/S` : '—'} · SCAN {String(scan).padStart(2, '0')}/12
      </div>
    </div>
  )
}

function VramMapInset() {
  const { tick } = useScene()
  const total = Math.max(0, Math.floor(tick)) + 14 * 3600 + 20 * 60
  const hh = String(Math.floor(total / 3600) % 24).padStart(2, '0')
  const mm = String(Math.floor(total / 60) % 60).padStart(2, '0')
  return (
    <div className="or-inset absolute top-[18px] right-[18px] z-[7] hidden h-[110px] w-[168px] min-[769px]:block" aria-label="VRAM map inset">
      <SceneCanvas draw={paintVramMap} label="VRAM pool block map" className="h-full w-full" />
      <div className="absolute top-1 left-1.5 text-[7.5px] tracking-[0.18em] text-acc [text-shadow:0_0_3px_rgb(0_0_0_/_0.85)]">
        VRAM · BLOCKS<span className="ml-1 text-[6.5px] tracking-[0.2em] text-ink-3">· POOL MAP · 1 BLK/GB</span>
      </div>
      <div className="absolute right-1.5 bottom-1 text-[7px] tracking-[0.1em] text-dat [text-shadow:0_0_3px_rgb(0_0_0_/_0.85)] tabular-nums">
        POOL · {hh}:{mm}
      </div>
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
  return <div key={flare.seq} className="or-flare pointer-events-none absolute inset-0 z-[9]" aria-hidden="true" />
}

// ---------------------------------------------------------------------------
// Scene root
// ---------------------------------------------------------------------------

export default function OrbitScene() {
  const { snap, conductor, mode } = useScene()
  const offline = mode === 'offline'
  const heat = Math.min(1, conductor.heat)
  const alert = Math.min(1, conductor.alert)
  const stale = staleOf(snap)

  return (
    <div className="or-stage relative flex min-h-dvh flex-col overflow-x-hidden pb-[var(--chrome-h)] font-mono text-ink-1 min-[769px]:h-dvh min-[769px]:min-h-0 min-[769px]:overflow-hidden">
      {/* stage atmosphere: engineering grid, wash, vignette, grain */}
      <div className="or-wash pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="or-grid pointer-events-none absolute inset-0" aria-hidden="true" />

      <EdgeTop />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col min-[769px]:flex-row">
        <LeftRail />

        {/* the stage: between the rails on desktop, 55 vh hero on phones.
            It has to hold its own flex slot: taken out of flow, the right
            rail slides into its place and paints underneath it. */}
        <section
          className="relative h-[55vh] min-h-[320px] overflow-hidden min-[769px]:h-auto min-[769px]:min-h-0 min-[769px]:min-w-0 min-[769px]:flex-1"
          aria-label="Context orbit stage, KV slots around the model core"
        >
          <SceneCanvas draw={paintOrbit} label="Context orbit, KV slot pods around the model core" className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${stale ? 'opacity-60' : ''}`} />
          <div className="or-scan pointer-events-none absolute inset-0 z-[8]" aria-hidden="true" />
          <div className="or-glow pointer-events-none absolute inset-0 z-[4]" aria-hidden="true" />
          <SlotStrip />
          <LeaderLayer snap={snap} alert={alert} stale={stale} />
          <CorePlate snap={snap} heat={heat} stale={stale} />
          <ScopeInset />
          <VramMapInset />
          <FlareLayer conductor={conductor} />
        </section>

        <RightRail />
      </div>

      {/* stamp plates: static cards on phones, floating plates on desktop;
          the pressure alert card anchors to the root */}
      <StampTitle />
      <StampData />
      <StampPlate />
      <PressureCard />

      <EdgeBot />

      <div className="or-vignette pointer-events-none absolute inset-0 z-[60] hidden min-[769px]:block" aria-hidden="true" />
      <div className="or-grain pointer-events-none absolute inset-0 z-[70] hidden min-[769px]:block" aria-hidden="true" />

      {/* one-shot lock-on sweep on mount (finite; degenerates under
          reduced motion via the global rule) */}
      <div className="or-boot pointer-events-none absolute inset-0 z-[80] hidden min-[769px]:block" aria-hidden="true" />
    </div>
  )
}

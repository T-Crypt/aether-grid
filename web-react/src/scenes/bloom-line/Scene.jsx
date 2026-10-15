// Bloom-Line scene root: the orbital-greenhouse console (uispace.org/bloom-line
// recreation). A full-bleed bioreactor schematic stage (canvas + leader-line
// callouts + sodium glow + two inset canvases + serif call popup + engineering
// stamp plates) framed by asymmetric rails (left 156 px, right 200 px) with
// top/bottom edge bars. Everything animates off the shared conductor clock;
// the scene owns no timers. Below 768 px the rails hide, the canvas becomes a
// 55 vh hero, the edges wrap to strips and the stamps stack as full-width
// cards, as in the reference.

import '@fontsource/cormorant-garamond'
import '@fontsource/cormorant-garamond/400-italic.css'
import SceneCanvas from '../../scene/Canvas'
import { useScene } from '../../scene/SceneRoot'
import { paintBioreactor, paintMicro, paintAlgae } from './painters'
import { CALLOUTS, growDay } from './shared'
import SpeciesStrip from './SpeciesStrip'
import CallPopup from './CallPopup'
import LeftRail from './LeftRail'
import RightRail from './RightRail'
import { EdgeTop, EdgeBot } from './EdgeBars'
import { StampTitle, StampPlate, StampData } from './StampPlates'

// ---------------------------------------------------------------------------
// Leader lines + callout chips: the reference's 18 anchor dots with leader
// lines (SVG, stretched to the stage) and their DOM label chips. Each callout
// binds to a telemetry source (shared.js `bind` keys); the dot/line take the
// alarm tint when its bound state crosses into alert, amber on warn.
// ---------------------------------------------------------------------------

function calloutState(bind, snap, heat, alert, flow) {
  const k = (snap && snap.kpi) || {}
  const sessions = (snap && snap.sessions) || []
  const flagged = sessions.filter((s) => s.window && (s.used || 0) / s.window >= 0.85).length
  const engines = (snap && snap.engines) || []
  const co2 = Math.round(700 + heat * 40)
  const o2 = (20.9 - heat * 0.4).toFixed(1)
  switch (bind) {
    case 'bloom':
      return {
        state: alert > 0.25 ? 'alarm' : 'normal',
        val: 'FLOWERED +3d EARLY',
        pill: 'UNSCHED',
      }
    case 'harv':
      return { state: 'normal', val: 'HARV. 4d', pill: 'TRACK' }
    case 'warn':
      return { state: heat > 0.55 ? 'warn' : 'normal', val: 'HARV. 2d', pill: 'TRACK' }
    case 'hydro':
      return { state: 'normal', val: `${Math.round(140 + heat * 30)} ppm N`, pill: 'NOM' }
    case 'ph': {
      const ph = (6.2 + ((k.tps || 0) % 7) / 100).toFixed(2)
      return { state: 'normal', val: ph, pill: 'NOM' }
    }
    case 'co2':
      return { state: heat > 0.55 ? 'warn' : 'normal', val: `${co2} ppm`, pill: heat > 0.55 ? 'BOOST' : 'NOM' }
    case 'o2':
      return { state: 'normal', val: `${o2}%`, pill: 'NOM' }
    case 'drones':
      return {
        state: flagged ? 'alarm' : 'normal',
        val: flagged ? `${flagged} → P23` : `${Math.min(28, sessions.length || 0)} / 28`,
        pill: flagged ? 'FLAG' : 'STBY',
      }
    case 'hab': {
      const down = engines.some((e) => e && e.up === false)
      return { state: down ? 'warn' : 'normal', val: down ? 'СБОЙ' : 'ОНЛАЙН', pill: down ? 'WARN' : 'NOM' }
    }
    case 'comm': {
      const off = !snap || snap.mode === 'offline'
      return { state: off ? 'warn' : 'normal', val: off ? 'NO LINK' : '5.0s LAT', pill: off ? 'LOSE' : 'OPEN' }
    }
    case 'water':
      return { state: heat > 0.55 ? 'warn' : 'normal', val: `${(92 + heat * 6).toFixed(1)}%`, pill: heat > 0.55 ? 'BOOST' : 'NOM' }
    case 'grow':
      return { state: 'normal', val: `DAY ${snap ? growDay(snap) : '—'}`, pill: 'GROW' }
    default:
      return { state: 'normal', val: 'NOM', pill: 'NOM' }
  }
}

function LeaderLayer({ snap, heat, alert, flow }) {
  const VBX = 1244
  const VBY = 834
  return (
    <>
      <svg
        viewBox={`0 0 ${VBX} ${VBY}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 z-[5] hidden h-full w-full min-[769px]:block"
        aria-hidden="true"
      >
        {CALLOUTS.map((c, i) => {
          const s = calloutState(c.bind, snap, heat, alert, flow).state
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
        const s = calloutState(c.bind, snap, heat, alert, flow)
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
            className="pointer-events-none absolute z-[6] hidden max-w-[220px] min-[769px]:block"
            style={{
              left: `${c.l.x}%`,
              top: `${c.l.y}%`,
              transform: c.side === 'left' ? 'translateX(-100%)' : 'none',
            }}
            title={c.lat}
          >
            <span className="block text-[7.5px] uppercase tracking-[0.14em] text-acc [text-shadow:0_0_3px_rgb(var(--acc)_/_0.45)]">
              {c.cyr}
            </span>
            <span className="block truncate text-[9px] uppercase tracking-[0.08em] text-ink-1 [text-shadow:0_0_3px_rgb(var(--acc)_/_0.2)]">
              {c.lat}
            </span>
            <span className={`block text-[9.5px] tracking-[0.04em] tabular-nums ${valCls}`}>
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
// Inset canvases (micro filament bottom-left, algae bloom top-right). Hidden
// on phones where they would crowd the hero (reference mobile strategy).
// ---------------------------------------------------------------------------

function MicroInset() {
  const { tick } = useScene()
  const scan = ((Math.max(0, Math.floor(tick)) % 12) + 4) % 12 + 1
  return (
    <div className="bl-inset absolute bottom-[18px] left-[18px] z-[7] hidden h-[132px] w-[168px] min-[769px]:block" aria-label="Filament microscopy inset">
      <SceneCanvas draw={paintMicro} label="Filament microscopy, 400x" className="h-full w-full" />
      <div className="bl-crosshair" aria-hidden="true" />
      <div className="absolute top-1 left-1.5 text-[7.5px] tracking-[0.18em] text-acc [text-shadow:0_0_3px_rgb(0_0_0_/_0.85)]">
        МИКРОСК. · РЕД<span className="ml-1 text-[6.5px] tracking-[0.2em] text-ink-3">· FILAMENT · 400×</span>
      </div>
      <div className="absolute right-1.5 bottom-1 text-[7px] tracking-[0.1em] text-dat [text-shadow:0_0_3px_rgb(0_0_0_/_0.85)] tabular-nums">
        SCAN {String(scan).padStart(2, '0')} / 12
      </div>
    </div>
  )
}

function AlgaeInset() {
  const { tick } = useScene()
  const total = Math.max(0, Math.floor(tick)) + 22 * 3600 + 10 * 60
  const hh = String(Math.floor(total / 3600) % 24).padStart(2, '0')
  const mm = String(Math.floor(total / 60) % 60).padStart(2, '0')
  return (
    <div className="bl-inset absolute top-[18px] right-[18px] z-[7] hidden h-[110px] w-[168px] min-[769px]:block" aria-label="Algae bloom satellite inset">
      <SceneCanvas draw={paintAlgae} label="Algae bloom, satellite view" className="h-full w-full" />
      <div className="absolute top-1 left-1.5 text-[7.5px] tracking-[0.18em] text-acc [text-shadow:0_0_3px_rgb(0_0_0_/_0.85)]">
        СПУТНИК · ВОДОР.<span className="ml-1 text-[6.5px] tracking-[0.2em] text-ink-3">· ALGAE BLOOM · L2</span>
      </div>
      <div className="absolute right-1.5 bottom-1 text-[7px] tracking-[0.1em] text-dat [text-shadow:0_0_3px_rgb(0_0_0_/_0.85)] tabular-nums">
        SAT-04 · {hh}:{mm}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Scene root
// ---------------------------------------------------------------------------

export default function BloomLineScene() {
  const { snap, conductor, mode } = useScene()
  const offline = mode === 'offline'
  const heat = Math.min(1, conductor.heat)
  const alert = Math.min(1, conductor.alert)
  const flow = Math.min(1, conductor.flow)

  return (
    <div className="bl-stage relative flex min-h-dvh flex-col overflow-x-hidden font-mono text-ink-1 min-[769px]:h-dvh min-[769px]:min-h-0 min-[769px]:overflow-hidden">
      {/* stage atmosphere: engineering grid, wash, vignette, grain */}
      <div className="bl-wash pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="bl-grid pointer-events-none absolute inset-0" aria-hidden="true" />

      <EdgeTop />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col min-[769px]:flex-row">
        <LeftRail />

        {/* the stage: between the rails on desktop, 55 vh hero on phones */}
        <section
          className="relative h-[55vh] min-h-[320px] overflow-hidden min-[769px]:absolute min-[769px]:inset-y-0 min-[769px]:left-[156px] min-[769px]:right-[200px] min-[769px]:h-auto min-[769px]:min-h-0"
          aria-label="Bioreactor schematic stage"
        >
          <SceneCanvas draw={paintBioreactor} label="Bioreactor schematic, orbital greenhouse" className="absolute inset-0 h-full w-full" />
          <div className="bl-sodium pointer-events-none absolute inset-0 z-[4]" aria-hidden="true" />
          <SpeciesStrip />
          <LeaderLayer snap={snap} heat={heat} alert={alert} flow={flow} />
          <MicroInset />
          <AlgaeInset />
        </section>

        <RightRail />
      </div>

      {/* stamp plates: static cards on phones, floating plates on desktop;
          the call popup anchors to the root like the reference */}
      <StampTitle />
      <StampData />
      <StampPlate />
      <CallPopup />

      <EdgeBot />

      <div className="bl-vignette pointer-events-none absolute inset-0 z-[60] hidden min-[769px]:block" aria-hidden="true" />
      <div className="bl-grain pointer-events-none absolute inset-0 z-[70] hidden min-[769px]:block" aria-hidden="true" />
    </div>
  )
}

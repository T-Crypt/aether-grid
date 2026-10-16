// Deepsignal scene root: the SETI night-shift console (deepsignal card
// recreation). A Family-C CRT bezel frames the scrolling 1.4–1.5 GHz
// waterfall (single 2D canvas on the shared conductor clock); dense text
// modules rail both sides; edge strips carry the outpost meta, the WOW!-2
// flag and the bot-log ticker. Everything animates off conductor.t — the
// scene owns no timers. Below 768 px the rails hide and the viewport is a
// 55 vh hero; the stage stretches (never letterboxes) past 1920 px.

import SceneCanvas from '../../scene/Canvas'
import { useScene } from '../../scene/SceneRoot'
import { paintWaterfall } from './painters'
import { bandBins, candScore, sastOf } from './shared'
import { EdgeTop, EdgeBot } from './EdgeBars'
import { LeftRail, RightRail } from './Rails'

function bandColor(v, hot, pal) {
  const acc = (pal && pal.acc) || '125 184 196'
  const dat = (pal && pal.dat) || '91 232 114'
  const col = (pal && pal.col) || '255 176 0'
  if (hot) return `rgb(${col} / ${0.45 + v * 0.55})`
  if (v > 0.62) return `rgb(${dat} / ${0.3 + v * 0.6})`
  return `rgb(${acc} / ${0.12 + v * 0.5})`
}

// 200-tick band strip: DOM cells fed at feed rate, settling via the
// .ds-band-i CSS transition.
function BandStrip({ snap, conductor }) {
  const { bins, spike } = bandBins(snap, conductor)
  const hot = spike > 0.25 && snap && snap.mode !== 'offline'
  return (
    <div className="flex h-[10px] min-w-0 flex-1 items-stretch gap-px overflow-hidden" role="img" aria-label="Band strip, 200 ticks">
      {bins.map((v, i) => {
        const near = Math.abs(i / 199 - 0.62) < 0.012
        return <i key={i} className="ds-band-i min-w-0 flex-1" style={{ backgroundColor: bandColor(v, hot && near, conductor.palette) }} aria-hidden="true" />
      })}
    </div>
  )
}

function Viewport({ snap, conductor }) {
  const offline = !snap || snap.mode === 'offline'
  const cs = candScore(snap, conductor)
  return (
    <section className="relative h-[55vh] min-h-[380px] min-w-0 flex-1 overflow-hidden min-[769px]:h-auto min-[769px]:min-h-0" aria-label="Waterfall viewport, 1.4 to 1.5 gigahertz">
      <div className="ds-bezel absolute inset-1.5 min-[769px]:inset-2">
        <SceneCanvas draw={paintWaterfall} label="Scrolling waterfall, 1.4 to 1.5 gigahertz" className="absolute inset-0 h-full w-full" />
        {/* CRT FX stack: CSS layers only */}
        <div className="ds-scanlines pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="ds-chromatic pointer-events-none absolute inset-0 hidden min-[769px]:block" aria-hidden="true" />
        <div className="ds-flicker pointer-events-none absolute inset-0 hidden min-[769px]:block" aria-hidden="true" />
        <div className="ds-grain pointer-events-none absolute inset-0 hidden min-[769px]:block" aria-hidden="true" />
        <div className="ds-vignette pointer-events-none absolute inset-0" aria-hidden="true" />

        {/* top: band strip + sky card */}
        <div className="absolute inset-x-0 top-0 z-[5] flex min-w-0 items-center gap-2 p-2">
          <BandStrip snap={snap} conductor={conductor} />
          <span className="hidden shrink-0 border border-acc/25 bg-black/50 px-1.5 py-0.5 text-[8px] tracking-[0.16em] text-ink-2 sm:block">
            SKY · GJ 1132 <span className="text-acc">TRACK</span>
          </span>
        </div>

        {/* mid: classifier card + halcyon mark */}
        <div className="absolute top-[26px] left-2 z-[5] hidden min-w-0 border border-acc/25 bg-black/55 px-2 py-1 sm:block" aria-label="Signal classifier">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-[8px] tracking-[0.18em] text-ink-3">CANDIDATE</span>
            <span className={`truncate text-[15px] tabular-nums ${cs.confirmed && !offline ? 'text-col' : 'text-ink-1'}`}>
              {offline ? '—' : cs.score}
            </span>
            <span className="shrink-0 text-[8px] tracking-[0.14em] text-ink-3">{offline ? 'HOLD' : cs.confirmed ? 'REC · ESCALATE' : 'REC · WATCH'}</span>
          </div>
          <div className="mt-0.5 truncate text-[8px] tracking-[0.1em] text-ink-3">NARROWBAND · DOPPLER MATCH · NO KNOWN INTF</div>
        </div>
        <div className="absolute top-[26px] right-2 z-[5] hidden text-right md:block" aria-hidden="true">
          <div className="text-[8px] tracking-[0.2em] text-ink-3">HALCYON SYSTEMS · ALLI · 2154</div>
        </div>

        {/* bottom: freq axis + time axis + note line */}
        <div className="absolute inset-x-0 bottom-0 z-[5] p-2">
          <div className="flex min-w-0 justify-between text-[8px] tabular-nums text-ink-3">
            <span>1.40</span>
            <span className="text-acc">▲ 1420 · CANDIDATE LANE</span>
            <span>1.50 GHz</span>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center justify-between gap-2 text-[8px] tabular-nums">
            <span className="min-w-0 truncate text-ink-3 italic">night shift, third coffee — the line held at 1420.</span>
            <span className="shrink-0 text-ink-2">T−{(snap && snap.t != null ? Math.max(0, 900 - Math.floor(snap.t % 900)) : 900)}s · {offline ? '—' : sastOf(snap)} SAST</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function DeepsignalScene() {
  const { snap, conductor } = useScene()
  return (
    <div className="ds-stage relative flex min-h-dvh flex-col overflow-x-hidden pb-[var(--chrome-h)] font-mono text-ink-1 min-[769px]:h-dvh min-[769px]:min-h-0 min-[769px]:overflow-hidden">
      <EdgeTop snap={snap} />
      <div className="mx-auto flex min-h-0 w-full max-w-[1920px] min-[769px]:flex-1 min-[769px]:flex-row">
        <LeftRail snap={snap} conductor={conductor} />
        <Viewport snap={snap} conductor={conductor} />
        <RightRail snap={snap} />
      </div>
      <EdgeBot snap={snap} conductor={conductor} />
      <div className="ds-vignette pointer-events-none absolute inset-0 z-[60] hidden min-[769px]:block" aria-hidden="true" />
      <div className="ds-grain pointer-events-none absolute inset-0 z-[70] hidden min-[769px]:block" aria-hidden="true" />
    </div>
  )
}

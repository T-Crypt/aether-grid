// Logit Spectrum scene root: the token spectrogram console (a cold CRT
// bezel framing the falling time axis on a single 2D canvas on the shared
// conductor clock); dense text modules rail both sides; edge strips carry
// the runtime meta, the anomaly flag and the event-log ticker. Everything
// animates off conductor.t — the scene owns no timers. Below 768 px the
// rails hide and the viewport is a 55 vh hero; the stage stretches (never
// letterboxes) past 1920 px. The .sp-boot overlay plays a one-shot lock-on
// sweep on mount and degenerates instantly under reduced motion.

import SceneCanvas from '../../scene/Canvas'
import { useScene } from '../../scene/SceneRoot'
import { paintSpectrogram } from './painters'
import { lanesOf, lockScore, clockOf } from './shared'
import { EdgeTop, EdgeBot } from './EdgeBars'
import { LeftRail, RightRail } from './Rails'

function stripColor(v, hot, pal) {
  const acc = (pal && pal.acc) || '125 184 196'
  const dat = (pal && pal.dat) || '91 232 114'
  const col = (pal && pal.col) || '255 176 0'
  if (hot) return `rgb(${col} / ${0.45 + v * 0.55})`
  if (v > 0.62) return `rgb(${dat} / ${0.3 + v * 0.6})`
  return `rgb(${acc} / ${0.12 + v * 0.5})`
}

// 200-tick phase strip: DOM cells fed at feed rate, settling via the
// .sp-strip-i CSS transition. Three lanes of cells read the three lane amps
// (think / decode / mtp), so the strip mirrors the spectrogram's lanes.
function PhaseStrip({ snap, conductor }) {
  const lanes = lanesOf(snap, conductor)
  const amps = [lanes.think, lanes.decode, lanes.mtp]
  const spike = lanes.spike
  const hot = spike > 0.25 && snap && snap.mode !== 'offline'
  const n = 200
  return (
    <div className="flex h-[10px] min-w-0 flex-1 items-stretch gap-px overflow-hidden" role="img" aria-label="Phase strip, 200 ticks across think decode mtp">
      {Array.from({ length: n }, (_, i) => {
        const lane = Math.min(2, Math.floor((i / n) * 3))
        const pos = (i % (n / 3)) / (n / 3 - 1)
        const lobe = Math.exp(-Math.pow((pos - 0.5) / 0.6, 2))
        const v = Math.min(1, amps[lane] * lobe * 1.2 + 0.06)
        return <i key={i} className="sp-strip-i min-w-0 flex-1" style={{ backgroundColor: stripColor(v, hot && lane === 1, conductor.palette) }} aria-hidden="true" />
      })}
    </div>
  )
}

function Viewport({ snap, conductor }) {
  const offline = !snap || snap.mode === 'offline'
  const lock = lockScore(snap, conductor)
  const k = (snap && snap.kpi) || {}
  return (
    <section className="relative h-[55vh] min-h-[380px] min-w-0 flex-1 overflow-hidden min-[769px]:h-auto min-[769px]:min-h-0" aria-label="Token spectrogram viewport, think decode and mtp lanes">
      <div className="sp-bezel absolute inset-1.5 min-[769px]:inset-2">
        <SceneCanvas draw={paintSpectrogram} label="Token spectrogram, time falling toward now" className="absolute inset-0 h-full w-full" />
        {/* CRT FX stack: CSS layers only */}
        <div className="sp-scanlines pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="sp-chromatic pointer-events-none absolute inset-0 hidden min-[769px]:block" aria-hidden="true" />
        <div className="sp-flicker pointer-events-none absolute inset-0 hidden min-[769px]:block" aria-hidden="true" />
        <div className="sp-grain pointer-events-none absolute inset-0 hidden min-[769px]:block" aria-hidden="true" />
        <div className="sp-vignette pointer-events-none absolute inset-0" aria-hidden="true" />

        {/* top: phase strip + lock chip */}
        <div className="absolute inset-x-0 top-0 z-[5] flex min-w-0 items-center gap-2 p-2">
          <PhaseStrip snap={snap} conductor={conductor} />
          <span className="hidden shrink-0 border border-acc/25 bg-black/50 px-1.5 py-0.5 text-[8px] tracking-[0.16em] text-ink-2 sm:block">
            SPEC · <span className="text-acc">REASONING LOCK</span>
          </span>
        </div>

        {/* mid: the reasoning lock card — the headline overlay, big glowing
            score off the reasoning feed */}
        <div className="absolute top-[30px] left-2 z-[5] hidden min-w-0 border border-acc/25 bg-black/55 px-2.5 py-1.5 sm:block" aria-label="Reasoning lock score">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-[8px] tracking-[0.18em] text-ink-3">REASONING LOCK</span>
            <span
              className={`sp-vt shrink-0 text-[34px] leading-none tabular-nums ${
                offline ? 'text-ink-2' : lock.confirmed ? 'text-col' : 'text-dat'
              }`}
              style={{ textShadow: '0 0 14px rgb(var(--col) / 0.55), 0 0 4px rgb(var(--dat) / 0.5)' }}
            >
              {offline ? '—' : lock.score != null ? lock.score : '—'}
            </span>
            <span className="shrink-0 text-[10px] tracking-[0.14em] text-ink-2">% MTP</span>
            <span className="shrink-0 text-[8px] tracking-[0.14em] text-ink-3">{offline ? 'HOLD' : lock.confirmed ? 'LOCK · ALERT' : 'LOCK · WATCH'}</span>
          </div>
          <div className="mt-1 truncate text-[8px] tracking-[0.1em] text-ink-3">
            {offline ? 'FEED HELD · SPECTROGRAM SETTLED' : `THINK LANE ${lanesOf(snap, conductor).think > 0 ? 'ACTIVE' : 'IDLE'} · DECODE ${k.tps != null ? Math.round(k.tps) : '—'} TOK/S`}
          </div>
        </div>
        <div className="absolute top-[26px] right-2 z-[5] hidden text-right md:block" aria-hidden="true">
          <div className="text-[8px] tracking-[0.2em] text-ink-3">AETHER GRID · LOCAL LLM RUNTIME</div>
        </div>

        {/* bottom: time axis — the lane names print on the canvas centre */}
        <div className="absolute inset-x-0 bottom-0 z-[5] flex min-w-0 justify-between p-2 text-[8px] tabular-nums text-ink-3">
          <span>−7 S</span>
          <span>NOW</span>
        </div>
      </div>
    </section>
  )
}

export default function SpectrumScene() {
  const { snap, conductor } = useScene()
  return (
    <div className="sp-stage relative flex min-h-dvh flex-col overflow-x-hidden pb-[var(--chrome-h)] font-mono text-ink-1 min-[769px]:h-dvh min-[769px]:min-h-0 min-[769px]:overflow-hidden">
      <EdgeTop snap={snap} conductor={conductor} />
      <div className="mx-auto flex min-h-0 w-full max-w-[1920px] min-[769px]:flex-1 min-[769px]:flex-row">
        <LeftRail snap={snap} conductor={conductor} />
        <Viewport snap={snap} conductor={conductor} />
        <RightRail snap={snap} conductor={conductor} />
      </div>
      <EdgeBot snap={snap} conductor={conductor} />
      <div className="sp-vignette pointer-events-none absolute inset-0 z-[60] hidden min-[769px]:block" aria-hidden="true" />
      <div className="sp-grain pointer-events-none absolute inset-0 z-[70] hidden min-[769px]:block" aria-hidden="true" />
      {/* one-shot lock-on sweep on mount (finite; degenerates under
          reduced motion via the global rule) */}
      <div className="sp-boot pointer-events-none absolute inset-0 z-[80] hidden min-[769px]:block" aria-hidden="true" />
    </div>
  )
}

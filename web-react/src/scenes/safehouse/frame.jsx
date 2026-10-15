// Safehouse shared chrome: the reference's framed panel grammar (title bar +
// hairline frame) and small deterministic helpers. This scene never owns a
// timer; transient row flashes restart a finite CSS animation by re-keying
// the element, and all derived readouts are stable hash functions of the
// data they decorate.

import { useMemo } from 'react'
import { useScene } from '../../scene/SceneRoot'

// ---------------------------------------------------------------------------
// Deterministic helpers (no RNG: the scene must replay identically on reload
// and settle identically under reduced motion).
// ---------------------------------------------------------------------------

export function det(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export function hashCode(s) {
  let h = 0
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) | 0
  return Math.abs(h)
}

export function hexFrom(seed, len) {
  const chars = '0123456789ABCDEF'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(det(hashCode(seed) + i * 13.7) * 16)]
  return s
}

export function pad(n, w = 2) {
  return String(n).padStart(w, '0')
}

// The one engine this scene tracks: the first engine that is up. Everything
// sat/target-related keys off it; null means the panel ghosts.
export function useTarget() {
  const { snap } = useScene()
  const engines = useMemo(() => (snap && snap.engines) || [], [snap])
  return { engines, target: engines.find((e) => e && e.up) || null }
}

// Tick-based timecode: HH:MM:SS:FF where the frame field advances 24 frames
// per feed tick, so the readout marches at feed rate without a scene timer.
export function tickTimecode(tick, seedSec = 0) {
  const total = Math.max(0, Math.floor(tick)) + seedSec
  const ff = ((Math.max(0, tick) % 1) * 24) | 0
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600) % 24
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(ff)}`
}

export function frameCounter(tick, seed = 0) {
  return pad(Math.max(0, Math.floor(tick)) * 24 + seed, 6)
}

// ---------------------------------------------------------------------------
// Frame: the reference's framed grammar. A panel is a hairline-bordered box
// with a title bar (accent title, amber tag) and a body. Two states, from
// the scene's offline contract:
//   ghosted  the source is degraded: frame + title dim, body stays as-is
//   empty    the source is absent: body shows a "no source" note
// ---------------------------------------------------------------------------

export function Frame({ title, tag, ghosted = false, empty = false, note, className = '', bodyClass = '', children }) {
  return (
    <section
      aria-label={title}
      aria-busy={ghosted || empty || undefined}
      className={`sh-frame relative flex min-h-0 min-w-0 flex-col border border-acc/25 transition-opacity duration-500 ${
        ghosted ? 'sh-ghost' : ''
      } ${className}`}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-acc/25 px-1.5 pb-1 pt-0.5">
        <h3
          className={`truncate text-[7.5px] font-semibold uppercase tracking-[0.14em] ${
            ghosted || empty ? 'text-ink-3' : 'text-acc'
          }`}
        >
          {title}
        </h3>
        {tag != null ? <span className="shrink-0 text-[7px] uppercase tracking-[0.14em] text-dat">{tag}</span> : null}
      </header>
      <div className={`relative min-h-0 min-w-0 flex-1 ${bodyClass ?? ''}`}>
        {empty ? (
          <div className="flex h-full items-center justify-center">
            <span className="px-2 text-[8px] uppercase tracking-[0.2em] text-ink-3">{note || 'no source'}</span>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  )
}

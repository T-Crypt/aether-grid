// MarqueeStrip: the 60-second linear status marquee along the bottom, as
// in the reference: one track of status tokens (time · message, level
// coloured) duplicated so the CSS loop is seamless. The animation is pure
// CSS (sh-marquee-track); under reduced motion the track stops with the
// first token visible. No scene timer is involved.

import { useScene } from '../../scene/SceneRoot'

function clock(e) {
  if (!e.t) return '--:--:--'
  const d = new Date(e.t * 1000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

export default function MarqueeStrip() {
  const { snap } = useScene()
  const events = ((snap && snap.events) || []).slice(0, 12)

  if (events.length === 0) {
    return (
      <div
        aria-label="Status strip"
        className="hidden h-[14px] shrink-0 items-center border-y border-acc/25 bg-bgg/70 px-2 text-[7px] uppercase tracking-[0.1em] text-ink-3 md:flex"
      >
        NO EVENTS BUFFERED · STANDBY
      </div>
    )
  }

  const tone = (lvl) => (lvl === 'err' || lvl === 'alert' ? 'text-alm' : lvl === 'warn' ? 'text-dat' : 'text-ink-2')

  // Two copies of the token list: the track scrolls one track-width, so the
  // join between copy 1 and copy 2 is invisible.
  const track = (
    <div className="sh-marquee-track">
      {[0, 1].map((dup) => (
        <div key={dup} className="flex gap-6" aria-hidden={dup === 1 ? 'true' : undefined}>
          {events.map((e, i) => (
            <span key={`${dup}-${e.id ?? i}`} className="inline-flex items-baseline gap-1.5">
              <span className="tabular-nums text-dat">{clock(e)}</span>
              <span className="text-ink-3">·</span>
              <span className={tone(e.level || 'info')}>{String(e.msg || '').slice(0, 44)}</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  )

  return (
    <div
      aria-label="Status strip"
      className="hidden h-[14px] shrink-0 items-center overflow-hidden border-y border-acc/25 bg-bgg/70 text-[7px] uppercase tracking-[0.1em] md:flex"
    >
      {track}
    </div>
  )
}

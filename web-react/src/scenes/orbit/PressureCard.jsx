// PressureCard: the newest vram_pressure or anomaly event rendered as a
// VRAM PRESSURE ALERT over the stage. The level/figure lines are the event's
// own payload (pct, why); the message is the real alert text. ACK/CLEAR only
// hide this card until the next event; they clear nothing in the feed.
// Replaces the previous theme's incoming-call card with the same position
// and footprint.

import { useEffect, useState } from 'react'
import { useScene } from '../../scene/SceneRoot'

// The newest actionable pressure event off the conductor ring buffer.
// null = nothing live, the card stays hidden.
function pressureOf(conductor) {
  const events = conductor.events || []
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i]
    if (!ev) continue
    if (ev.type === 'vram_pressure' && ev.level !== 'ok') {
      return {
        key: `vp-${ev.seq}`,
        level: ev.level === 'crit' ? 'CRIT' : 'WARN',
        head: 'VRAM PRESSURE',
        figure: ev.pct != null ? `${Math.round(ev.pct * 100)}%` : null,
        sub: ev.why === 'power' ? 'BOARD DRAW CROSSING' : 'POOL CROSSING',
        msg: ev.why === 'power' ? 'Power draw crossed the pressure line' : 'VRAM crossed a pressure threshold',
      }
    }
    if (ev.type === 'anomaly' && (ev.level === 'err' || ev.level === 'warn')) {
      return {
        key: `an-${ev.seq}`,
        level: ev.level === 'err' ? 'CRIT' : 'WARN',
        head: ev.at === 'gpu' ? 'GPU ALERT' : 'KV ALERT',
        figure: null,
        sub: 'FEED EVENT',
        msg: String(ev.msg || '').slice(0, 60),
      }
    }
  }
  return null
}

export default function PressureCard() {
  const { conductor } = useScene()
  const alert = pressureOf(conductor)
  const [hiddenKey, setHiddenKey] = useState(null)
  // A new event reopens the card; the same event stays acknowledged.
  useEffect(() => {
    if (alert && alert.key !== hiddenKey) setHiddenKey(null)
  }, [alert, hiddenKey])

  if (!alert || alert.key === hiddenKey) return null

  const dismiss = () => setHiddenKey(alert.key)
  const crit = alert.level === 'CRIT'

  return (
    <div
      role="status"
      className="or-card absolute right-[216px] top-[172px] z-[22] hidden w-[220px] border border-alm bg-bgg/95 px-3 py-2.5 shadow-[0_6px_22px_rgb(0_0_0_/_0.5),0_0_16px_rgb(var(--alm)_/_0.35)] min-[769px]:block"
    >
      <div className="flex items-center justify-between gap-2 text-[8px] tracking-[0.2em] text-alm">
        <span>VRAM PRESSURE ALERT</span>
        <span className={`or-pip border px-1 ${crit ? 'bg-alm text-bgg border-alm' : 'border-alm text-alm'}`}>{alert.level}</span>
      </div>
      {alert.figure ? (
        <div className="or-vt mt-1 text-[30px] leading-none tabular-nums text-alm [text-shadow:0_0_12px_rgb(var(--alm)_/_0.6)]">
          {alert.figure}
        </div>
      ) : null}
      <div className="mt-0.5 text-[8px] tracking-[0.18em] text-ink-3">{alert.sub}</div>
      {alert.msg ? <div className="or-flash mt-1 line-clamp-2 text-[8px] uppercase leading-snug tracking-[0.08em] text-dat">{alert.msg}</div> : null}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="min-h-[26px] flex-1 border border-alm/40 px-1.5 py-1 text-[7.5px] tracking-[0.18em] text-ink-2 hover:border-alm/70"
        >
          CLEAR
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="min-h-[26px] flex-1 border border-alm px-1.5 py-1 text-[7.5px] tracking-[0.18em] text-alm hover:bg-alm/10"
        >
          ACK
        </button>
      </div>
    </div>
  )
}

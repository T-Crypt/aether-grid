// CallPopup: the newest actionable alert rendered as an incoming call over
// the stage (the card's closest conductor analog for the reference's popup).
// The name/loc line is a visual echo derived from the alert key — the
// message itself is the real alert text. Answer/postpone only hide this
// popup until the next alert; they clear nothing in the feed (brief).
// The name voice is the scene's serif face (Cormorant Garamond, italic).

import { useEffect, useState } from 'react'
import { useScene } from '../../scene/SceneRoot'
import { callOf } from './shared'

export default function CallPopup() {
  const { snap } = useScene()
  const call = callOf(snap)
  const [hiddenKey, setHiddenKey] = useState(null)
  // A new alert reopens the popup; the same alert stays dismissed.
  useEffect(() => {
    if (call && call.key !== hiddenKey) setHiddenKey(null)
  }, [call, hiddenKey])

  if (!call || call.key === hiddenKey) return null

  const dismiss = () => setHiddenKey(call.key)

  return (
    <div
      role="status"
      className="bl-call absolute right-[216px] top-[172px] z-[22] hidden w-[220px] border border-col bg-bgg/95 px-3 py-2.5 shadow-[0_6px_22px_rgb(0_0_0_/_0.5),0_0_16px_rgb(var(--col)_/_0.25)] min-[769px]:block"
    >
      <div className="text-[8px] tracking-[0.2em] text-col">INCOMING · L2 · LAGOS RELAY</div>
      <div className="bl-serif mt-1 text-[15px] italic leading-tight tracking-normal text-ink-1">{call.name}</div>
      <div className="mt-0.5 text-[8px] tracking-[0.18em] text-ink-3">{call.loc}</div>
      {call.msg ? <div className="mt-1 truncate text-[8px] uppercase tracking-[0.08em] text-dat">{call.msg}</div> : null}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="min-h-[26px] flex-1 border border-acc/40 px-1.5 py-1 text-[7.5px] tracking-[0.18em] text-ink-2 hover:border-acc/70"
        >
          POSTPONE
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="min-h-[26px] flex-1 border border-acc px-1.5 py-1 text-[7.5px] tracking-[0.18em] text-acc hover:bg-acc/10"
        >
          ANSWER
        </button>
      </div>
    </div>
  )
}

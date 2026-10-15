// SpeciesStrip: the 47-tick strip along the stage top. One tick per species;
// base ticks take the accent (species nominal), harvest ticks the data amber,
// and the bloom tick (P23) takes the alarm pink and pulses while an alert is
// live. States bind to the engine fleet: a tick whose engine is down ghosts,
// a tick whose engine is hot (KV fill past the warn line) shifts to amber.
// Cheap DOM (47 divs, no canvas, no timers).

import { useScene } from '../../scene/SceneRoot'
import { SPECIES, TANK_CODES, staleOf } from './shared'

export default function SpeciesStrip() {
  const { snap, conductor } = useScene()
  const engines = ((snap && snap.engines) || [])
  // Dormant strip: a stale feed clears the live scalars so the P23 bloom
  // tick stops pulsing and the fleet ghosts (rails show "no source").
  const stale = staleOf(snap)
  const alert = stale ? 0 : Math.min(1, conductor.alert)
  const heat = stale ? 0 : Math.min(1, conductor.heat)
  // MTP accept hurries the P23 bloom tick: an accepting run throbs faster
  // than a merely hot one (greenhouse rhythm, deterministic in the feed).
  const rs = (snap && snap.reasoning) || {}
  const mtp = stale ? 0 : rs.mtp_accept_pct != null ? Math.min(1, Math.max(0, rs.mtp_accept_pct / 100)) : 0

  const tickOf = (i) => {
    const sp = SPECIES[i]
    const e = engines.length ? engines[i % engines.length] : null
    const sess = (e && e.sessions) || []
    let used = 0
    let win = 0
    for (const s of sess) {
      used += s.used || 0
      win += s.window || 0
    }
    const fill = win > 0 ? used / win : 0
    const down = e && e.up === false
    if (sp.bloom) {
      const cls = 'bl-tick-bl'
      return { cls, title: `${sp.id} ${TANK_CODES[5]} · BLOOM`, hot: alert > 0.25 }
    }
    if (down) return { cls: 'bl-tick-dim', title: `${sp.id} ${TANK_CODES[i % 12]} · DOWN`, hot: false }
    if (sp.harvest || fill >= 0.6) return { cls: 'bl-tick-hv', title: `${sp.id} ${TANK_CODES[i % 12]} · HARVEST`, hot: false }
    if (fill >= 0.85) return { cls: 'bl-tick-hv', title: `${sp.id} · PRESSURE`, hot: false }
    return { cls: 'bl-tick', title: `${sp.id} ${TANK_CODES[i % 12]} · NOMINAL`, hot: false }
  }

  return (
    <div
      className="bl-strip pointer-events-none absolute inset-x-0 top-0 z-[6] flex h-3 items-center gap-px px-2"
      aria-label="Species strip"
    >
      {SPECIES.map((sp, i) => {
        const { cls, title, hot } = tickOf(i)
        return (
          <div
            key={sp.id}
            title={title}
            className={`h-1.5 min-w-0 flex-1 ${cls} ${hot ? 'bl-tick-live' : ''}`}
            style={hot ? { animationDuration: `${Math.max(0.45, 1.8 - heat * 0.6 - mtp * 0.8).toFixed(2)}s` } : undefined}
          />
        )
      })}
    </div>
  )
}

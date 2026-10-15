// COHORT / KV. The slot grid scope. 8x4 wells whose fill drives the cell
// tint and bar (DOM, at feed rate, eased by CSS transitions); a thin
// canvas on top flashes the slot the instant a kv_slot_changed event lands,
// so the grid pulses in the same frame as the rest of the scene.

import Scope from '../scene/Scope'
import SceneCanvas from '../scene/Canvas'
import { paintKvFlashes } from '../scene/paint'
import { wellState } from '../lib/format'
import { useScene } from '../scene/SceneRoot'
import useAnchor from '../scene/useAnchor'

const SLOTS = 32

const CELL = {
  alert: 'border-alm/70 bg-alm/25',
  warn: 'border-dat/60 bg-dat/20',
  ok: 'border-acc/50 bg-acc/20',
  off: 'border-ink-3/20 bg-ink-3/5',
}
const BAR = {
  alert: 'bg-alm',
  warn: 'bg-dat',
  ok: 'bg-acc',
  off: 'bg-ink-3/20',
}
const ID_TONE = { alert: 'text-ink-1', warn: 'text-ink-1', ok: 'text-ink-1', off: 'text-ink-3' }

export default function CohortGrid() {
  const { snap, mode } = useScene()
  const ref = useAnchor('kv')
  const rows = (snap.sessions || []).slice(0, SLOTS)
  const engines = snap.engines || []
  const hasSource = mode === 'demo' || (engines.some((e) => e.up) && rows.length > 0)
  const ghost = mode === 'boot' || mode === 'offline' || !hasSource
  const hot = rows.filter((s) => s.window && (s.used || 0) / s.window >= 0.85).length

  const cells = Array.from({ length: SLOTS }, (_, i) => {
    const s = rows[i]
    const f = s && s.window ? Math.min(1, (s.used || 0) / s.window) : 0
    const id = s ? String(s.id || `W${i + 1}`).slice(0, 8).toUpperCase() : '—'
    return { i, s, f, id, state: wellState(f) }
  })

  const top = [...cells].sort((a, b) => b.f - a.f).slice(0, 3).map((c) => c.i)

  return (
    <Scope
      id="sc-kv"
      title="COHORT / KV"
      eyebrow="slot grid"
      right={ghost ? undefined : `N ${rows.length} · HOT ${hot}`}
      ghosted={ghost}
      ghostNote="no engine reporting slots"
      className="min-h-[200px] flex-1"
    >
      <div ref={ref} className="relative flex-1">
        <div className="grid h-full grid-cols-8 gap-1">
          {cells.map((c) => (
            <div
              key={c.i}
              title={c.s ? `${c.id} ${c.s.used || 0}/${c.s.window || '?'}` : 'empty slot'}
              className={`relative flex min-h-0 items-end overflow-hidden border ${CELL[c.state]} ${
                top.includes(c.i) && c.f > 0 ? 'shadow-[0_0_10px_rgb(var(--alm)/0.4)] ring-1 ring-alm/60' : ''
              }`}
            >
              <span className={`px-1 pb-1 text-3xs tabular-nums ${ID_TONE[c.state]}`}>{c.id}</span>
              <span className="absolute inset-x-0 bottom-0 h-[3px] bg-black/25">
                <span
                  className={`block h-full ${BAR[c.state]} transition-[width] duration-500`}
                  style={{ width: `${(c.f * 100).toFixed(1)}%` }}
                />
              </span>
            </div>
          ))}
        </div>
        <SceneCanvas
          draw={(ctx, w, h, c) => paintKvFlashes(ctx, w, h, c)}
          className="pointer-events-none absolute inset-0"
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-2xs text-ink-3">
        <span>
          PLATE 03 · <span className="text-alm">B5 FLAGGED</span>
        </span>
        <span className="tabular-nums">
          N {rows.length} · HOT {hot}
        </span>
      </div>
    </Scope>
  )
}

import { motion } from 'framer-motion'
import { Boxes } from 'lucide-react'
import Panel from './Panel'
import { wellState } from '../lib/format'

const SLOTS = 32

const CELL = {
  alert: 'border-col/70 bg-col/25',
  warn: 'border-dat/60 bg-dat/20',
  ok: 'border-acc/50 bg-acc/20',
  off: 'border-ink-3/20 bg-ink-3/5',
}
const BAR = {
  alert: 'bg-col',
  warn: 'bg-dat',
  ok: 'bg-acc',
  off: 'bg-ink-3/20',
}
const ID_TONE = { alert: 'text-ink-1', warn: 'text-ink-1', ok: 'text-ink-1', off: 'text-ink-3' }

/**
 * Cohort / KV slot grid: 8x4 wells. Fill drives both the cell tint and the
 * bottom bar; the top-N hottest wells get a halo. Uses the shared session
 * list, exactly like renderCohort() in the static UI.
 */
export default function CohortPanel({ snap, stagger }) {
  const rows = (snap.sessions || []).slice(0, SLOTS)
  const hot = rows.filter((s) => s.window && (s.used || 0) / s.window >= 0.85).length

  const cells = Array.from({ length: SLOTS }, (_, i) => {
    const s = rows[i]
    const f = s && s.window ? Math.min(1, (s.used || 0) / s.window) : 0
    const id = s ? String(s.id || `W${i + 1}`).slice(0, 8).toUpperCase() : '—'
    return { i, s, f, id, state: wellState(f) }
  })

  const top = [...cells].sort((a, b) => b.f - a.f).slice(0, 3).map((c) => c.i)

  return (
    <Panel
      title="COHORT / KV"
      eyebrow="slot grid"
      icon={Boxes}
      right={`N ${rows.length} · HOT ${hot}`}
      stagger={stagger}
    >
      <div className="grid grid-cols-4 gap-1 sm:grid-cols-8">
        {cells.map((c) => (
          <motion.div
            key={c.i}
            whileHover={{ scale: 1.06 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26 }}
            title={c.s ? `${c.id} ${c.s.used || 0}/${c.s.window || '?'}` : 'empty slot'}
            className={`relative flex h-11 items-end overflow-hidden rounded border ${CELL[c.state]} ${
              top.includes(c.i) && c.f > 0 ? 'shadow-[0_0_10px_rgb(var(--col)/0.45)] ring-1 ring-col/60' : ''
            }`}
          >
            <span className={`px-1 pb-1.5 text-3xs tabular-nums ${ID_TONE[c.state]}`}>{c.id}</span>
            <span className="absolute inset-x-0 bottom-0 h-[3px] bg-black/25">
              <span
                className={`block h-full ${BAR[c.state]} transition-[width] duration-500`}
                style={{ width: `${(c.f * 100).toFixed(1)}%` }}
              />
            </span>
          </motion.div>
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-between text-2xs text-ink-3">
        <span>
          PLATE 03 · <span className="text-col">B5 FLAGGED</span>
        </span>
        <span className="tabular-nums">
          N {rows.length} · HOT {hot}
        </span>
      </div>
    </Panel>
  )
}

// EngineLock: the engine lock view. The procedural load lattice + desk
// sweep + lock-on brackets paint on the shared clock via paintEngines
// (canvas). The locked engine is the first up engine decoding; with none
// up the module ghosts: frames stay, the badge reads NO LOCK, dossier and
// lock card drop out. The overlay figures (load scale, engine tags) are
// real engine figures; the dossier prints the locked engine's identity
// from the feed.

import SceneCanvas from '../../scene/Canvas'
import { useScene } from '../../scene/SceneRoot'
import { paintEngines } from './painters'
import { Frame, hexFrom } from './frame.jsx'
import { decodeOf, modelOf, prefillOf, upEngines } from './shared'

export default function EngineLock({ target, ghosted }) {
  const { snap, conductor } = useScene()
  const k = (snap && snap.kpi) || {}
  const up = upEngines(snap)
  const decode = decodeOf(snap)
  const pf = prefillOf(snap)
  const live = !ghosted && snap && snap.mode !== 'offline' && snap.mode !== 'boot' && decode > 0

  // load overlay: the lattice figures for the locked engine
  const load = target && target.queue != null ? `${target.queue}/16` : '—'
  const overlay = ghosted
    ? ['LOAD —', 'TOK/S —', 'QUEUE —']
    : [
        `LOAD ${load} Q`,
        `TOK/S ${decode > 0 ? Math.round(decode) : '—'}`,
        `QUEUE ${target && target.queue != null ? target.queue : '—'}`,
      ]

  return (
    <div className={`flex min-h-[300px] flex-[38] flex-col gap-1 md:min-h-0 ${ghosted ? 'ic-ghost' : ''}`}>
      <div className="flex h-[18px] shrink-0 items-center gap-2.5 border border-acc/25 bg-pan/45 px-1.5 text-[8.5px] uppercase tracking-[0.1em]">
        <span className="text-[11px] font-semibold leading-none text-dat">ENG</span>
        <span className={`tracking-[0.14em] ${ghosted ? 'text-ink-3' : 'text-acc'}`}>
          {ghosted ? 'NO FIX' : live ? 'TARGET FIX' : 'DESK OPEN'}
        </span>
        <span className="flex-1" />
        <span className="text-[7.5px] tracking-[0.1em] text-ink-3">
          {target ? String(target.origin || target.key || '—').toUpperCase() : 'NO SRC'}
        </span>
      </div>

      <Frame
        title="ENGINE LOCK"
        tag={ghosted ? 'NO LOCK' : 'LOCKED'}
        ghosted={ghosted}
        className="flex-1"
        bodyClass="overflow-hidden"
      >
        {/* canvas layer: load lattice, sweep, lock brackets (paints even
            while ghosted, so reduced motion / offline keeps a frame) */}
        <SceneCanvas draw={paintEngines} label={ghosted ? 'Engine lock lattice, no lock' : 'Engine lock lattice, engine locked'} className="absolute inset-0 h-full w-full" />

        {/* dashed leader from the lock to the lock card */}
        {!ghosted && (
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
            <line
              x1="50%"
              y1="55%"
              x2="57%"
              y2="62%"
              stroke="rgb(var(--acc) / 0.75)"
              strokeWidth="1"
              strokeDasharray="2 2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}

        {/* load overlay */}
        <div className="pointer-events-none absolute right-1.5 top-1.5 text-right text-[7.5px] leading-[1.45] tracking-[0.1em] text-dat [text-shadow:0_0_4px_rgb(0_0_0_/_0.85)]">
          {overlay.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>

        {/* lock badge */}
        <div
          className={`pointer-events-none absolute left-1.5 top-1 px-1.5 py-0.5 text-[7.5px] font-bold tracking-[0.16em] ${
            ghosted ? 'bg-acc/25 text-ink-2' : 'bg-dat text-bgg'
          }`}
        >
          {ghosted ? 'NO LOCK' : live ? 'LOCKED' : 'STANDBY'}
        </div>

        {/* lock card: the serving engine, keyed off the real target */}
        {!ghosted && target ? (
          <div
            className="pointer-events-none absolute border border-acc/25 bg-acc px-2 py-1 text-[8px] leading-[1.35] uppercase tracking-[0.08em] text-bgg shadow-[0_0_12px_rgb(var(--acc)_/_0.45)]"
            style={{ left: 'calc(50% + 30px)', top: 'calc(55% + 24px)' }}
          >
            <span className="block font-bold">TARGET LOCK = {hexFrom(target.key || target.label || 'eng', 2)}</span>
            <span className="block text-[7.5px] opacity-80">
              {String(modelOf(snap) || 'NO MODEL').toUpperCase()} · {decode > 0 ? `${Math.round(decode)} TOK/S` : 'IDLE'}
            </span>
          </div>
        ) : null}

        {/* bottom strip */}
        <div className="pointer-events-none absolute bottom-1 left-1.5 right-1.5 flex justify-between text-[7.5px] tracking-[0.1em] text-ink-3">
          <span>ENG {up.length}/{((snap && snap.engines) || []).length}</span>
          <span className="text-dat/80">{k.tps != null ? `${Math.round(k.tps)} TOK/S DESK` : 'DESK —'}</span>
        </div>

        {/* engine dossier for the locked engine */}
        {!ghosted && target ? (
          <div className="pointer-events-none absolute bottom-4 right-2 w-[168px] border border-acc/25 bg-bgg/90 px-2 py-1.5">
            <div className="flex items-center justify-between border-b border-acc/25 pb-0.5 text-[7.5px] uppercase tracking-[0.16em]">
              <span className="text-acc">ENGINE DOSSIER</span>
              <span className="text-dat">{hexFrom(target.key || 'eng', 3)}</span>
            </div>
            {[
              ['KEY', String(target.key || '—').toUpperCase()],
              ['MODEL', String(modelOf(snap) || '—').toUpperCase()],
              ['HOST UP', snap && snap.host && snap.host.uptime != null ? `${Math.floor(snap.host.uptime / 3600)}H` : '—'],
              ['DECODE', decode > 0 ? `${Math.round(decode)} TOK/S` : '—'],
              ['PREFILL', pf.v != null ? `${Math.round(pf.v)}${pf.derived ? '*' : ''} TOK/S` : '—'],
              ['SESS', target && target.sessions ? target.sessions.length : '—'],
            ].map(([k2, v]) => (
              <div key={k2} className="flex justify-between gap-1.5 text-[7px] uppercase leading-[1.35] tracking-[0.06em]">
                <span className="text-ink-3">{k2}</span>
                <span className="truncate text-ink-2">{v}</span>
              </div>
            ))}
            <div className="mt-0.5 border-t border-acc/25 pt-0.5 text-[6.5px] uppercase leading-[1.3] tracking-[0.1em] text-ink-3">
              {pf.derived ? '* PREFILL DERIVED FROM ARRIVALS' : 'PREFILL FROM ENGINE'}
            </div>
          </div>
        ) : null}
      </Frame>
    </div>
  )
}

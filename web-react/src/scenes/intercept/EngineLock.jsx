// SatPanel: the satellite signal-tracking module. The procedural satellite
// field + scan sweep + target reticle paint on the shared clock via
// paintSat (canvas). The target is the one engine currently serving
// (first up engine); with none up the module ghosts: frames stay, the
// badge reads NO LOCK, dossier and target card drop out. Coords are
// decorative but drift stably with the conductor scalars (heat/flow/alert).
// The SUBJECT FILE dossier is narrative lore (flagged in the scene report).

import SceneCanvas from '../../scene/Canvas'
import { useScene } from '../../scene/SceneRoot'
import { paintSat } from './painters'
import { Frame, hexFrom } from './frame.jsx'

const DOSSIER = [
  ['SEX / AGE', 'F · 26'],
  ['OCC', 'GRAD STUDENT'],
  ['AFFIL', 'ETH ZÜRICH'],
  ['RES', 'CH-1205 GENEVE'],
]

export default function SatPanel({ target, ghosted }) {
  const { snap, conductor } = useScene()
  const k = (snap && snap.kpi) || {}
  const heat = Math.min(1, conductor.heat)
  const flow = Math.min(1, conductor.flow)
  const alert = Math.min(1, conductor.alert)

  const coords = ghosted
    ? ['LAT —', 'LON —', 'ALT —', 'ZOOM x4.50']
    : [
        `LAT ${(40.7158 + heat * 0.42).toFixed(4)} N`,
        `LON ${(74.0091 - flow * 0.63).toFixed(4)} W`,
        `ALT ${(212.4 + alert * 240).toFixed(1)} M`,
        'ZOOM x4.50',
      ]

  return (
    <div className={`flex min-h-[300px] flex-[38] flex-col gap-1 md:min-h-0 ${ghosted ? 'ic-ghost' : ''}`}>
      <div className="flex h-[18px] shrink-0 items-center gap-2.5 border border-acc/25 bg-pan/45 px-1.5 text-[8.5px] uppercase tracking-[0.1em]">
        <span className="text-[11px] font-semibold leading-none text-dat">GPS</span>
        <span className={`tracking-[0.14em] ${ghosted ? 'text-ink-3' : 'text-acc'}`}>
          {ghosted ? 'NO FIX' : 'SIGNAL LOCATED'}
        </span>
        <span className="flex-1" />
        <span className="text-[7.5px] tracking-[0.1em] text-ink-3">
          {target ? String(target.origin || target.key || '—').toUpperCase() : 'MOC-4'}
        </span>
      </div>

      <Frame
        title="SIGNAL TRACKING"
        tag={ghosted ? 'NO LOCK' : 'LOCKED'}
        ghosted={ghosted}
        className="flex-1"
        bodyClass="overflow-hidden"
      >
        {/* canvas layer: satellite field, sweep, reticle (paints even while
            ghosted, so reduced motion / offline keeps a valid frame) */}
        <SceneCanvas draw={paintSat} label={ghosted ? 'Satellite field, no target lock' : 'Satellite field, target locked'} className="absolute inset-0 h-full w-full" />

        {/* dashed leader from reticle to the target card */}
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

        {/* coords overlay */}
        <div className="pointer-events-none absolute left-1.5 top-1.5 text-[7.5px] leading-[1.45] tracking-[0.1em] text-dat [text-shadow:0_0_4px_rgb(0_0_0_/_0.85)]">
          {coords.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>

        {/* lock badge */}
        <div
          className={`pointer-events-none absolute right-1.5 top-1 px-1.5 py-0.5 text-[7.5px] font-bold tracking-[0.16em] ${
            ghosted ? 'bg-acc/25 text-ink-2' : 'bg-dat text-bgg'
          }`}
        >
          {ghosted ? 'NO LOCK' : 'LOCKED'}
        </div>

        {/* target card: the serving engine, keyed off the real target */}
        {!ghosted && target ? (
          <div
            className="pointer-events-none absolute border border-acc/25 bg-acc px-2 py-1 text-[8px] leading-[1.35] uppercase tracking-[0.08em] text-bgg shadow-[0_0_12px_rgb(var(--acc)_/_0.45)]"
            style={{ left: 'calc(50% + 30px)', top: 'calc(55% + 24px)' }}
          >
            <span className="block font-bold">TARGET ID = {hexFrom(target.key || target.label || 'tgt', 2)}</span>
            <span className="block text-[7.5px] opacity-80">
              {String(target.label || target.key || 'signal').toUpperCase().slice(0, 22)} · {String(target.origin || '').toUpperCase()}
            </span>
          </div>
        ) : null}

        {/* bottom strip */}
        <div className="pointer-events-none absolute bottom-1 left-1.5 right-1.5 flex justify-between text-[7.5px] tracking-[0.1em] text-ink-3">
          <span>SAT-06</span>
          <span className="text-dat/80">{target ? `SYS-${(target.key || '').toUpperCase().slice(0, 2)}Q` : 'SYS-04-Q'}</span>
        </div>

        {/* SUBJECT FILE dossier: narrative lore, decorative (report) */}
        {!ghosted && (
          <div className="pointer-events-none absolute bottom-4 right-2 w-[168px] border border-acc/25 bg-bgg/90 px-2 py-1.5">
            <div className="flex items-center justify-between border-b border-acc/25 pb-0.5 text-[7.5px] uppercase tracking-[0.16em]">
              <span className="text-acc">SUBJECT FILE</span>
              <span className="text-dat">047</span>
            </div>
            {DOSSIER.map(([k2, v]) => (
              <div key={k2} className="flex justify-between gap-1.5 text-[7px] uppercase leading-[1.35] tracking-[0.06em]">
                <span className="text-ink-3">{k2}</span>
                <span className="truncate text-ink-2">{v}</span>
              </div>
            ))}
            <div className="mt-0.5 border-t border-acc/25 pt-0.5 text-[6.5px] uppercase leading-[1.3] tracking-[0.1em] text-alm">
              FLAGGED · ASSOCIATE OF SUBJECT 022
            </div>
          </div>
        )}
      </Frame>
    </div>
  )
}

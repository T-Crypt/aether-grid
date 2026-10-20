// OpsRail: the far-left vertical operations rail. The SESSIONS column
// prints the first sessions' ids and KV fill; the TOK/S ladder prints one
// row per engine with its decode rate; STATE counts the KV well states
// and the live alerts. The operator deck (CPU / RAM meters, power knob)
// binds to host telemetry. Deck meters ease between feed ticks with CSS
// transitions, so there is no rail timer.

import { useScene } from '../../scene/SceneRoot'
import { sessionFill, upEngines, wellCounts } from './shared'

function Meter({ level, label }) {
  const lit = Math.round(Math.min(1, Math.max(0, level)) * 6)
  return (
    <div aria-label={label} className="flex items-end justify-center gap-px">
      {Array.from({ length: 6 }, (_, i) => (
        <span
          key={i}
          className={`h-[5px] w-[3px] transition-colors duration-500 ${
            i < lit ? (i === 5 ? 'bg-alm' : 'bg-dat') : 'bg-acc/25'
          }`}
        />
      ))}
    </div>
  )
}

function Knob({ level }) {
  const deg = -120 + 240 * Math.min(1, Math.max(0, level))
  return (
    <div className="flex flex-col items-center gap-0.5 border border-acc/25 bg-pan/40 px-1 py-1">
      <div
        aria-hidden="true"
        className="relative h-[18px] w-[18px] rounded-full border border-acc/25 bg-bgg/60 transition-transform duration-700"
        style={{ transform: `rotate(${deg.toFixed(0)}deg)` }}
      >
        <span className="absolute left-1/2 top-[2px] h-[7px] w-px -translate-x-1/2 bg-dat" />
      </div>
      <span className="text-[6px] uppercase tracking-[0.1em] text-ink-3">DRAW</span>
      <span className="text-[6px] tabular-nums text-dat">
        {level > 0 ? `${(level * 450).toFixed(0)}W` : '—'}
      </span>
    </div>
  )
}

export default function OpsRail() {
  const { snap } = useScene()
  const host = (snap && snap.host) || null
  const cpu = host && host.cpu != null ? host.cpu / 100 : null
  const ram =
    host && host.ramUsed != null && host.ramTotal ? host.ramUsed / host.ramTotal : host && host.ramUsed != null ? host.ramUsed / 32 : null
  const gpu = (snap && snap.gpu) || null
  const powerLvl = gpu && gpu.power != null ? gpu.power / 450 : null
  const deckGhost = cpu == null && ram == null && powerLvl == null
  const uptimeH = host && host.uptime != null ? Math.floor(host.uptime / 3600) : null

  const sessions = (((snap && snap.sessions) || []) || []).slice(0, 12)
  const engines = upEngines(snap).slice(0, 10)
  const wells = wellCounts(snap)
  const alerts = ((snap && snap.alerts) || []).length

  return (
    <aside
      aria-label="Operations rail"
      className="hidden w-11 shrink-0 select-none flex-col overflow-hidden border-r border-acc/25 bg-bgg/40 font-mono uppercase md:flex"
    >
      <div className="border-b border-acc/25 px-1 py-1.5 text-center text-[8px] font-semibold tracking-[0.16em] text-acc [writing-mode:vertical-rl]">
        OPERATIONS
      </div>

      <div className="border-b border-acc/25 px-1 pb-1.5 pt-1">
        <div className="mb-0.5 text-[7px] tracking-[0.1em] text-acc/85">SESSIONS</div>
        {sessions.map((s, i) => {
          const f = sessionFill(s)
          return (
            <div key={s.id ?? i} className="flex items-baseline justify-between px-0.5 text-[7px] leading-[1.5]">
              <span className="tabular-nums text-ink-3">{String(s.id || '—').slice(-4)}</span>
              <span className="tabular-nums text-dat/80">{f != null ? `${Math.round(f * 100)}%` : '—'}</span>
            </div>
          )
        })}
        {sessions.length === 0 && (
          <div className="px-0.5 text-[7px] leading-[1.5] text-ink-3">NO SESSIONS</div>
        )}
      </div>

      <div className="border-b border-acc/25 px-1 pb-1.5 pt-1">
        <div className="mb-0.5 text-[7px] tracking-[0.1em] text-acc/85">TOK/S</div>
        {engines.map((e) => {
          const r = e.rates && e.rates.decode_tps
          return (
            <div key={e.key} className="flex items-baseline justify-between px-0.5 text-[7px] leading-[1.5]">
              <span className="text-ink-3">{String(e.key || e.label).slice(0, 4).toUpperCase()}</span>
              <span className="tabular-nums text-dat/80">{r != null && isFinite(r) ? Math.round(r) : '—'}</span>
            </div>
          )
        })}
        {engines.length === 0 && (
          <div className="px-0.5 text-[7px] leading-[1.5] text-ink-3">NO ENGINES</div>
        )}
      </div>

      <div className="border-b border-acc/25 px-1 pb-1.5 pt-1">
        <div className="mb-0.5 text-[7px] tracking-[0.1em] text-acc/85">STATE</div>
        {[
          ['HOT', wells.hot, wells.hot > 0],
          ['WATCH', wells.watch, wells.watch > 0],
          ['OK', wells.ok, false],
          ['ALRT', alerts, alerts > 0],
        ].map(([k, v, warn]) => (
          <div key={k} className="flex items-baseline justify-between px-0.5 text-[7px] leading-[1.5]">
            <span className="text-ink-3">{k}</span>
            <span className={`tabular-nums ${warn ? 'text-alm' : 'text-dat/80'}`}>{String(v)}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 border-b border-acc/25 px-1 pb-1.5 pt-1">
        <div className="mb-1 text-center text-[7px] tracking-[0.1em] text-acc/85">DECK</div>
        {deckGhost ? (
          <div className="px-1 py-2 text-center text-[6px] tracking-[0.12em] text-ink-3">NO SOURCE</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-col items-center gap-0.5">
              <Meter level={cpu ?? 0} label="host cpu" />
              <span className="text-[6px] tabular-nums text-ink-3">
                CPU {cpu != null ? `${Math.round(cpu * 100)}%` : '—'}
              </span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Meter level={ram ?? 0} label="host ram" />
              <span className="text-[6px] tabular-nums text-ink-3">
                RAM {ram != null ? `${Math.round(ram * 100)}%` : '—'}
              </span>
            </div>
            <Knob level={powerLvl ?? 0} />
            <div className="flex justify-between px-0.5 text-[6px] leading-[1.5] tabular-nums">
              <span className="text-ink-3">UP</span>
              <span className="text-dat/80">{uptimeH != null ? `${uptimeH}H` : '—'}</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

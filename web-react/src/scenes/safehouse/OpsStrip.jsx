// OpsStrip: the far-left vertical operations strip. The operator deck
// (CPU / RAM meters, GAIN knob) binds to host telemetry; the input list,
// trace-frequency ladder and latch rows are decorative deck lore (flagged in
// the scene report). The deck meters ease between feed ticks with CSS
// transitions, so there is no scene timer.

import { useScene } from '../../scene/SceneRoot'

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
      <span className="text-[6px] uppercase tracking-[0.1em] text-ink-3">GAIN</span>
      <span className="text-[6px] tabular-nums text-dat">
        {level > 0 ? `${(level * 30).toFixed(1)}` : '—'}
      </span>
    </div>
  )
}

const INPUTS = ['870', '75D', 'B9D', '18D', '658', 'D13', '6F9', '4EA', 'AEC', '7E7', 'BDD', 'E69']
const TRACE = ['18.408', '85.408', '102.948', '578.077', '1290.762', '2104.5', '3072.1', '4480.8', '6622.0', '8810.4']
const LATCH = [
  { k: 'L1', v: 'OK' },
  { k: 'L2', v: 'OK' },
  { k: 'L3', v: 'HOLD' },
  { k: 'L4', v: 'OK' },
  { k: 'L5', v: 'WAIT' },
]

export default function OpsStrip() {
  const { snap } = useScene()
  const host = (snap && snap.host) || null
  const cpu = host && host.cpu != null ? host.cpu / 100 : null
  const ram =
    host && host.ramUsed != null && host.ramTotal ? host.ramUsed / host.ramTotal : host && host.ramUsed != null ? host.ramUsed / 32 : null
  const gpu = (snap && snap.gpu) || null
  const powerLvl = gpu && gpu.power != null ? gpu.power / 450 : null
  const deckGhost = cpu == null && ram == null && powerLvl == null
  const uptimeH = host && host.uptime != null ? Math.floor(host.uptime / 3600) : null

  return (
    <aside
      aria-label="Operations strip"
      className="hidden w-11 shrink-0 select-none flex-col overflow-hidden border-r border-acc/25 bg-bgg/40 font-mono uppercase md:flex"
    >
      <div className="border-b border-acc/25 px-1 py-1.5 text-center text-[8px] font-semibold tracking-[0.16em] text-acc [writing-mode:vertical-rl]">
        OPERATIONS
      </div>

      <div className="border-b border-acc/25 px-1 pb-1.5 pt-1">
        <div className="mb-0.5 text-[7px] tracking-[0.1em] text-acc/85">INPUTS</div>
        {INPUTS.map((v, i) => (
          <div key={i} className="flex items-baseline justify-between px-0.5 text-[7px] leading-[1.5]">
            <span className="text-ink-3">IN {String(i + 1).padStart(2, '0')}</span>
            <span className="tabular-nums text-ink-2/80">{v}</span>
          </div>
        ))}
      </div>

      <div className="border-b border-acc/25 px-1 pb-1.5 pt-1">
        <div className="mb-0.5 text-[7px] tracking-[0.1em] text-acc/85">TRACE FREQ</div>
        {TRACE.map((v) => (
          <div key={v} className="px-0.5 text-[7.5px] leading-[1.45] tabular-nums text-dat/80">
            {v}
          </div>
        ))}
      </div>

      <div className="border-b border-acc/25 px-1 pb-1.5 pt-1">
        <div className="mb-0.5 text-[7px] tracking-[0.1em] text-acc/85">LATCH</div>
        {LATCH.map((r) => (
          <div key={r.k} className="flex items-baseline justify-between px-0.5 text-[7px] leading-[1.5]">
            <span className="text-ink-3">{r.k}</span>
            <span className="tabular-nums text-dat/80">{r.v}</span>
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

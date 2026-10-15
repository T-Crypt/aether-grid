import { Gauge as GaugeIcon } from 'lucide-react'
import Panel from './Panel'
import { clamp01, tempState } from '../lib/format'

const START = -120
const END = 120

function polar(cx, cy, r, deg) {
  const a = ((deg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

function arcPath(cx, cy, r, start, end) {
  const [x1, y1] = polar(cx, cy, r, start)
  const [x2, y2] = polar(cx, cy, r, end)
  const large = end - start > 180 ? 1 : 0
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

/** One 240° radial gauge. */
function Gauge({ label, value, pct, color }) {
  const end = START + (END - START) * clamp01(pct)
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 100 100" className="h-[86px] w-[86px]" role="img" aria-label={`${label} ${value}`}>
        <path d={arcPath(50, 50, 37, START, END)} stroke="rgb(var(--acc) / 0.12)" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d={arcPath(50, 50, 37, START, end)} stroke={color} strokeWidth="6" fill="none" strokeLinecap="round" />
        <text x="50" y="52" textAnchor="middle" className="fill-ink-1 text-[19px] font-bold tabular-nums">
          {value}
        </text>
        <text x="50" y="67" textAnchor="middle" className="fill-ink-3 text-[8px] tracking-[0.2em]">
          {label}
        </text>
      </svg>
    </div>
  )
}

/** Temp / PSI: four radial gauges for the GPU block. */
export default function GaugePanel({ snap, stagger }) {
  const gpu = snap.gpu || {}
  const util = gpu.util
  const temp = gpu.temp
  const vram = gpu.vram
  const vramTotal = gpu.vramTotal || 24
  const power = gpu.power
  const ts = tempState(temp)

  const gauges = [
    { label: 'UTIL', value: util != null ? `${Math.round(util)}%` : '—', pct: (util ?? 0) / 100, color: 'rgb(var(--acc))' },
    {
      label: 'TEMP',
      value: temp != null ? `${Math.round(temp)}C` : '—',
      pct: (temp ?? 0) / 100,
      color: ts === 'alert' ? 'rgb(var(--col))' : ts === 'warn' ? 'rgb(var(--dat))' : 'rgb(var(--acc))',
    },
    { label: 'VRAM', value: vram != null ? `${vram.toFixed(0)}G` : '—', pct: (vram ?? 0) / vramTotal, color: 'rgb(var(--col))' },
    { label: 'PWR', value: power != null ? `${Math.round(power)}W` : '—', pct: (power ?? 0) / 450, color: 'rgb(var(--dat))' },
  ]

  return (
    <Panel
      title="TEMP / PSI"
      eyebrow="gpu block"
      icon={GaugeIcon}
      accent="dat"
      right={gpu.name || '—'}
      stagger={stagger}
    >
      <div className="grid flex-1 grid-cols-2 place-items-center gap-1">
        {gauges.map((g) => (
          <Gauge key={g.label} {...g} />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-2xs text-ink-3">
        <span>
          GPU <span className="text-col">{util != null ? `${Math.round(util)}%` : '—'}</span>
        </span>
        <span className="tabular-nums">
          TMP{' '}
          <span className={ts === 'alert' ? 'text-col' : ts === 'warn' ? 'text-dat' : 'text-acc'}>
            {temp != null ? `${Math.round(temp)}C` : '—'}
          </span>
          {snap.mode === 'demo' ? ' SIM' : ''}
        </span>
      </div>
    </Panel>
  )
}

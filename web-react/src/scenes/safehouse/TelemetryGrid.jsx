// TelemetryGrid: the TARGET TELEMETRY 8-kv grid. Per the P0 card the
// tracking lore (lat/lon/alt/hdg/spd/azm/elv) is atmosphere, derived
// stably from the conductor scalars so the block moves with the scene
// without inventing sensor data. SIG is the one soft binding the card
// flags: signal strength ≈ load (heat). Ghosts when no engine is serving.

import { useScene } from '../../scene/SceneRoot'
import { Frame, hexFrom } from './frame.jsx'

export default function TelemetryGrid({ target, ghosted }) {
  const { snap, conductor, tick } = useScene()
  const heat = Math.min(1, conductor.heat)
  const flow = Math.min(1, conductor.flow)
  const alert = Math.min(1, conductor.alert)

  const rows = [
    ['LAT', ghosted ? '—' : `${(40.17 + heat * 1.2).toFixed(4)}N`],
    ['LON', ghosted ? '—' : `${(73.72 + flow * 1.4).toFixed(4)}W`],
    ['ALT', ghosted ? '—' : `${(7060 + alert * 800).toFixed(1)}M`],
    ['HDG', ghosted ? '—' : `${(218 + (tick % 7)) % 360}°`],
    ['SPD', ghosted ? '—' : `${(34.8 + flow * 20).toFixed(1)}`],
    ['SIG', ghosted ? '—' : `-${(60 + heat * 30).toFixed(1)}DB`],
    ['AZM', ghosted ? '—' : `${(142.7 + alert * 30).toFixed(1)}°`],
    ['ELV', ghosted ? '—' : `+${(18.2 + flow * 10).toFixed(1)}°`],
  ]

  return (
    <Frame
      title="TARGET TELEMETRY"
      tag={ghosted ? 'NO TGT' : `TGT-${hexFrom(target ? target.key || target.label : 'tgt', 2)}`}
      ghosted={ghosted}
      empty={ghosted}
      note="no target"
      className="flex-[10] min-h-0"
    >
      <div className="grid h-full grid-cols-2 content-start gap-x-3 gap-y-px overflow-hidden px-1.5 pt-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between text-[7px] leading-[1.5] tracking-[0.06em]">
            <span className="text-ink-3">{k}</span>
            <span className="tabular-nums text-dat">{v}</span>
          </div>
        ))}
      </div>
    </Frame>
  )
}

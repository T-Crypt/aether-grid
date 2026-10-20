// EngineTelemetry: the ENGINE TELEMETRY 8-kv grid. Every figure is a
// snapshot key or a direct derivation: engines up, session count, context
// tokens in use, decode rate, queue, and the KV well counts (hot = fill
// past 0.85, watch = past 0.6). Ghosts when no engine is serving.

import { useScene } from '../../scene/SceneRoot'
import { Frame, hexFrom } from './frame.jsx'
import { ctxUsed, decodeOf, modelOf, upEngines, wellCounts } from './shared'

export default function EngineTelemetry({ target, ghosted }) {
  const { snap } = useScene()
  const k = (snap && snap.kpi) || {}
  const up = upEngines(snap)
  const total = (((snap && snap.engines) || []) || []).length
  const sessions = (((snap && snap.sessions) || []) || []).length
  const wells = wellCounts(snap)
  const decode = decodeOf(snap)
  const model = modelOf(snap)

  const rows = [
    ['ENG UP', ghosted ? '—' : `${up.length}/${total}`],
    ['SESS', ghosted ? '—' : sessions ? String(sessions) : '0'],
    ['CTX TOK', ghosted ? '—' : ctxUsed(snap).toLocaleString('en-US')],
    ['TOK/S', ghosted ? '—' : decode > 0 ? String(Math.round(decode)) : '—'],
    ['QUEUE', ghosted ? '—' : k.queue != null ? String(Math.round(k.queue)) : '—'],
    ['HOT', ghosted ? '—' : String(wells.hot)],
    ['WATCH', ghosted ? '—' : String(wells.watch)],
    ['MODEL', ghosted || !target ? '—' : String(model || '—').toUpperCase().slice(0, 12)],
  ]

  return (
    <Frame
      title="ENGINE TELEMETRY"
      tag={ghosted ? 'NO ENG' : `ENG-${hexFrom(target ? target.key || target.label : 'eng', 2)}`}
      ghosted={ghosted}
      empty={ghosted}
      note="no engine"
      className="flex-[10] min-h-0"
    >
      <div className="grid h-full grid-cols-2 content-start gap-x-3 gap-y-px overflow-hidden px-1.5 pt-1">
        {rows.map(([key, v]) => (
          <div key={key} className="flex items-baseline justify-between text-[7px] leading-[1.5] tracking-[0.06em]">
            <span className="text-ink-3">{key}</span>
            <span className="tabular-nums text-dat">{v}</span>
          </div>
        ))}
      </div>
    </Frame>
  )
}

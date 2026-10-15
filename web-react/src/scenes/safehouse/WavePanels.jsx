// WavePanels: the two oscilloscope waveforms of the right pane. Wave A
// (SOURCE A) tracks the `reason` scalar — Strata thinking rate — as a
// mirrored voice envelope in the data colour; wave B (SOURCE B) tracks
// `flow` (token rate) as packetized stems in the accent. The dB / Hz
// rulers are static DOM like the reference. Cell A surfaces the newest
// event as a transcript quote (flagged: narrative surface over real
// events). The readouts scale the driver scalars — atmosphere, not
// instrument readings (report).

import SceneCanvas from '../../scene/Canvas'
import { useScene } from '../../scene/SceneRoot'
import { paintWave } from './painters'

const DB_SCALE = ['+6', '0', '-6', '-12', '-24']
const HZ_SCALE = ['100', '1K', '2K', '5K', '10K Hz']

function Cell({ kind, tag, transcript, ghosted }) {
  const { conductor, snap } = useScene()
  const scalar = kind === 'a' ? Math.min(1, conductor.reason) : Math.min(1, conductor.flow)
  const readout = (scalar * 880).toFixed(1)
  return (
    <div
      className={`relative min-h-0 min-w-0 flex-1 overflow-hidden border border-acc/25 bg-bgg/85 transition-opacity duration-500 ${
        ghosted ? 'sh-ghost' : ''
      }`}
    >
      <SceneCanvas
        draw={paintWave(kind)}
        label={`${tag} waveform`}
        className="absolute inset-0 h-full w-full"
      />
      <span className="pointer-events-none absolute left-1.5 top-1 text-[7.5px] tracking-[0.16em] text-acc">{tag}</span>
      <span className="pointer-events-none absolute right-1.5 top-1 text-[7.5px] tabular-nums tracking-[0.1em] text-dat">{readout}</span>
      <div className="pointer-events-none absolute bottom-[12px] left-[2px] top-[16px] z-10 flex flex-col justify-between text-[5.5px] tracking-[0.04em] text-ink-3">
        {DB_SCALE.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="pointer-events-none absolute bottom-[1px] left-[38px] right-2 z-10 flex justify-between text-[5.5px] tracking-[0.04em] text-ink-3">
        {HZ_SCALE.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      {transcript ? (
        <div className="pointer-events-none absolute bottom-[12px] left-1.5 z-10 max-w-[calc(100%-12px)] truncate text-[8px] uppercase tracking-[0.14em] [text-shadow:0_0_4px_rgb(0_0_0_/_0.85)]">
          <span className="tracking-[0.16em] text-acc">TRANSCRIPT</span>
          <span className="ml-1.5 tracking-[0.1em] tabular-nums text-ink-3">{transcript.time}</span>
          <span className="ml-1.5 font-semibold tracking-[0.18em] text-dat">“{transcript.quote}”</span>
        </div>
      ) : null}
    </div>
  )
}

export default function WavePanels({ ghosted }) {
  const { snap } = useScene()
  const events = (snap && snap.events) || []
  const last = events[0] || null
  let transcript = null
  if (last && last.msg) {
    const d = new Date(last.t * 1000)
    transcript = {
      time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      quote: String(last.msg).slice(0, 34),
    }
  }
  return (
    <div className="flex min-h-[200px] min-w-0 flex-[178] flex-col gap-1 md:min-h-0" aria-label="Audio waveforms">
      <Cell kind="a" tag="SOURCE A · AUDIO ENHANCE RATE" transcript={transcript} ghosted={ghosted} />
      <Cell kind="b" tag="SOURCE B · FILTERING SEQUENCE LAYER" ghosted={ghosted} />
    </div>
  )
}

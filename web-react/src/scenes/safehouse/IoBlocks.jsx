// IoBlocks: the bottom I/O row of the left pane — INPUT SIGNAL block
// (input = request queue depth), REQUEST DATA block (output = serving
// stats, bit.rate = rpm) and the five mode buttons (decorative states).
// PORT/NODE key off the serving engine; CHAN/PHASE/GAIN/STREAM/STATUS are
// deck lore, with STATUS mirroring live alert pressure.

import { useScene } from '../../scene/SceneRoot'
import { Frame } from './frame.jsx'

function IoBlock({ title, rows, ghosted = false, note }) {
  return (
    <Frame title={title} empty={ghosted} note={note} className="min-h-0 flex-1" bodyClass="px-1.5 pt-0.5 overflow-hidden">
      <div className="flex h-full flex-col justify-start">
        {rows.map(([k, v, tone]) => (
          <div key={k} className="flex items-baseline justify-between text-[7.5px] leading-[1.45]">
            <span className="text-ink-3">{k}</span>
            <span className={`tabular-nums ${tone || 'text-ink-2'}`}>{v}</span>
          </div>
        ))}
      </div>
    </Frame>
  )
}

const BTN =
  'flex min-h-0 flex-1 items-center justify-center border border-acc/25 bg-pan/40 px-1 text-[7.5px] tracking-[0.16em] uppercase transition-colors duration-300'

export default function IoBlocks({ target, ghosted }) {
  const { snap } = useScene()
  const k = (snap && snap.kpi) || {}
  const alerts = (snap && snap.alerts) || []
  const feed = snap ? snap.mode || 'live' : '—'

  const queue = k.queue != null ? String(Math.round(k.queue)) : '—'
  const tps = k.tps != null ? String(Math.round(k.tps)) : '—'
  const rpm = k.rpm != null ? `${Math.round(k.rpm)}K` : '—'

  const inRows = [
    ['PORT', target && target.backend ? String(target.backend).replace(/^https?:\/\//, '').split('/')[0] || '—' : '—'],
    ['CHAN', '06 / 24'],
    ['BUF', queue],
    ['PHASE', '+04.20'],
    ['GAIN', '+12.40'],
    ['STREAM', feed.toUpperCase()],
    ['STATUS', alerts.length ? `ALRT ${alerts.length}` : 'OK', alerts.length ? 'text-dat' : ''],
  ]
  const outRows = [
    ['TARGET', target ? String(target.label || target.key).slice(0, 10).toUpperCase() : '—'],
    ['NODE', target ? String(target.origin || '—').toUpperCase() : '—'],
    ['BUF', k.vram != null ? k.vram.toFixed(1) : '—'],
    ['TRX', tps],
    ['BIT.RATE', rpm, 'text-dat'],
    ['CRC', 'OK'],
    ['SPLIT', feed === 'demo' ? 'SIM' : 'FULL'],
  ]

  const buttons = [
    { l: 'INPUT', a: false },
    { l: 'OUTPUT', a: true },
    { l: 'MODES', a: false },
    { l: 'ARRAY 1', a: false },
    { l: 'ARRAY 2', a: false },
  ]

  return (
    <div className="grid min-h-[120px] flex-[18] grid-cols-2 gap-1.5 md:min-h-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_64px]">
      <IoBlock title="INPUT SIGNAL" rows={inRows} ghosted={ghosted} note="no source" />
      <IoBlock title="REQUEST DATA" rows={outRows} ghosted={ghosted} note="no source" />
      <div className="col-span-2 flex flex-wrap gap-1 md:col-span-1 md:flex-col">
        {buttons.map((b) => (
          <div key={b.l} className={BTN} aria-hidden="true">
            <span className={b.a ? 'text-dat' : 'text-acc'}>{b.l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

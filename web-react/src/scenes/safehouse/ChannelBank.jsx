// ChannelBank: two banks of eight channel buttons (A 01-08, B 21-28).
// Each button is one engine/instance state: active (data fill) when the
// engine is up, dim when down or absent — 16 channels = engines/instances
// per the P0 card. The bank numbers follow the reference.

import { pad } from './frame.jsx'

function Bank({ label, base, engines, ghosted }) {
  const btn = (n, up) => {
    const active = up === true
    return (
      <span
        key={n}
        className={`flex h-[15px] items-center justify-center border text-[7px] tabular-nums transition-colors duration-300 ${
          active
            ? 'border-dat bg-dat text-bgg'
            : 'border-acc/25 bg-pan/40 text-ink-3'
        }`}
        aria-label={`channel ${n} ${active ? 'active' : 'idle'}`}
      >
        {pad(base + n)}
      </span>
    )
  }
  const slots = Array.from({ length: 8 }, (_, i) => engines[i] || null)
  return (
    <div className="min-w-0">
      <div className="px-0.5 pb-0.5 text-[7px] tracking-[0.18em] text-acc">{label}</div>
      <div className={`grid grid-cols-8 gap-0.5 ${ghosted ? 'sh-ghost' : ''}`}>
        {slots.map((e, i) => btn(i + 1, e ? e.up : false))}
      </div>
    </div>
  )
}

export default function ChannelBank({ engines, ghosted }) {
  return (
    <div
      aria-label="Active channel banks"
      className="grid min-h-0 grid-cols-2 gap-1.5 pt-1"
    >
      <Bank label="ACTIVE CHANNEL · BANK A" base={0} engines={(engines || []).slice(0, 8)} ghosted={ghosted} />
      <Bank label="ACTIVE CHANNEL · BANK B" base={20} engines={(engines || []).slice(8, 16)} ghosted={ghosted} />
    </div>
  )
}

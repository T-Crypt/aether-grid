// SlotBank: two banks of engine slots (A and B). Each button is one
// engine's slot state: filled (data tint) when the engine is up, dim when
// down or absent. The button prints the engine key, so the bank reads as
// the engine registry rather than a numbered mystery. The banks ghost
// when the feed has no engines.

import { useScene } from '../../scene/SceneRoot'

function Bank({ label, engines, ghosted }) {
  const btn = (e) => {
    const active = e ? e.up === true : false
    return (
      <span
        key={e ? e.key : 'empty'}
        className={`flex h-[15px] items-center justify-center border text-[6.5px] uppercase transition-colors duration-300 ${
          active
            ? 'border-dat bg-dat text-bgg'
            : 'border-acc/25 bg-pan/40 text-ink-3'
        }`}
        aria-label={`slot ${e ? e.key : 'empty'} ${active ? 'up' : 'down'}`}
      >
        {e ? String(e.key || e.label || '—').slice(0, 6).toUpperCase() : '·'}
      </span>
    )
  }
  const slots = Array.from({ length: 8 }, (_, i) => engines[i] || null)
  return (
    <div className="min-w-0">
      <div className="px-0.5 pb-0.5 text-[7px] tracking-[0.18em] text-acc">{label}</div>
      <div className={`grid grid-cols-8 gap-0.5 ${ghosted ? 'ic-ghost' : ''}`}>
        {slots.map((e) => btn(e))}
      </div>
    </div>
  )
}

export default function SlotBank({ engines, ghosted }) {
  return (
    <div
      aria-label="Engine slot banks"
      className="grid min-h-0 grid-cols-2 gap-1.5 pt-1"
    >
      <Bank label="ENGINE SLOT · BANK A" engines={(engines || []).slice(0, 8)} ghosted={ghosted} />
      <Bank label="ENGINE SLOT · BANK B" engines={(engines || []).slice(8, 16)} ghosted={ghosted} />
    </div>
  )
}

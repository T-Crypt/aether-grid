import { motion } from 'framer-motion'
import { Pause, Play, StepForward, Radio } from 'lucide-react'
import { SKINS } from '../lib/skins'
import { Pill, derivePills } from './Status'

function Sigil({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <path d="M4 25H28" stroke="rgb(var(--text-3))" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 10.5A13.5 13.5 0 0 1 26 10.5" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M9.5 14.5A9 9 0 0 1 22.5 14.5" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="19" r="3" fill={color} />
    </svg>
  )
}

const BTN =
  'inline-flex items-center gap-1.5 rounded border border-acc/25 bg-acc/[0.08] px-2 py-1.5 text-2xs text-ink-2 ' +
  'transition-colors hover:border-acc/50 hover:text-ink-1 focus-visible:outline focus-visible:outline-1 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-acc'

/**
 * One floating frosted bar carrying the brand, the skin navigation and the
 * live status pills — the brief's "streamline the pills and tabs into a
 * frosted-glass header". Sticky, so telemetry state never scrolls away.
 *
 * On small screens the skin rail and the pill row scroll sideways instead of
 * wrapping. Wrapping cost 241px of header on a 390px phone and pushed the
 * first panel off the fold; a scrolling rail costs one row each.
 */
export default function Header({ snap, skin, onSkin, paused, onTogglePause, onStep, tick }) {
  const pills = derivePills(snap)
  const accent = SKINS.find((s) => s.id === skin)?.accent || '#00e0e0'

  return (
    <header className="sticky top-0 z-40 mb-4 border-b border-acc/10 bg-space-950/70 backdrop-blur-xl">
      <div className="mx-auto max-w-[1760px] px-3 py-2.5 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex shrink-0 items-center gap-2.5">
            <Sigil color={accent} />
            <div className="leading-none">
              <div className="text-[13px] font-bold tracking-[0.22em] text-ink-1">AETHER GRID</div>
              <div className="micro mt-1">field console</div>
            </div>
          </div>

          <div className="order-3 flex w-full min-w-0 items-center gap-1.5 md:order-none md:w-auto md:flex-1">
            <span className="micro hidden shrink-0 lg:inline">skin</span>
            <nav
              aria-label="Interface skin"
              className="no-bar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex-wrap md:overflow-visible"
            >
              {SKINS.map((s) => {
                const isActive = s.id === skin
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => onSkin(s.id)}
                    className={`relative shrink-0 whitespace-nowrap rounded px-2.5 py-1.5 text-2xs transition-colors duration-200 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-acc ${
                      isActive ? 'bg-acc/[0.12] text-ink-1' : 'text-ink-3 hover:bg-acc/[0.06] hover:text-ink-1'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: s.accent }} />
                      {s.label}
                    </span>
                    {isActive ? (
                      <motion.span
                        layoutId="skin-underline"
                        className="absolute inset-x-2 -bottom-px h-px bg-acc"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    ) : null}
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <span className={`${BTN} hidden text-acc sm:inline-flex`}>
              <Radio size={11} className={paused ? '' : 'animate-pulseDot'} aria-hidden="true" />
              {paused ? 'held' : 'live'}
              <span className="tabular-nums text-ink-3">t{tick}</span>
            </span>
            <button
              type="button"
              onClick={onTogglePause}
              aria-pressed={paused}
              title={paused ? 'Resume the feed' : 'Hold the feed'}
              className={BTN}
            >
              {paused ? <Play size={11} aria-hidden="true" /> : <Pause size={11} aria-hidden="true" />}
              {paused ? 'resume' : 'hold'}
            </button>
            <button type="button" onClick={onStep} title="Advance one tick" aria-label="Advance one tick" className={BTN}>
              <StepForward size={11} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          aria-label="Status pills"
          className="no-bar -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5 sm:flex-wrap sm:overflow-visible"
        >
          {pills.map((p) => (
            <span key={p.key} className="shrink-0">
              <Pill label={p.label} value={p.value} tone={p.tone} pulse={p.pulse} />
            </span>
          ))}
        </div>
      </div>
    </header>
  )
}

import { Pause, Play, StepForward, Radio } from 'lucide-react'
import { SKINS } from '../lib/skins'
import { Pill, derivePills } from './Status'
import { useScene } from '../scene/SceneRoot'

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
  'inline-flex min-h-[24px] items-center gap-1.5 rounded-none border border-acc/25 bg-acc/[0.08] px-2 py-1 text-2xs text-ink-2 ' +
  'transition-colors hover:border-acc/50 hover:text-ink-1 focus-visible:outline focus-visible:outline-1 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-acc'

const PHASE_TONE = {
  idle: 'text-acc',
  burst: 'text-dat',
  pressure: 'text-dat',
  overflow: 'text-alm',
  recover: 'text-col',
}

export default function Header() {
  const { snap, tick, paused, setPaused, stepOnce, demo, skin, mode } = useScene()
  const pills = derivePills(snap)
  const accent = SKINS.find((s) => s.id === skin)?.accent || '#00e0e0'
  const phase = snap?.phase

  return (
    <header className="sticky top-0 z-40 border-b border-acc/10 bg-space-950/60 backdrop-blur-md">
      <div className="mx-auto max-w-[1920px] px-3 py-2 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex shrink-0 items-center gap-2.5">
            <Sigil color={accent} />
            <div className="leading-none">
              <div className="text-[13px] font-bold tracking-[0.22em] text-ink-1">AETHER GRID</div>
              <div className="micro mt-1">field console</div>
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {demo && phase ? (
              <span className={`${BTN} ${PHASE_TONE[phase] || 'text-ink-2'}`}>
                <span className="micro text-ink-3">phase</span>
                {phase}
              </span>
            ) : null}
            <span className={`${BTN} hidden text-acc sm:inline-flex`}>
              <Radio size={11} className={paused ? '' : 'animate-pulseDot'} aria-hidden="true" />
              {paused ? 'held' : mode === 'offline' ? 'lost' : 'live'}
              <span className="tabular-nums text-ink-3">t{tick}</span>
            </span>
            {demo ? (
              <>
                <button
                  type="button"
                  onClick={() => setPaused((p) => !p)}
                  aria-pressed={paused}
                  title={paused ? 'Resume the feed' : 'Hold the feed'}
                  className={BTN}
                >
                  {paused ? <Play size={11} aria-hidden="true" /> : <Pause size={11} aria-hidden="true" />}
                  {paused ? 'resume' : 'hold'}
                </button>
                <button type="button" onClick={stepOnce} title="Advance one tick" aria-label="Advance one tick" className={BTN}>
                  <StepForward size={11} aria-hidden="true" />
                </button>
              </>
            ) : null}
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

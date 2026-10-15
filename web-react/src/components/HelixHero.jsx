// SHE_10N / DEV. The hero stage. The reasoning helix is the dominant
// instrument of the scene: big enough to watch reasoning advance per token.
// Its coil phase is the token clock (conductor.helix.phase), so a decode
// burst spins it, an anomaly glitches it, and a request arrival kicks a
// bright impulse down the spine.

import { Waves } from 'lucide-react'
import Scope from '../scene/Scope'
import SceneCanvas from '../scene/Canvas'
import { paintHero } from '../scene/paint'
import { fmtBig } from '../lib/format'
import { useScene } from '../scene/SceneRoot'
import useAnchor from '../scene/useAnchor'

export default function HelixHero({ className = "" }) {
  const { snap, mode } = useScene()
  const ref = useAnchor('hero')
  const k = snap.kpi || {}
  const reasoning = snap.reasoning
  const accept = reasoning?.mtp_accept_pct
  const think = reasoning?.thinking_tokens
  const ghost = mode === 'boot' || mode === 'offline' || (k.tps == null && !reasoning)

  return (
    <Scope
      id="sc-hero"
      title="SHE_10N / DEV"
      eyebrow="helix reasoning"
      accent="col"
      right={accept != null ? `ACC ${accept.toFixed(1)}%` : 'ACC —'}
      ghosted={ghost}
      ghostNote="no reasoning source"
      className={`min-h-[260px] flex-1 lg:min-h-0 ${className}`}
    >
      <div ref={ref} className="relative min-h-[200px] flex-1">
        <SceneCanvas draw={(ctx, w, h, c) => paintHero(ctx, w, h, c)} label="Reasoning helix" />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-2xs text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <Waves size={11} className="text-col" aria-hidden="true" />
          ACC <span className="text-dat">{accept != null ? `${accept.toFixed(1)}%` : '—'}</span>
        </span>
        <span className="tabular-nums">
          THINK {think != null ? fmtBig(think) : '—'}
        </span>
        {snap.phase ? (
          <span className="micro hidden sm:inline">
            PHASE <span className={snap.phase === 'overflow' ? 'text-alm' : snap.phase === 'idle' ? 'text-acc' : 'text-dat'}>{snap.phase}</span>
          </span>
        ) : null}
        <span className="micro hidden md:inline">
          TOKENS <span className="text-col">{fmtKpiTps(k.tps)}</span>/S
        </span>
      </div>
    </Scope>
  )
}

function fmtKpiTps(v) {
  return v != null && isFinite(v) ? Math.round(v) : '—'
}

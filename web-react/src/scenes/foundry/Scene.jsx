// Token Foundry scene root: the request wall. A wall of riveted plates
// under one wire of queue lamps — four rows: the identity strip, the queue
// rail, the two hero plates (the request inspector left, the throughput
// forge right) and the bottom band of five small plates. Everything
// animates off the shared conductor clock; the scene owns no timers. Below
// 768 px the rows stack and the plates go full width; the queue rail and
// the pressure ladder drop first. The .fd-boot overlay plays a one-shot
// lock-on sweep on mount and degenerates instantly under reduced motion.

import '@fontsource/rubik'
import '@fontsource/rubik/500.css'
import '@fontsource/rubik/600.css'
import '@fontsource/rubik/700.css'
import '@fontsource/vt323'
import { useScene } from '../../scene/SceneRoot'
import { lampFracs, queueRail } from './shared'
import IdentityStrip from './IdentityStrip'
import QueueRail from './QueueRail'
import InspectorPlate from './InspectorPlate'
import ForgePlate from './ForgePlate'
import { ModelTallyPlate, EventLogPlate, GpuDrawPlate, SamplerPlate, LadderPlate } from './BottomPlates'

export default function FoundryScene() {
  const { snap, conductor } = useScene()
  const rail = queueRail(snap)
  // Wash opacity rides the eased conductor heat in coarse 0.1 steps, not
  // the per-tick lit count: a smooth binding would still breathe every
  // tick, and queue flaps would pulse the whole wall. Steps hold still.
  const heat = Math.round(Math.min(1, Math.max(0, conductor.heat)) * 10) / 10
  const fracs = lampFracs(rail.lit)
  // the screen-blended pool of lamp light on the wall, positioned from the
  // lit-lamp x fractions and eased by CSS at feed rate
  const lightBg =
    fracs.length > 0
      ? fracs.map((x) => `radial-gradient(8% 58% at ${x.toFixed(2)}% 1%, rgba(255,227,188,0.1), rgba(255,227,188,0) 100%)`).join(', ')
      : 'none'

  return (
    <div className="fd-stage relative flex min-h-dvh flex-col overflow-x-hidden pb-[var(--chrome-h)] font-mono text-ink-1 min-[769px]:h-dvh min-[769px]:min-h-0 min-[769px]:overflow-hidden">
      {/* stage atmosphere: lamp wash + vignette + static grain */}
      <div
        className="fd-light hidden min-[769px]:block"
        style={{ top: '9%', height: '58%', backgroundImage: lightBg, opacity: 0.35 + heat * 0.6 }}
        aria-hidden="true"
      />
      <div className="fd-vignette pointer-events-none absolute inset-0 z-[60] hidden min-[769px]:block" aria-hidden="true" />
      <div className="fd-grain pointer-events-none absolute inset-0 z-[70] hidden min-[769px]:block" aria-hidden="true" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col min-[769px]:grid min-[769px]:grid-rows-[auto_auto_minmax(0,62fr)_minmax(0,38fr)]">
        {/* T · identity strip */}
        <IdentityStrip />

        {/* the queue rail (drops first on phones) */}
        <QueueRail />

        {/* the middle: the inspector (hero 1) and the forge (hero 2) */}
        <section
          aria-label="Request inspector and throughput forge"
          className="flex min-h-0 flex-col gap-1.5 p-1.5 min-[769px]:grid min-[769px]:grid-cols-[minmax(0,46fr)_minmax(0,54fr)]"
        >
          <InspectorPlate />
          <ForgePlate />
        </section>

        {/* the bottom band of five small plates */}
        <section
          aria-label="Foundry ledgers"
          className="flex min-h-0 flex-col gap-1.5 p-1.5 min-[769px]:grid min-[769px]:grid-cols-[minmax(0,19fr)_minmax(0,29fr)_minmax(0,18fr)_minmax(0,15fr)_minmax(0,19fr)]"
        >
          <ModelTallyPlate />
          <EventLogPlate />
          <GpuDrawPlate />
          <SamplerPlate />
          {/* the pressure ladder drops first on phones */}
          <LadderPlate />
        </section>
      </div>

      {/* one-shot lock-on sweep on mount (finite; degenerates under
          reduced motion via the global rule) */}
      <div className="fd-boot pointer-events-none absolute inset-0 z-[80] hidden min-[769px]:block" aria-hidden="true" />
    </div>
  )
}

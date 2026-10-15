// Cyber-pass scene root: the mountain customs booth (uispace.org/cyber-pass
// recreation). A wall of riveted rust plates under one wire of bare bulbs —
// four rows: the identity strip, the bulb rail, the two hero plates (the
// handheld assay left, the button exchange right) and the bottom band of
// five small plates. Everything animates off the shared conductor clock;
// the scene owns no timers. Below 768 px the rows stack and the plates go
// full width; the bulb rail and the manual clause drop first, per the
// reference's portrait strategy (noted in the scene report).

import '@fontsource/rubik'
import '@fontsource/rubik/500.css'
import '@fontsource/rubik/600.css'
import '@fontsource/rubik/700.css'
import '@fontsource/vt323'
import { useScene } from '../../scene/SceneRoot'
import { bulbFracs, genStats } from './shared'
import IdentityStrip from './IdentityStrip'
import BulbRail from './BulbRail'
import AssayPlate from './AssayPlate'
import ExchangePlate from './ExchangePlate'
import { TalliesPlate, PostLogPlate, GeneratorPlate, WeatherPlate, ClausePlate } from './BottomPlates'

export default function CyberPassScene() {
  const { snap, conductor } = useScene()
  const g = genStats(snap, snap && snap.gpu, snap && snap.host)
  // Wash opacity rides the eased conductor heat in coarse 0.1 steps, not
  // the per-tick lit count: a smooth binding would still breathe every
  // tick, and engine flaps would pulse the whole wall. Steps hold still.
  const heat = Math.round(Math.min(1, Math.max(0, conductor.heat)) * 10) / 10
  const litMask = (i) => !g.dead.includes(i)
  const fracs = bulbFracs(litMask)
  // the screen-blended pool of bulb light on the wall, positioned from the
  // lit-bulb x fractions and eased by CSS at feed rate
  const lightBg =
    fracs.length > 0
      ? fracs.map((x) => `radial-gradient(8% 58% at ${x.toFixed(2)}% 1%, rgba(255,227,188,0.1), rgba(255,227,188,0) 100%)`).join(', ')
      : 'none'

  return (
    <div className="cy-stage relative flex min-h-dvh flex-col overflow-x-hidden font-mono text-ink-1 min-[769px]:h-dvh min-[769px]:min-h-0 min-[769px]:overflow-hidden">
      {/* stage atmosphere: bulb wash + vignette + static rust grain */}
      <div
        className="cy-light hidden min-[769px]:block"
        style={{ top: '9%', height: '58%', backgroundImage: lightBg, opacity: 0.35 + heat * 0.6 }}
        aria-hidden="true"
      />
      <div className="cy-vignette pointer-events-none absolute inset-0 z-[60] hidden min-[769px]:block" aria-hidden="true" />
      <div className="cy-grain pointer-events-none absolute inset-0 z-[70] hidden min-[769px]:block" aria-hidden="true" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col min-[769px]:grid min-[769px]:grid-rows-[auto_auto_minmax(0,62fr)_minmax(0,38fr)]">
        {/* T · identity strip */}
        <IdentityStrip />

        {/* the bulb rail (drops first on phones) */}
        <BulbRail />

        {/* the middle: the assay (hero 1) and the exchange (hero 2) */}
        <section
          aria-label="The assay and the exchange"
          className="flex min-h-0 flex-col gap-1.5 p-1.5 min-[769px]:grid min-[769px]:grid-cols-[minmax(0,46fr)_minmax(0,54fr)]"
        >
          <AssayPlate />
          <ExchangePlate />
        </section>

        {/* the bottom band of five small plates */}
        <section
          aria-label="Post ledgers"
          className="flex min-h-0 flex-col gap-1.5 p-1.5 min-[769px]:grid min-[769px]:grid-cols-[minmax(0,19fr)_minmax(0,29fr)_minmax(0,18fr)_minmax(0,15fr)_minmax(0,19fr)]"
        >
          <TalliesPlate />
          <PostLogPlate />
          <GeneratorPlate />
          <WeatherPlate />
          {/* the manual clause drops first on phones */}
          <ClausePlate />
        </section>
      </div>
    </div>
  )
}

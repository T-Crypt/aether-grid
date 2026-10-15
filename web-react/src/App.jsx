import { useCallback, useEffect, useState } from 'react'
import Atmosphere from './components/Atmosphere'
import Header from './components/Header'
import TimecodeStrip from './components/TimecodeStrip'
import Metrics from './components/Metrics'
import TerrainPanel from './components/TerrainPanel'
import HelixPanel from './components/HelixPanel'
import GaugePanel from './components/GaugePanel'
import FieldLayersPanel from './components/FieldLayersPanel'
import CohortPanel from './components/CohortPanel'
import LogPanel from './components/LogPanel'
import DataBand from './components/DataBand'
import Foot from './components/Foot'
import { useTelemetry } from './hooks/useTelemetry'
import { DEFAULT_SKIN, SKIN_IDS, skinById, faviconFor } from './lib/skins'

const SKIN_KEY = 'aether.console.skin'

export default function App() {
  const { snap, tick, paused, setPaused, stepOnce, reduced } = useTelemetry()
  const [skin, setSkin] = useState(() => {
    const s = document.documentElement.dataset.skin
    return SKIN_IDS.includes(s) ? s : DEFAULT_SKIN
  })
  const [active, setActive] = useState({
    declination: true,
    scopeOmega: true,
    loom9: true,
    safehouse: true,
  })

  const pal = skinById(skin).palette

  useEffect(() => {
    document.documentElement.dataset.skin = skin
    document.title = `Aether Grid | ${skinById(skin).label}`
    const fav = document.getElementById('favicon')
    if (fav) fav.href = faviconFor(skin)
    try {
      localStorage.setItem(SKIN_KEY, skin)
    } catch {
      /* storage blocked */
    }
  }, [skin])

  const toggleLayer = useCallback((id) => {
    setActive((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  // Motion is off for anyone who asked for reduced motion; the feed also starts
  // held in that case, so the console renders as a still, readable frame.
  const animated = !reduced

  return (
    <>
      <Atmosphere />
      <Header
        snap={snap}
        skin={skin}
        onSkin={setSkin}
        paused={paused}
        onTogglePause={() => setPaused((p) => !p)}
        onStep={stepOnce}
        tick={tick}
      />

      <div className="relative z-10 mx-auto max-w-[1760px] px-3 pb-8 sm:px-5">
        <TimecodeStrip snap={snap} />

        <main className="grid gap-3 lg:grid-cols-[1.15fr_1.5fr_1fr]">
          <div className="lg:col-span-3">
            <Metrics snap={snap} tick={tick} />
          </div>

          <TerrainPanel snap={snap} pal={pal} animated={animated} revision={tick} stagger={0.05} />
          <HelixPanel snap={snap} pal={pal} animated={animated} revision={tick} stagger={0.1} />
          <GaugePanel snap={snap} stagger={0.15} />

          <div className="lg:col-span-3">
            <FieldLayersPanel
              snap={snap}
              pal={pal}
              active={active}
              onToggle={toggleLayer}
              animated={animated}
              revision={tick}
              stagger={0.2}
            />
          </div>

          <div className="lg:col-span-2">
            <CohortPanel snap={snap} stagger={0.25} />
          </div>
          <LogPanel snap={snap} stagger={0.3} />
        </main>

        <DataBand snap={snap} />
        <Foot snap={snap} />
      </div>
    </>
  )
}

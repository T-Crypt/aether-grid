// Hex-Lab scene: the base console layout (the uispace.org/hex-lab.html
// recreation). Everything here is scene chrome; app-level chrome (the scene
// dock) lives in App.jsx and mounts above the active scene.

import { useScene } from '../../scene/SceneRoot'
import Atmosphere from '../../components/Atmosphere'
import LayerStack from '../../components/LayerStack'
import Header from '../../components/Header'
import TimecodeStrip from '../../components/TimecodeStrip'
import KpiStrip from '../../components/KpiStrip'
import TerrainScope from '../../components/TerrainScope'
import HelixHero from '../../components/HelixHero'
import GpuScope from '../../components/GpuScope'
import CohortGrid from '../../components/CohortGrid'
import LogScope from '../../components/LogScope'
import DataBand from '../../components/DataBand'
import Foot from '../../components/Foot'

export default function HexlabScene() {
  const { mode } = useScene()

  return (
    <div className="relative min-h-screen">
      <Atmosphere />
      <LayerStack />
      <Header />

      <div className="relative z-10 mx-auto max-w-[1920px] px-3 pb-5 sm:px-5">
        {mode === 'offline' ? (
          <div
            role="status"
            className="mb-3 flex items-center gap-2 border border-alm/45 bg-alm/10 px-3 py-2 text-2xs text-ink-1"
          >
            <span className="h-1.5 w-1.5 shrink-0 animate-pulseDot rounded-full bg-alm" aria-hidden="true" />
            collector unreachable — retrying
          </div>
        ) : null}

        <TimecodeStrip />
        <KpiStrip />

        <main
          aria-label="Scene"
          className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-[minmax(240px,330px)_minmax(0,1fr)_minmax(270px,390px)] lg:h-[calc(100dvh-332px)] lg:min-h-[560px]"
        >
          <div className="flex min-h-0 flex-col gap-2 lg:order-1">
            <TerrainScope className="flex-[5]" />
            <GpuScope className="flex-[6]" />
          </div>

          <div className="flex min-h-0 flex-col lg:order-2">
            <HelixHero className="h-full" />
          </div>

          <div className="flex min-h-0 flex-col gap-2 lg:order-3">
            <CohortGrid className="flex-[5]" />
            <LogScope className="flex-[6]" />
          </div>
        </main>

        <DataBand />
        <Foot />
      </div>
    </div>
  )
}

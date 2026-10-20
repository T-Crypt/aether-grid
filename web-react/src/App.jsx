// Aether Grid console. App-level chrome (the scene dock) mounts above the
// active scene; each scene brings its own chrome, layout and painters. The
// conductor model lives in src/scene/SceneRoot.jsx.

import SceneRoot, { useScene } from './scene/SceneRoot'
import SceneDock from './components/SceneDock'
import HexlabScene from './scenes/hexlab/Scene'
import SafehouseScene from './scenes/safehouse/Scene'
import OrbitScene from './scenes/orbit/Scene'
import FoundryScene from './scenes/foundry/Scene'
import SpectrumScene from './scenes/spectrum/Scene'

// One Root component per scene id in lib/scenes.js.
const SCENE_ROOTS = {
  hexlab: HexlabScene,
  safehouse: SafehouseScene,
  orbit: OrbitScene,
  foundry: FoundryScene,
  spectrum: SpectrumScene,
}

function SceneMount() {
  const { scene } = useScene()
  const Root = SCENE_ROOTS[scene] || SCENE_ROOTS.hexlab
  return (
    <>
      <Root />
      <SceneDock />
    </>
  )
}

export default function App() {
  return (
    <SceneRoot>
      <SceneMount />
    </SceneRoot>
  )
}

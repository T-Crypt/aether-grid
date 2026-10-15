// Aether Grid console. App-level chrome (the scene dock) mounts above the
// active scene; each scene brings its own chrome, layout and painters. The
// conductor model lives in src/scene/SceneRoot.jsx.

import SceneRoot, { useScene } from './scene/SceneRoot'
import SceneDock from './components/SceneDock'
import HexlabScene from './scenes/hexlab/Scene'
import SafehouseScene from './scenes/safehouse/Scene'
import BloomLineScene from './scenes/bloom-line/Scene'
import CyberPassScene from './scenes/cyber-pass/Scene'
import DeepsignalScene from './scenes/deepsignal/Scene'

// One Root component per scene id in lib/scenes.js.
const SCENE_ROOTS = {
  hexlab: HexlabScene,
  safehouse: SafehouseScene,
  'bloom-line': BloomLineScene,
  'cyber-pass': CyberPassScene,
  deepsignal: DeepsignalScene,
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

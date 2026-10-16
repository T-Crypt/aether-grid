import '@fontsource-variable/jetbrains-mono'
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { SCENE_IDS } from './lib/scenes'
import { savedScene, schemeForScene } from './lib/scheme'

// The skin and scene live on <html data-skin data-scene> so the token blocks
// in index.css apply before React paints, and so the static UI and the
// console share one switch. Both come from lib/scheme, the same rules
// SceneRoot applies on a scene switch.
//
// A ?scene= deep link wins over the saved choice. SceneRoot persists the
// live scene on mount, so the deep link is remembered either way.
try {
  const fromUrl = new URLSearchParams(window.location.search).get('scene')
  const scene = fromUrl && SCENE_IDS.includes(fromUrl) ? fromUrl : savedScene()
  document.documentElement.dataset.scene = scene
  document.documentElement.dataset.skin = schemeForScene(scene)
} catch {
  /* no window or storage: markup defaults stand */
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

import '@fontsource-variable/jetbrains-mono'
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { SCENE_IDS, DEFAULT_SCENE, sceneById } from './lib/scenes'
import { SKIN_IDS, DEFAULT_SKIN } from './lib/skins'

// The skin and scene live on <html data-skin data-scene> so the token blocks
// in index.css apply before React paints, and so the static UI and the
// console share one switch.
const SCENE_KEY = 'aether.console.scene'
const SKIN_KEY = 'aether.console.skin'

const savedOr = (key, valid, fallback) => {
  try {
    const saved = localStorage.getItem(key)
    if (saved && valid.includes(saved)) return saved
  } catch {
    /* storage blocked: keep the markup default */
  }
  return fallback
}

// A ?scene= deep link wins over the saved choice and is remembered.
try {
  const fromUrl = new URLSearchParams(window.location.search).get('scene')
  let scene
  if (fromUrl && SCENE_IDS.includes(fromUrl)) {
    scene = fromUrl
    localStorage.setItem(SCENE_KEY, fromUrl)
  } else {
    scene = savedOr(SCENE_KEY, SCENE_IDS, DEFAULT_SCENE)
  }
  document.documentElement.dataset.scene = scene
  // A scene's remembered scheme wins; else the scene's native default
  // scheme. The base scene keeps the legacy global key for skins chosen
  // before scenes existed.
  const stored = savedOr(SKIN_KEY + '.' + scene, SKIN_IDS, null)
  const skin =
    stored || (scene === DEFAULT_SCENE ? savedOr(SKIN_KEY, SKIN_IDS, DEFAULT_SKIN) : sceneById(scene).defaultScheme)
  document.documentElement.dataset.skin = skin
} catch {
  /* no window or storage: markup defaults stand */
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

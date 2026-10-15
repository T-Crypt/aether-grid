import '@fontsource-variable/jetbrains-mono'
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { SCENE_IDS, DEFAULT_SCENE } from './lib/scenes'

// The skin and scene live on <html data-skin data-scene> so the token blocks
// in index.css apply before React paints, and so the static UI and the
// console share one switch.
const SCENE_KEY = 'aether.console.scene'
const SKIN_KEY = 'aether.console.skin'
const VALID = ['hexlab', 'aether', 'braid', 'isodose', 'corvane', 'sounding', 'gullet']

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
  if (fromUrl && SCENE_IDS.includes(fromUrl)) {
    document.documentElement.dataset.scene = fromUrl
    localStorage.setItem(SCENE_KEY, fromUrl)
  } else {
    document.documentElement.dataset.scene = savedOr(SCENE_KEY, SCENE_IDS, DEFAULT_SCENE)
  }
  document.documentElement.dataset.skin = savedOr(SKIN_KEY, VALID, 'hexlab')
} catch {
  /* no window or storage: markup defaults stand */
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

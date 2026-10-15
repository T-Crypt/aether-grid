import '@fontsource-variable/jetbrains-mono'
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// The skin lives on <html data-skin> so the token block in index.css applies
// before React paints, and so the static UI and the console share one switch.
const SKIN_KEY = 'aether.console.skin'
const VALID = ['hexlab', 'aether', 'braid', 'isodose', 'corvane', 'sounding', 'gullet']
try {
  const saved = localStorage.getItem(SKIN_KEY)
  if (saved && VALID.includes(saved)) document.documentElement.dataset.skin = saved
} catch {
  /* storage blocked: keep the markup default */
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

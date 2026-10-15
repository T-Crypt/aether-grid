// SceneDock: the persistent scene and scheme switcher, pinned bottom-right.
//
// App-level chrome, not scene chrome: it mounts above every scene, takes its
// colours from the resolved palette tokens, and stays legible in any scene.
// Collapsed it is one toggle button; expanded it lists the scenes and the
// base schemes the active scene offers.

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Layers } from 'lucide-react'
import { SKINS, skinById } from '../lib/skins'
import { SCENES, sceneById, resolvePalette } from '../lib/scenes'
import { useScene } from '../scene/SceneRoot'

const BTN =
  'inline-flex items-center gap-2 border border-acc/30 bg-space-950/85 px-3 py-2 text-2xs ' +
  'text-ink-2 backdrop-blur-md transition-colors hover:border-acc/60 hover:text-ink-1 ' +
  'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-acc'

function Swatch({ rgb, size = 'h-2 w-2' }) {
  return <span aria-hidden="true" className={`inline-block shrink-0 rounded-full ${size}`} style={{ backgroundColor: `rgb(${rgb})` }} />
}

export default function SceneDock() {
  const { scene, setScene, skin, setSkin } = useScene()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const meta = sceneById(scene)
  const palette = resolvePalette(scene, skin)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const chip = (active) =>
    `inline-flex items-center gap-1.5 px-2 py-1 text-2xs whitespace-nowrap transition-colors ` +
    `focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-acc ` +
    (active ? 'bg-acc/[0.14] text-ink-1' : 'text-ink-3 hover:bg-acc/[0.07] hover:text-ink-1')

  return (
    <div ref={rootRef} className="fixed bottom-3 right-3 z-50 flex flex-col items-end gap-1.5">
      {open ? (
        <div
          role="group"
          aria-label="Scene and scheme"
          className="w-[min(300px,calc(100vw-24px))] border border-acc/25 bg-space-950/90 p-3 backdrop-blur-md"
        >
          <div className="micro text-ink-3">scene</div>
          <div className="mt-1.5 flex flex-col gap-1">
            {SCENES.map((s) => {
              const isActive = s.id === scene
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    setScene(s.id)
                    if (isActive) setOpen(false)
                  }}
                  className={chip(isActive)}
                >
                  <Swatch rgb={resolvePalette(s.id, s.defaultScheme).acc} />
                  {s.label}
                  {isActive ? null : (
                    <span className="micro ml-auto text-ink-3">{s.schemes.length} schemes</span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="micro mt-3 text-ink-3">scheme · {skinById(skin).label}</div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {SKINS.filter((k) => meta.schemes.includes(k.id)).map((k) => {
              const isActive = k.id === skin
              return (
                <button
                  key={k.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setSkin(k.id)}
                  title={k.label}
                  className={chip(isActive)}
                >
                  <Swatch rgb={resolvePalette(scene, k.id).acc} />
                  {k.label}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className={BTN}
        aria-expanded={open}
        aria-label="Switch scene and scheme"
        title="Switch scene and scheme"
        onClick={() => setOpen((o) => !o)}
      >
        <Layers size={12} aria-hidden="true" className="text-acc" />
        <span className="micro text-ink-3">scene</span>
        <span className="text-ink-1">{meta.label}</span>
        <Swatch rgb={palette.acc} />
        <ChevronDown size={12} aria-hidden="true" className={`text-ink-3 transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>
    </div>
  )
}

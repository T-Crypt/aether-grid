// SceneRoot: the single conductor of the console scene.
//
// Model (read this before adding anything that animates):
//
//   SceneRoot is the ONLY component that touches the telemetry feed and the
//   ONLY place a timer exists. It owns one `conductor` (scene/conductor.js):
//
//     clock    one requestAnimationFrame loop advances conductor.t and calls
//              every registered painter. No component may run its own
//              setInterval/RAF; high-frequency visuals register a paint
//              function (scene/Canvas.jsx) and read the latest snapshot
//              straight off the conductor. React state changes at feed rate
//              only (<= 1 Hz), so the tree never re-renders per frame.
//
//     events   the translator (translateSnap) diffs each feed snap and emits
//              the five canonical events: request_arrived, token_generated,
//              kv_slot_changed, vram_pressure, anomaly. Each event fans out
//              to `conductor.on(type, fn)` subscribers AND leaves a frame
//              trace (helix kick, KV flashes, pings) that the canvas
//              painters consume, so one event ripples across the whole scene
//              in the same frame.
//
//     state    conductor.heat / .alert / .flow / .reason are smoothed 0..1
//              scalars, published to the document as --heat / --alert /
//              --flow, so CSS chrome (KPI strip, log rail, warm wash) tracks
//              the scene palette without React.
//
//   Skin authors: a skin supplies tokens only (index.css custom properties +
//   the palette mirror in lib/skins.js). The conductor exposes the active
//   palette as conductor.palette ("R G B" channels); painters and Scope
//   primitives take colour from there, never from a hard-coded value except
//   the absolute alarm red (ALM in scene/conductor.js).
//
//   Layers: declination (backdrop), loom-9 (cables), scope-omega (scatter)
//   paint full-bleed behind the scene; safehouse paints as a pinned corner
//   overlay. Toggles live in `layers` and gate both the canvas and its
//   visibility.
//
//   Scenes: a scene is a complete visual program (chrome, layout, painters)
//   for the same telemetry. The registry (lib/scenes.js) is pure data; the
//   Root component per scene id mounts in App.jsx. `scene` + `skin` together
//   select the palette: conductor.palette = resolvePalette(scene, skin).
//   App-level chrome (the scene dock) mounts above the active scene.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTelemetry } from '../hooks/useTelemetry'
import { createConductor, translateSnap } from './conductor'
import { DEFAULT_SKIN, SKIN_IDS, skinById, faviconFor } from '../lib/skins'
import { DEFAULT_SCENE, SCENE_IDS, sceneById, resolvePalette } from '../lib/scenes'
import { schemeForScene, rememberScene } from '../lib/scheme'

export const SceneCtx = createContext(null)
export const useScene = () => useContext(SceneCtx)

const LAYER_IDS = ['declination', 'scopeOmega', 'loom9', 'safehouse']

export default function SceneRoot({ children }) {
  const { snap, tick, paused, setPaused, stepOnce, reduced, demo } = useTelemetry()
  const [layers, setLayers] = useState({ declination: true, scopeOmega: true, loom9: true, safehouse: true })
  const [skin, setSkin] = useState(() => {
    const s = document.documentElement.dataset.skin
    return SKIN_IDS.includes(s) ? s : DEFAULT_SKIN
  })
  const [scene, setScene] = useState(() => {
    const s = document.documentElement.dataset.scene
    return SCENE_IDS.includes(s) ? s : DEFAULT_SCENE
  })

  const conductor = useMemo(() => createConductor(), [])
  const prevSnap = useRef(null)

  // Feed-rate work: hand the new snapshot to the translator (canonical
  // events + smoothed targets). This runs at most once per second.
  useEffect(() => {
    if (!snap) return
    conductor.tick = tick
    conductor.demo = demo
    conductor.reduced = reduced
    conductor.paused = paused
    translateSnap(prevSnap.current, snap, conductor)
    prevSnap.current = snap
  }, [snap, tick, conductor, demo, reduced, paused])

  // The one clock. Runs while the scene is animated (not reduced, not
  // paused, feed moving). rAF naturally suspends in hidden tabs.
  const animated = !reduced && !paused && snap != null
  useEffect(() => {
    conductor.running = animated
    if (!animated) {
      // Not animated: settle every canvas on the latest frame.
      conductor.paintSettled()
      return undefined
    }
    let raf = 0
    let last = performance.now()
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      conductor.frame(dt)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [animated, conductor])

  // Layer toggles + skin are scene-global, so they live here.
  const setLayer = useCallback((id) => {
    if (!LAYER_IDS.includes(id)) return
    setLayers((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      conductor.layers = next
      return next
    })
  }, [conductor])

  useEffect(() => {
    conductor.layers = layers
  }, [layers, conductor])

  // Switching scenes enters the scene on its own scheme: the scheme the
  // user last chose in that scene, else its native default scheme. Same
  // rules as boot (lib/scheme), so a reload and a switch agree.
  const switchScene = useCallback((id) => {
    if (!SCENE_IDS.includes(id)) return
    setScene(id)
    setSkin(schemeForScene(id))
  }, [])

  useEffect(() => {
    const meta = sceneById(scene)
    document.documentElement.dataset.scene = scene
    document.documentElement.dataset.skin = skin
    conductor.palette = resolvePalette(scene, skin)
    document.title =
      scene === DEFAULT_SCENE
        ? `Aether Grid | ${skinById(skin).label}`
        : `Aether Grid | ${meta.label} / ${skinById(skin).label}`
    const fav = document.getElementById('favicon')
    if (fav) fav.href = faviconFor(skin)
    rememberScene(scene, skin)
  }, [scene, skin, conductor])

  const value = useMemo(
    () => ({
      conductor,
      snap,
      tick,
      paused,
      setPaused,
      stepOnce,
      reduced,
      demo,
      animated,
      layers,
      setLayer,
      scene,
      setScene: switchScene,
      skin,
      setSkin,
      mode: snap?.mode || 'boot',
    }),
    [conductor, snap, tick, paused, reduced, demo, layers, scene, skin],
  )

  return (
    <SceneCtx.Provider value={value}>{children}</SceneCtx.Provider>
  )
}

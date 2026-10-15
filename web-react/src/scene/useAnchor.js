// Registers a DOM element with the conductor under an id, so full-bleed
// layers can route cables and pings to it (queue cell, hero stage, KV grid,
// GPU block, engine rail). The conductor re-measures on its own cadence;
// this hook only hands over the element on mount/unmount.

import { useEffect, useRef } from 'react'
import { useScene } from './SceneRoot'

export default function useAnchor(id) {
  const scene = useScene()
  const ref = useRef(null)
  useEffect(() => {
    if (!scene) return undefined
    const el = ref.current
    scene.conductor.anchor(id, el)
    return () => scene.conductor.anchor(id, null)
  }, [scene, id])
  return ref
}

// SceneCanvas: the only way a component animates on the shared clock.
//
// The canvas registers one paint function with the SceneRoot conductor; the
// conductor's single rAF loop calls it every frame with the latest
// conductor (clock time, snapshot, palette, event traces). The `draw`
// function is read through a ref, so the component can re-render at feed
// rate without ever restarting the paint loop. It never owns a timer
// of its own.
//
// Two sizing modes:
//   scoped    (default) canvas fills its Scope body (ResizeObserver)
//   viewport  canvas is fixed inset-0 over the whole window. The full-bleed
//             ambient layers (declination, loom-9, scope-omega, safehouse)
//
// Static fallback: when the scene is not animated (reduced motion or a held
// feed) the canvas paints one settled frame per data revision instead of
// running a loop.

import { useEffect, useRef } from 'react'
import { useScene } from './SceneRoot'

export default function SceneCanvas({ draw, viewport = false, res = 1, className = '', label, z }) {
  const scene = useScene()
  const ref = useRef(null)
  const drawRef = useRef(draw)
  drawRef.current = draw
  const offRef = useRef(null)
  // Stable dep key: the conductor instance is created once per SceneRoot,
  // while the context value identity renews every feed tick. Keying on the
  // conductor keeps one registration per mount instead of a fit (backing
  // store clear) plus unregister/re-register on every tick.
  const conductor = scene.conductor

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return undefined
    const c = conductor
    const ctx = canvas.getContext('2d')
    let size = { w: 1, h: 1 }
    let dpr = 1
    let disposed = false

    const fit = () => {
      // `res` < 1 renders the backing store smaller than the CSS box; the
      // browser upscales it. Ambient washes (declination) are soft enough
      // that half resolution is indistinguishable and halves the fill cost.
      dpr = Math.min(window.devicePixelRatio || 1, 2) * res
      let w, h
      if (viewport) {
        w = window.innerWidth
        h = window.innerHeight
      } else {
        const r = canvas.getBoundingClientRect()
        w = Math.max(1, Math.round(r.width))
        h = Math.max(1, Math.round(r.height))
      }
      size = { w, h }
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const paint = () => {
      if (disposed) return
      ctx.clearRect(0, 0, size.w, size.h)
      drawRef.current(ctx, size.w, size.h, c)
    }

    fit()
    offRef.current = c.register(paint)
    paint() // settled first frame (also the reduced-motion path)

    let onResize = null
    let ro = null
    if (viewport) {
      onResize = () => {
        fit()
        if (!c.running) paint()
      }
      window.addEventListener('resize', onResize)
    } else {
      ro = new ResizeObserver(() => {
        fit()
        if (!c.running) paint()
      })
      ro.observe(canvas)
    }

    return () => {
      disposed = true
      offRef.current?.()
      offRef.current = null
      if (onResize) window.removeEventListener('resize', onResize)
      ro?.disconnect()
    }
  }, [conductor, viewport])

  const style = viewport
    ? { position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: z ?? 0, pointerEvents: 'none' }
    : { display: 'block', width: '100%', height: '100%' }

  return <canvas ref={ref} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'} style={style} className={className} />
}

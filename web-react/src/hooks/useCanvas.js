import { useEffect, useRef } from 'react'

/**
 * Canvas lifecycle helper: DPR-correct sizing, ResizeObserver, and either a
 * requestAnimationFrame loop or one static frame.
 *
 * `draw(ctx, width, height, seconds)` is read through a ref, so it always sees
 * the latest props without restarting the loop. When `animated` is false the
 * canvas paints once and then re-paints whenever `revision` changes — that is
 * the reduced-motion path, where the console shows a still frame of live data.
 */
export function useCanvas(draw, { animated = true, revision = 0 } = {}) {
  const ref = useRef(null)
  const drawRef = useRef(draw)
  drawRef.current = draw
  const paintRef = useRef(() => {})

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    let raf = 0
    let running = true
    const started = performance.now()

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      const w = Math.max(1, Math.round(rect.width))
      const h = Math.max(1, Math.round(rect.height))
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      return { w, h }
    }

    let size = fit()
    const paint = (t) => {
      ctx.clearRect(0, 0, size.w, size.h)
      drawRef.current(ctx, size.w, size.h, t)
    }
    paintRef.current = paint

    const loop = (now) => {
      if (!running) return
      paint((now - started) / 1000)
      raf = requestAnimationFrame(loop)
    }

    if (animated) raf = requestAnimationFrame(loop)
    else paint(0)

    const ro = new ResizeObserver(() => {
      size = fit()
      if (!animated) paint(0)
    })
    ro.observe(canvas)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [animated])

  // Static path: repaint on new data.
  useEffect(() => {
    if (!animated) paintRef.current(0)
  }, [animated, revision])

  return ref
}

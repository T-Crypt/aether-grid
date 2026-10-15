import { useEffect, useRef, useState } from 'react'
import { createSimulator } from '../lib/simulator'

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = (e) => setReduced(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

/**
 * One telemetry stream for the whole console.
 *
 * Stands in for the SSE feed in web/app.js: same 1 Hz cadence, same snapshot
 * shape. The simulator runs once and is stepped on an interval; `paused` stops
 * the clock and `prefers-reduced-motion` starts it paused, so the console has a
 * static, readable final frame instead of motion the user did not ask for.
 */
export function useTelemetry({ intervalMs = 1000 } = {}) {
  const reduced = usePrefersReducedMotion()
  const simRef = useRef(null)
  if (simRef.current === null) simRef.current = createSimulator()
  const [snap, setSnap] = useState(() => simRef.current.state)
  const [paused, setPaused] = useState(reduced)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setPaused(reduced)
  }, [reduced])

  useEffect(() => {
    if (paused) return undefined
    const id = window.setInterval(() => {
      setSnap(simRef.current.step())
      setTick((t) => t + 1)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [paused, intervalMs])

  const stepOnce = () => {
    setSnap(simRef.current.step())
    setTick((t) => t + 1)
  }

  return { snap, tick, paused, setPaused, stepOnce, reduced }
}

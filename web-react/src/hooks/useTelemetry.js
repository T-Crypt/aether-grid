import { useEffect, useRef, useState } from 'react'
import { createSimulator } from '../lib/simulator'
import { createLiveFeed } from '../lib/feed'
import { emptyState } from '../lib/adapt'

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
 * `?demo` keeps the seeded simulator: it runs once, is stepped on an
 * interval, `paused` stops the clock, and `prefers-reduced-motion` starts
 * it paused, so the console has a static, readable final frame instead of
 * motion the user did not ask for.
 *
 * Without `?demo` the console is fed by the live collector feed
 * (snapshot + SSE, poll fallback); the app is served by the collector, so
 * there is nothing to pause or step — `paused` stays false and `stepOnce`
 * is a no-op.
 */
export function useTelemetry({ intervalMs = 1000 } = {}) {
  const reduced = usePrefersReducedMotion()
  const demo =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo')

  const simRef = useRef(null)
  if (demo && simRef.current === null) simRef.current = createSimulator()
  const [snap, setSnap] = useState(() => (demo ? simRef.current.state : emptyState()))
  const [paused, setPaused] = useState(demo ? reduced : false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!demo) return undefined
    setPaused(reduced)
  }, [demo, reduced])

  useEffect(() => {
    if (!demo || paused) return undefined
    const id = window.setInterval(() => {
      setSnap(simRef.current.step())
      setTick((t) => t + 1)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [demo, paused, intervalMs])

  useEffect(() => {
    if (demo) return undefined
    const feed = createLiveFeed({
      onState: (s) => {
        setSnap(s)
        setTick((t) => t + 1)
      },
    })
    feed.start()
    return () => feed.stop()
  }, [demo])

  const stepOnce = () => {
    if (!demo) return
    setSnap(simRef.current.step())
    setTick((t) => t + 1)
  }

  return { snap, tick, paused, setPaused, stepOnce, reduced, demo, mode: snap.mode }
}

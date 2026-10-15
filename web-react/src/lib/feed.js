// Live feed: the collector's /api/snapshot + /api/stream, with a polling
// fallback. The app is served by the collector itself, so the same-origin
// absolute paths are the primary candidates; the relative ones cover a
// build dropped under a subpath.
//
// Lifecycle (mirrors the retired static UI's openSSE/bootLive):
//   1. fetch the snapshot; on success emit it and open the SSE stream
//   2. on SSE error advance to the next candidate; when they run out,
//      poll the snapshot every POLL_MS (feed 'poll')
//   3. if the initial snapshot fetch fails, go offline and retry the SSE
//      open every RETRY_MS until one succeeds
//
// stop() releases the EventSource and both timers, so start/stop cycles
// (StrictMode remounts, hot reload) cannot leak sockets or stack handlers.

import { createDedupe, emptyState, snapshotToState, tickToState } from './adapt'

const SNAPSHOT_PATHS = ['/api/snapshot', './api/snapshot']
const STREAM_PATHS = ['/api/stream', './api/stream']
const POLL_MS = 2000
const RETRY_MS = 10000

async function fetchSnapshot() {
  let err = null
  for (const p of SNAPSHOT_PATHS) {
    try {
      const r = await fetch(p, { cache: 'no-store' })
      if (!r.ok) throw new Error(`http ${r.status}`)
      return await r.json()
    } catch (e) {
      err = e
    }
  }
  throw err || new Error('snapshot failed')
}

export function createLiveFeed({ onState } = {}) {
  const dedupe = createDedupe()
  let state = emptyState()
  let es = null
  let pollTimer = null
  let retryTimer = null
  let alive = false

  const emit = (next) => {
    state = next
    if (typeof onState === 'function') onState(state)
  }

  const closeEs = () => {
    if (es) {
      try {
        es.close()
      } catch {
        /* already closed */
      }
      es = null
    }
  }

  const stopPoll = () => {
    if (pollTimer) {
      window.clearInterval(pollTimer)
      pollTimer = null
    }
  }

  const startPoll = () => {
    if (pollTimer) return
    pollTimer = window.setInterval(async () => {
      if (!alive) return
      try {
        const data = await fetchSnapshot()
        if (!alive) return
        const next = snapshotToState(state, data, dedupe)
        next.feed = 'poll'
        emit(next)
      } catch {
        if (state.mode !== 'offline') emit({ ...state, mode: 'offline' })
      }
    }, POLL_MS)
  }

  const openSse = () => {
    closeEs()
    const tryOpen = (i) => {
      if (!alive) return
      if (i >= STREAM_PATHS.length) {
        startPoll()
        return
      }
      let src
      try {
        src = new EventSource(STREAM_PATHS[i])
      } catch {
        tryOpen(i + 1)
        return
      }
      src.onopen = () => {
        if (es !== null || !alive) {
          try {
            src.close()
          } catch {
            /* noop */
          }
          return
        }
        es = src
        stopPoll()
        if (state.feed !== 'sse') emit({ ...state, feed: 'sse' })
      }
      src.addEventListener('tick', (ev) => {
        if (!alive || es !== src) return
        try {
          emit(tickToState(state, JSON.parse(ev.data), dedupe))
        } catch {
          /* a malformed frame must not kill the feed */
        }
      })
      src.onerror = () => {
        try {
          src.close()
        } catch {
          /* noop */
        }
        if (es === src) es = null
        tryOpen(i + 1)
      }
    }
    tryOpen(0)
  }

  const start = async () => {
    if (alive) return
    alive = true
    try {
      const data = await fetchSnapshot()
      if (!alive) return
      emit(snapshotToState(state, data, dedupe))
      openSse()
    } catch {
      if (!alive) return
      if (state.mode !== 'offline') emit({ ...state, mode: 'offline' })
      startPoll()
      // the snapshot is the source of truth for the initial state: keep
      // trying the stream until one candidate answers
      retryTimer = window.setInterval(() => {
        if (alive && state.mode === 'offline' && !es) openSse()
      }, RETRY_MS)
    }
  }

  const stop = () => {
    alive = false
    closeEs()
    stopPoll()
    if (retryTimer) {
      window.clearInterval(retryTimer)
      retryTimer = null
    }
  }

  return { start, stop }
}

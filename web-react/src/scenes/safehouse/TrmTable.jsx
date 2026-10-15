// TrmTable: the SIGNAL PROCESSING TERMINAL (Bloomberg-style 22-row table).
// Engine rows bind to live engine state: up/down, backend host, queue
// depth; fixed infrastructure rows pad the table to 22 like the reference.
// Row state: amber (warn) on queue pressure, red (alarm) on down engines or
// alerts naming them, and a one-shot cyan flash re-keyed by the conductor's
// anomaly events (a finite CSS animation, no scene timer).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useScene } from '../../scene/SceneRoot'
import { Frame, hexFrom, pad } from './frame.jsx'

const COLS = ['minmax(0,1.4fr) minmax(0,1.2fr) minmax(0,0.9fr) minmax(0,0.9fr) minmax(0,1.2fr) minmax(0,0.6fr) minmax(0,1.0fr)']
const COL_LABELS = ['ENGINE', 'HOST', 'AUTH ID', 'ROUTING', 'ENCRYPTION', 'NODE', 'QUEUE']

// Fixed infrastructure lore rows that pad the table to 22 (atmosphere, not
// telemetry): stable per index, no RNG.
const INFRA = [
  ['098.226.167', 'B189', 'STR', 'AES.07', '14', 'ISO-OWN-A'],
  ['116.025.015', '269D', 'JFK', 'XOR.41', '5C', 'GW-FB1'],
  ['086.035.081', '9F6D', 'MTX', 'XOR.41', '14', 'ISO-OWN-A'],
  ['244.110.186', 'AFBF', 'GVA', 'BLF.83', '0F', 'GW-FB1'],
  ['017.070.024', 'E7B2', 'JFK', 'XOR.41', '7D', 'GW-FB1'],
  ['120.032.045', '3BD7', 'KEF', 'AES.07', '7D', 'PIPE-77'],
  ['119.204.187', 'A298', 'KEF', 'BLF.83', '5C', 'GW-FB1'],
  ['099.146.219', 'AB3B', 'OWL', 'RSA.30', '12', 'ISO-OWN-B'],
  ['040.183.035', 'FD60', 'STR', 'BLF.83', '3A', 'BUF-810-C'],
  ['217.190.132', '6C8A', 'TUL', 'AES.07', '14', 'ISO-OWN-B'],
  ['084.251.021', 'BDD2', 'ZRH', 'XOR.41', '0F', 'BUF-810-C'],
  ['175.192.064', 'BC33', 'OWL', 'RSA.30', '0F', 'ISO-OWN-A'],
  ['230.217.219', '956F', 'OSL', 'BLF.83', '5C', 'ISO-OWN-A'],
  ['187.092.216', '9485', 'KEF', 'EC.5M', '5C', 'PIPE-77'],
]

// Queue-pressure latch (module-local, like cyber-pass lastSeen: written only
// from feed data, read only here). Warn trips at queue >= 8 and holds until
// the queue drains below 6, so per-tick jitter across 8 stops flipping the
// row tint. Same-snap double render is idempotent, so StrictMode is safe.
const pressLatch = new Map()
function pressuredOf(key, q) {
  if (q == null) {
    pressLatch.delete(key)
    return false
  }
  const prev = pressLatch.get(key) || false
  const next = q >= 8 ? true : q < 6 ? false : prev
  pressLatch.set(key, next)
  return next
}

// host:port or bare host from a backend URL; '—' when the engine has none.
function hostOf(backend) {
  if (!backend) return '—'
  const m = String(backend).replace(/^https?:\/\//, '').split('/')[0]
  return m || '—'
}

function TrmRow({ row, flash, onDone }) {
  const state = row.state
  const cls =
    state === 'alarm'
      ? 'text-alm'
      : state === 'warn'
        ? 'text-dat'
        : 'text-ink-2/85'
  return (
    <div
      className={`grid gap-2 whitespace-nowrap px-1 text-[6.5px] leading-[1.3] transition-colors duration-500 ${cls} ${
        flash ? 'sh-flash' : ''
      }`}
      style={{ gridTemplateColumns: COLS[0] }}
      onAnimationEnd={flash ? onDone : undefined}
    >
      {row.cells.map((c, i) => (
        <span key={i} className="truncate tabular-nums">
          {c}
        </span>
      ))}
    </div>
  )
}

export default function TrmTable({ ghosted = false, note }) {
  const { snap, conductor, mode } = useScene()
  const [flash, setFlash] = useState(null) // { i, seq }
  // One-shot boundary: the class clears when the finite animation ends, so
  // a later anomaly on the same row replays by remounting on the new seq
  // key. A redelivered seq is a no-op (dedupe), never a restart. No timer.
  const lastSeq = useRef(null)
  useEffect(() => {
    return conductor.on('anomaly', (ev) => {
      if (ev.seq === lastSeq.current) return
      lastSeq.current = ev.seq
      setFlash({ i: ev.seq % 22, seq: ev.seq })
    })
  }, [conductor])
  const clearFlash = (seq) => setFlash((f) => (f && f.seq === seq ? null : f))

  const rows = useMemo(() => {
    const engines = ((snap && snap.engines) || []).slice(0, 8)
    const alerts = ((snap && snap.alerts) || []).join(' ')
    const out = []
    for (let i = 0; i < engines.length; i++) {
      const e = engines[i]
      const h = i * 7 + 1
      const down = e.up === false
      const named = alerts.length > 0 && alerts.toLowerCase().includes((e.label || e.key || '').toLowerCase())
      const pressured = pressuredOf(e.key || `eng-${i}`, e.queue)
      const cells = [
        e.label || e.key || `ENG-${i}`,
        hostOf(e.backend),
        hexFrom(e.key || e.label || String(i), 4),
        `[${e.backend ? hostOf(e.backend) : e.origin || '—'}]`,
        INFRA[(h * 3) % INFRA.length][3],
        pad(parseInt(hexFrom(e.key || String(i), 2), 16) % 64, 2),
        e.queue != null ? `Q${pad(e.queue)}` : INFRA[(h * 5) % INFRA.length][5],
      ]
      out.push({ key: e.key || `eng-${i}`, cells, state: named || down ? 'alarm' : pressured ? 'warn' : '' })
    }
    const padN = 22 - out.length
    for (let i = 0; i < Math.max(0, padN); i++) {
      const lore = INFRA[i % INFRA.length]
      out.push({
        key: `infra-${i}`,
        cells: [`RP-${150 + i}`, lore[0], lore[1], `[${lore[2]}]`, lore[3], lore[4], lore[5]],
        state: '',
      })
    }
    return out.slice(0, 22)
  }, [snap])

  return (
    <Frame title="SIGNAL PROCESSING TERMINAL" tag="LK-R3" empty={ghosted} note={note} className="flex-[24] min-h-[170px] md:min-h-0">
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,0.6fr)_minmax(0,1fr)] gap-2 whitespace-nowrap border-b border-acc/25 px-1 pb-0.5 text-[7px] uppercase tracking-[0.06em] text-ink-3">
        {COL_LABELS.map((c) => (
          <span key={c} className="truncate">
            {c}
          </span>
        ))}
      </div>
      <div className="h-full overflow-hidden pt-0.5" role="table" aria-label="Signal processing rows">
        {rows.map((r, i) => {
          const hot = !!(flash && flash.i === i)
          return (
            <TrmRow
              key={hot ? `${r.key}-${flash.seq}` : r.key}
              row={r}
              flash={hot}
              onDone={hot ? () => clearFlash(flash.seq) : undefined}
            />
          )
        })}
      </div>
    </Frame>
  )
}

// RightRail: the 200 px pressure strip (hidden below 768 px). The 18-row
// list is the capacity telemetry (every row a snapshot key or a direct
// derivation); sparse conductor events (kv well-state crossings, vram
// pressure, anomalies) re-key one row so a finite CSS flash plays once —
// never per tick (no scene timer). EVICTION LOG = the newest capacity
// events; HEADROOM ring = free VRAM against the pool; the pressure strip
// resamples kpiHist.vram. Offline: frames stay, bodies show "no source".

import { useEffect, useState } from 'react'
import { useScene } from '../../scene/SceneRoot'
import { wellState } from '../../lib/format'
import { telemRows, evictLog, headroom, pressureCells, activeOf } from './shared'

const STRIP_COLS = 12

function Ring({ pct }) {
  const R = 26
  const C = 2 * Math.PI * R
  const ticks = Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2 - Math.PI / 2)
  const hot = pct != null && pct <= 10
  return (
    <svg viewBox="0 0 64 64" className="h-[64px] w-[64px] shrink-0" aria-label={`Headroom ${pct != null ? pct : '—'}%`}>
      <circle cx="32" cy="32" r={R} fill="none" stroke="rgb(var(--pan))" strokeWidth="4" opacity="0.85" />
      <circle
        cx="32"
        cy="32"
        r={R}
        fill="none"
        stroke={hot ? 'rgb(var(--alm))' : 'rgb(var(--col))'}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${((pct != null ? pct : 0) / 100) * C} ${C}`}
        transform="rotate(-90 32 32)"
        opacity="0.85"
      />
      {ticks.map((a, i) => (
        <line
          key={i}
          x1={32 + Math.cos(a) * R + Math.cos(a) * 1}
          y1={32 + Math.sin(a) * R + Math.sin(a) * 1}
          x2={32 + Math.cos(a) * (R + 3)}
          y2={32 + Math.sin(a) * (R + 3)}
          stroke="rgb(var(--acc))"
          strokeWidth="1"
          opacity="0.4"
        />
      ))}
      <text x="32" y="34" textAnchor="middle" dominantBaseline="middle" fill={hot ? 'rgb(var(--alm))' : 'rgb(var(--col))'} fontSize="13" fontFamily="inherit">
        {pct != null ? `${pct}%` : '—'}
      </text>
    </svg>
  )
}

export default function RightRail() {
  const { snap, conductor } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const heat = Math.min(1, conductor.heat)
  const alert = Math.min(1, conductor.alert)

  // Event-driven row flash: re-key one row per sparse conductor event so its
  // finite CSS flash plays once. token_generated is deliberately NOT
  // subscribed: it fires every tick, which re-keyed a row per tick and read
  // as constant flashing. vram_pressure flashes the VRAM row (0), a kv
  // well-state crossing flashes its state row, anomalies the AT RISK row.
  const [flash, setFlash] = useState(null)
  useEffect(() => {
    const offKv = conductor.on('kv_slot_changed', (ev) => {
      if (wellState(ev.from) !== wellState(ev.to)) setFlash({ i: 4, seq: 'kv' + ev.seq })
    })
    const offVp = conductor.on('vram_pressure', (ev) => setFlash({ i: 0, seq: 'vp' + ev.seq }))
    const offAn = conductor.on('anomaly', (ev) => setFlash({ i: 5, seq: 'an' + ev.seq }))
    return () => {
      offKv()
      offVp()
      offAn()
    }
  }, [conductor])

  const rows = offline ? telemRows(null) : telemRows(snap)
  const act = activeOf(snap)
  const liveLine = offline
    ? null
    : `${act.tps != null ? `${Math.round(act.tps)} TOK/S` : '— TOK/S'} · MTP ${act.mtp != null ? `${Math.round(act.mtp)}%` : '—'} · THINK ${act.think != null ? Math.round(act.think) : '—'} · ENG ${act.engine || '—'}`
  const log = evictLog(offline ? null : snap)
  const hr = headroom(offline ? null : snap)
  const strip = pressureCells(offline ? null : snap)
  const noSrc = (
    <div className="flex h-full min-h-[24px] items-center justify-center">
      <span className="text-[8px] uppercase tracking-[0.2em] text-ink-3">no source</span>
    </div>
  )

  return (
    <aside
      className="hidden min-w-0 flex-col overflow-hidden border-l border-ink-3/20 bg-gradient-to-l from-bgg/70 to-bgg/40 text-[9px] min-[769px]:flex min-[769px]:w-[200px]"
      aria-label="Pressure telemetry rail"
    >
      <div className="flex items-baseline justify-between px-2.5 pt-2 pb-1.5">
        <span className="text-[8px] tracking-[0.2em] text-acc">PRESSURE · 18 POS.</span>
        <span className="or-flash h-1.5 w-1.5 rounded-full bg-acc shadow-[0_0_6px_rgb(var(--acc)_/_0.6)]" aria-hidden="true" />
      </div>

      {/* 18-row telemetry list */}
      <div className="flex-1 overflow-hidden px-1">
        {offline ? (
          noSrc
        ) : (
          rows.map((r, i) => (
            <div
              key={flash && flash.i === i ? `${i}-${flash.seq}` : `row-${i}`}
              className={`or-trow grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-1.5 border-b border-dotted border-ink-3/20 px-2 py-px ${
                flash && flash.i === i ? 'or-row-flash' : ''
              }`}
            >
              <span className="truncate text-[7.5px] tracking-[0.06em] text-ink-3">
                <span className="text-[7px] tracking-[0.08em] text-acc">{r.key}</span>
              </span>
              <span
                className={`whitespace-nowrap text-right text-[8.5px] tabular-nums ${
                  r.state === 'alarm'
                    ? 'text-alm [text-shadow:0_0_4px_rgb(var(--alm)_/_0.5)]'
                    : r.state === 'warn'
                      ? 'text-dat'
                      : 'text-ink-2'
                }`}
              >
                {r.val}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Eviction / reingest log */}
      <div className="border-t border-ink-3/20 px-2.5 pt-1.5 pb-1">
        <div className="text-[7.5px] uppercase tracking-[0.18em] text-acc">
          EVICTION · REINGEST<span className="mt-px block text-[6.5px] tracking-[0.16em] text-ink-3">CAPACITY EVENTS · LAST 8</span>
        </div>
        {offline ? (
          noSrc
        ) : log.length === 0 ? (
          <div className="py-0.5 text-[8px] tracking-[0.1em] text-ink-3">NO CAPACITY EVENTS · FEED QUIET</div>
        ) : (
          log.map((e) => (
            <div key={e.id} className="flex min-w-0 items-baseline gap-1.5 whitespace-nowrap border-b border-dotted border-ink-3/20 py-px text-[7.5px]">
              <span className="shrink-0 tabular-nums text-ink-3">{e.t.slice(0, 5)}</span>
              <span className={`min-w-0 flex-1 truncate tabular-nums ${e.level === 'err' || e.level === 'alert' ? 'text-alm' : e.level === 'warn' ? 'text-dat' : 'text-ink-2'}`}>
                {e.msg}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Headroom ring */}
      <div className="border-t border-ink-3/20 px-2.5 pt-1.5 pb-1">
        <div className="text-[7.5px] uppercase tracking-[0.18em] text-acc">
          HEADROOM · FREE VRAM<span className="mt-px block text-[6.5px] tracking-[0.16em] text-ink-3">100% − VRAM / POOL</span>
        </div>
        {offline ? (
          noSrc
        ) : (
          <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-2 px-0.5 py-1">
            <Ring pct={hr.pct} />
            <div className="flex flex-col gap-px">
              {hr.rows.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-1 border-b border-dotted border-ink-3/20 py-px text-[7px]">
                  <span className="tracking-[0.1em] text-ink-3">{k}</span>
                  <span className="whitespace-nowrap text-right text-[7.5px] tabular-nums tracking-[0.04em] text-ink-2">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* VRAM pressure strip */}
      <div className="mt-1.5 flex flex-col gap-1 border-t border-dashed border-ink-3/25 pt-1.5 pb-1">
        <div className="px-2.5 text-[7px] uppercase tracking-[0.18em] text-ink-3">VRAM PRESSURE · 47 SAMPLES · POOL</div>
        {offline ? (
          noSrc
        ) : (
          <div className="grid gap-0.5 px-2.5" style={{ gridTemplateColumns: `repeat(${STRIP_COLS}, minmax(0, 1fr))` }}>
            {strip.map((s, i) => (
              <span
                key={i}
                className={`or-arch aspect-square ${
                  s === 'hot'
                    ? 'bg-alm/60 shadow-[0_0_4px_rgb(var(--alm)_/_0.5)]'
                    : s === 'warm'
                      ? 'bg-dat/50'
                      : 'bg-ink-3/25'
                }`}
              />
            ))}
          </div>
        )}
        <div className="px-2.5 text-[7px] uppercase tracking-[0.18em] text-ink-3">HOT ≥ 90% · WARM ≥ 75% OF POOL</div>
      </div>

      <div className="mt-auto border-t border-ink-3/20 px-2.5 py-1.5 text-[7px] tracking-[0.16em] text-ink-3">
        {offline ? (
          <>
            PRESSURE · <span className="text-alm">NO SOURCE</span>
          </>
        ) : (
          <>
            <div>
              PRESSURE · <span className="text-acc">{alert > 0.4 ? 'ALERT' : heat > 0.6 ? 'WATCH' : 'NOMINAL'}</span>
            </div>
            <div className="mt-0.5 truncate tabular-nums text-ink-2" title={liveLine}>
              {liveLine}
            </div>
          </>
        )}
      </div>
    </aside>
  )
}

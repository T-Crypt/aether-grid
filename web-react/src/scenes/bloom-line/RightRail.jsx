// RightRail: the 200 px telemetry strip (hidden below 768 px). The 18-row
// list is the KPI table padded with greenhouse lore rows; rows flash on
// token_generated / kv_slot_changed (conductor events re-key the row so a
// finite CSS animation plays — no scene timer). SHIP manifest = the newest
// queued requests (dest = model, mass = queue share, pseudo-ETA); FLEET 22
// cells from the session pool (armed = anomalous); GERM chips from the model
// list; RING gauge from the gpu proxy; ARCHIVE 47 cells from the host cpu
// heat history. Offline: frames stay, bodies show "no source".

import { useEffect, useState } from 'react'
import { useScene } from '../../scene/SceneRoot'
import { telemRows, shipManifest, germChips, ringStats, archiveCells, pad } from './shared'

const ARCHIVE_COLS = 12

function Ring({ pct }) {
  const R = 26
  const C = 2 * Math.PI * R
  const ticks = Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2 - Math.PI / 2)
  return (
    <svg viewBox="0 0 64 64" className="h-[64px] w-[64px] shrink-0" aria-label={`Readiness ${pct}%`}>
      <circle cx="32" cy="32" r={R} fill="none" stroke="rgb(var(--pan))" strokeWidth="4" opacity="0.85" />
      <circle
        cx="32"
        cy="32"
        r={R}
        fill="none"
        stroke="rgb(var(--col))"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * C} ${C}`}
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
      <text x="32" y="34" textAnchor="middle" dominantBaseline="middle" fill="rgb(var(--col))" fontSize="13" fontFamily="inherit">
        {pct}%
      </text>
    </svg>
  )
}

export default function RightRail() {
  const { snap, conductor } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const heat = Math.min(1, conductor.heat)
  const alert = Math.min(1, conductor.alert)
  const flow = Math.min(1, conductor.flow)

  // Event-driven row flash: re-key one row per conductor event so its finite
  // CSS flash restarts. token_generated lands on the throughput rows,
  // kv_slot_changed on the drone/pressure rows, anomalies on P23.
  const [flash, setFlash] = useState(null)
  useEffect(() => {
    const offTok = conductor.on('token_generated', (ev) => setFlash({ i: ev.seq % 7, seq: ev.seq }))
    const offKv = conductor.on('kv_slot_changed', (ev) => setFlash({ i: 13 + (ev.index % 4), seq: 'kv' + ev.seq }))
    const offAn = conductor.on('anomaly', (ev) => setFlash({ i: 8, seq: 'an' + ev.seq }))
    return () => {
      offTok()
      offKv()
      offAn()
    }
  }, [conductor])

  const rows = offline ? telemRows(null, 0, 0, 0) : telemRows(snap, heat, alert, flow)
  const manifest = shipManifest(snap)
  const germ = germChips(snap)
  const ring = ringStats(snap, heat)
  const archive = archiveCells(snap)
  const sessions = (snap && snap.sessions) || []
  const flaggedIdx = new Set()
  if (!offline) {
    sessions.forEach((s, i) => {
      if (s && s.window && (s.used || 0) / s.window >= 0.85) flaggedIdx.add(i % 22)
    })
  }
  const armedNums = Array.from(flaggedIdx).sort((a, b) => a - b)
  const noSrc = (
    <div className="flex h-full min-h-[24px] items-center justify-center">
      <span className="text-[8px] uppercase tracking-[0.2em] text-ink-3">no source</span>
    </div>
  )

  return (
    <aside
      className="hidden min-w-0 flex-col overflow-hidden border-l border-ink-3/20 bg-gradient-to-l from-bgg/70 to-bgg/40 text-[9px] min-[769px]:flex min-[769px]:w-[200px]"
      aria-label="Right telemetry rail"
    >
      <div className="flex items-baseline justify-between px-2.5 pt-2 pb-1.5">
        <span className="text-[8px] tracking-[0.2em] text-acc">ТЕЛЕМЕТРИЯ · 18 ПОЗ.</span>
        <span className="bl-flash h-1.5 w-1.5 rounded-full bg-acc shadow-[0_0_6px_rgb(var(--acc)_/_0.6)]" aria-hidden="true" />
      </div>

      {/* 18-row telemetry list */}
      <div className="flex-1 overflow-hidden px-1">
        {offline ? (
          noSrc
        ) : (
          rows.map((r, i) => (
            <div
              key={flash && flash.i === i ? `${i}-${flash.seq}` : `row-${i}`}
              className={`bl-trow grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-1.5 border-b border-dotted border-ink-3/20 px-2 py-px ${
                flash && flash.i === i ? 'bl-row-flash' : ''
              }`}
            >
              <span className="truncate text-[7.5px] tracking-[0.06em] text-ink-3">
                <span className="mr-0.5 text-[7px] tracking-[0.08em] text-acc">{r.cyr}</span>
                {r.lat}
              </span>
              <span
                className={`whitespace-nowrap text-right text-[8.5px] tabular-nums ${
                  r.state === 'bloom'
                    ? 'text-alm [text-shadow:0_0_4px_rgb(var(--alm)_/_0.5)]'
                    : r.state === 'warn'
                      ? 'text-dat'
                      : r.state === 'ghost'
                        ? 'text-ink-3'
                        : 'text-ink-2'
                }`}
              >
                {r.val}
              </span>
            </div>
          ))
        )}
      </div>

      {/* SHIP manifest */}
      <div className="border-t border-ink-3/20 px-2.5 pt-1.5 pb-1">
        <div className="text-[7.5px] uppercase tracking-[0.18em] text-acc">
          ОТГРУЗКА · {manifest.length || 4} · NEXT<span className="mt-px block text-[6.5px] tracking-[0.16em] text-ink-3">DELIVERY MANIFEST</span>
        </div>
        {offline || manifest.length === 0 ? (
          noSrc
        ) : (
          manifest.map((m, i) => (
            <div
              key={m.id}
              className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-1.5 border-b border-dotted border-ink-3/20 py-px text-[7.5px] ${
                i === 0 ? 'text-acc' : ''
              }`}
            >
              <span className={`truncate tracking-[0.06em] ${i === 0 ? 'text-acc' : 'text-ink-2'}`}>{m.dest}</span>
              <span className={`whitespace-nowrap text-[7px] tracking-[0.08em] ${i === 0 ? 'bl-eta text-acc' : 'text-ink-3'}`}>{m.eta}</span>
              <span className={`min-w-[44px] whitespace-nowrap text-right tabular-nums ${i === 0 ? 'text-dat' : 'text-dat/80'}`}>{m.kg}</span>
            </div>
          ))
        )}
      </div>

      {/* FLEET */}
      <div className="border-t border-ink-3/20 px-2.5 pt-1.5 pb-1">
        <div className="text-[7.5px] uppercase tracking-[0.18em] text-acc">
          РОЙ · 22 · STATUS<span className="mt-px block text-[6.5px] tracking-[0.16em] text-ink-3">POLLINATOR FLEET</span>
        </div>
        {offline ? (
          noSrc
        ) : (
          <>
            <div className="mt-0.5 grid grid-cols-11 gap-0.5">
              {Array.from({ length: 22 }, (_, i) => (
                <span
                  key={i}
                  title={`BEE-${pad(i + 1)}`}
                  className={`bl-fcell flex aspect-square items-center justify-center border text-[5.5px] tracking-[0.04em] ${
                    flaggedIdx.has(i)
                      ? 'border-dat bg-dat/15 text-dat bl-armed shadow-[0_0_4px_rgb(var(--dat)_/_0.4)]'
                      : 'border-transparent bg-ink-3/20 text-ink-3'
                  }`}
                >
                  {pad(i + 1)}
                </span>
              ))}
            </div>
            <div className="mt-1 text-[7px] tracking-[0.14em] text-ink-3">
              ARMED ·{' '}
              <span className="text-dat">
                {armedNums.length ? armedNums.map((i) => `BEE-${pad(i + 1)}`).join(' / ') : 'NONE'}
              </span>{' '}
              · 09:14
            </div>
          </>
        )}
      </div>

      {/* GERM bank */}
      <div className="border-t border-ink-3/20 px-2.5 pt-1.5 pb-1">
        <div className="text-[7.5px] uppercase tracking-[0.18em] text-acc">
          СЕМБАНК · ОЧЕРЕДЬ<span className="mt-px block text-[6.5px] tracking-[0.16em] text-ink-3">GERMLINE BANK · QUEUE</span>
        </div>
        {offline ? (
          noSrc
        ) : (
          <>
            <div className="mt-0.5 flex flex-wrap gap-0.5">
              {germ.map((g, i) => (
                <span
                  key={g + i}
                  className={`bl-germ inline-flex items-center border px-1 py-px text-[7px] tracking-[0.06em] tabular-nums ${
                    i === 0 ? 'border-alm bg-alm/10 text-alm shadow-[0_0_5px_rgb(var(--alm)_/_0.3)]' : 'border-ink-3/30 bg-bgg/55 text-ink-2'
                  }`}
                >
                  {i === 0 ? <span className="mr-px text-[7px] text-dat">★ </span> : null}
                  {g}
                </span>
              ))}
            </div>
            <div className="mt-1 text-[7px] tracking-[0.14em] text-ink-3">
              PROMOTE → <span className="text-acc">COLONY-SHIP 2218</span>
            </div>
          </>
        )}
      </div>

      {/* RING gauge */}
      <div className="border-t border-ink-3/20 px-2.5 pt-1.5 pb-1">
        <div className="text-[7.5px] uppercase tracking-[0.18em] text-acc">
          ГОТОВНОСТЬ · 2218<span className="mt-px block text-[6.5px] tracking-[0.16em] text-ink-3">COLONY-SHIP READINESS</span>
        </div>
        {offline ? (
          noSrc
        ) : (
          <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-2 px-0.5 py-1">
            <Ring pct={ring.pct} />
            <div className="flex flex-col gap-px">
              {ring.rows.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-1 border-b border-dotted border-ink-3/20 py-px text-[7px]">
                  <span className="tracking-[0.1em] text-ink-3">{k}</span>
                  <span className="whitespace-nowrap text-right text-[7.5px] tabular-nums tracking-[0.04em] text-ink-2">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ARCHIVE heat strip */}
      <div className="mt-1.5 flex flex-col gap-1 border-t border-dashed border-ink-3/25 pt-1.5 pb-1">
        <div className="px-2.5 text-[7px] uppercase tracking-[0.18em] text-ink-3">GERMLINE ARCHIVE · 47 STRAINS · 12 LIVE BAYS</div>
        {offline ? (
          noSrc
        ) : (
          <div className="grid gap-0.5 px-2.5" style={{ gridTemplateColumns: `repeat(${ARCHIVE_COLS}, minmax(0, 1fr))` }}>
            {archive.map((s, i) => (
              <span
                key={i}
                className={`bl-arch aspect-square ${
                  s === 'hot'
                    ? 'bg-col/60 shadow-[0_0_4px_rgb(var(--col)_/_0.5)]'
                    : s === 'warm'
                      ? 'bg-alm/50'
                      : s === 'dim'
                        ? 'bg-ink-3/25'
                        : 'bg-acc/40'
                }`}
              />
            ))}
          </div>
        )}
        <div className="px-2.5 text-[7px] uppercase tracking-[0.18em] text-ink-3">38 / 47 LIVE · 6 IN ROTATION · 3 RESERVE</div>
      </div>

      <div className="mt-auto border-t border-ink-3/20 px-2.5 py-1.5 text-[7px] tracking-[0.16em] text-ink-3">
        {offline ? (
          <>
            ANALYSING · <span className="text-alm">NO SOURCE</span>
          </>
        ) : (
          <>
            ANALYSING · <span className="text-acc">{alert > 0.4 ? 'ANOMALY' : heat > 0.6 ? 'PRESSURE' : 'NOMINAL'}</span>
          </>
        )}
      </div>
    </aside>
  )
}

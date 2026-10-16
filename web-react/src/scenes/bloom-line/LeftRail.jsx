// LeftRail: the 156 px instrument strip (hidden below 768 px per the mobile
// strategy). TANKS 12 zones bind to per-engine KV fill; DRONE DOCK 28 cells
// to the session pool (flagged = anomalous sessions); ENV/ATMOS/ROT rows are
// host/gpu proxies (the card flags them "best-fit, no 1:1 data"); STRAINS
// binds to the model list. Offline: the frames stay, bodies show "no source".
// The stack runs taller than an 800 px viewport, so the strip scrolls rather
// than dropping its footer row off the bottom edge.

import { useScene } from '../../scene/SceneRoot'
import { tankZones, droneCells, envRows, germChips, det, hashCode } from './shared'

function Head({ cyr, lat }) {
  return (
    <div className="px-2.5 pt-2 pb-1.5">
      <span className="block text-[8px] tracking-[0.18em] text-acc">{cyr}</span>
      <span className="mt-px block text-[7px] tracking-[0.2em] text-ink-3">{lat}</span>
    </div>
  )
}

function NoSource() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <span className="text-[8px] uppercase tracking-[0.2em] text-ink-3">no source</span>
    </div>
  )
}

export default function LeftRail() {
  const { snap } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const zones = offline ? [] : tankZones(snap)
  const drones = offline ? [] : droneCells(snap)
  const env = offline ? null : envRows(snap)
  const strains = germChips(snap).slice(0, 3)
  const flagged = offline ? 0 : drones.filter((d) => d.flagged).length

  return (
    <aside
      className="scrollbar-thin-x hidden min-w-0 flex-col overflow-x-hidden overflow-y-auto border-r border-ink-3/20 bg-gradient-to-r from-bgg/70 to-bgg/40 text-[9px] min-[769px]:flex min-[769px]:w-[156px]"
      aria-label="Left instrument rail"
    >
      {/* TANKS */}
      <Head cyr="ТАНКИ · 12 ЗОН" lat="BIOREACTOR TANKS" />
      {offline ? (
        <NoSource />
      ) : (
        <div className="grid grid-cols-2 gap-x-1.5 gap-y-1 px-2.5">
          {zones.map((z) => (
            <div
              key={z.id}
              className={`flex flex-col gap-0.5 p-0.5 ${z.state === 'bloom' ? 'border border-alm/60 bg-alm/10' : ''}`}
              title={`${z.id} ${z.code}`}
            >
              <div className="flex justify-between text-[7px] tracking-[0.1em] text-ink-3">
                <span className="text-ink-2">{z.id}</span>
                <span>{z.code}</span>
              </div>
              <div className="relative h-[22px] w-full overflow-hidden border border-ink-3/25 bg-bgg/75">
                <div
                  className={`absolute inset-x-0 bottom-0 ${z.state === 'bloom' ? 'bl-fill-bl' : 'bl-fill'}`}
                  style={{ height: `${Math.round(z.fill * z.wobble * 100)}%` }}
                />
              </div>
              <div className={`text-right text-[7.5px] tabular-nums ${z.state === 'bloom' ? 'text-alm' : 'text-dat'}`}>
                {Math.round(z.fill * z.wobble * 100)}%
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DRONE DOCK */}
      <div className="mt-1.5 border-t border-ink-3/20 px-2.5 pt-1.5 pb-2">
        <div className="mb-1 text-[7.5px] tracking-[0.18em] text-acc">РОЙ · 28 / 28 ДОК</div>
        {offline ? (
          <NoSource />
        ) : (
          <div className="grid grid-cols-7 gap-0.5">
            {drones.map((d) => (
              <span
                key={d.id}
                title={`${d.id} · ${d.name}`}
                className={`aspect-square w-full ${
                  d.flagged
                    ? 'border border-dat bg-dat bl-flag'
                    : d.up
                      ? 'bg-acc/55'
                      : 'bg-ink-3/25'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ENV */}
      <div className="border-t border-ink-3/20 px-2.5 pt-1.5 pb-1">
        <div className="mb-1 text-[7.5px] uppercase tracking-[0.18em] text-acc">
          СРЕДА · ENV<span className="mt-px block text-[6.5px] tracking-[0.16em] text-ink-3">GREENHOUSE READOUTS</span>
        </div>
        {offline ? (
          <NoSource />
        ) : (
          env.env.map(([k, lat, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-1 border-b border-dotted border-ink-3/20 py-px">
              <span className="truncate text-[7.5px] tracking-[0.06em] text-ink-3">
                <span className="mr-0.5 text-[7px] tracking-[0.1em] text-acc">{k}</span>
                {lat}
              </span>
              <span className="whitespace-nowrap text-[8px] tabular-nums text-ink-2">{v}</span>
            </div>
          ))
        )}
      </div>

      {/* ATMOS */}
      <div className="border-t border-ink-3/20 px-2.5 pt-1.5 pb-1">
        <div className="mb-1 text-[7.5px] uppercase tracking-[0.18em] text-acc">
          АТМ. СОСТАВ · ML/L<span className="mt-px block text-[6.5px] tracking-[0.16em] text-ink-3">ATM COMPOSITION</span>
        </div>
        {offline ? (
          <NoSource />
        ) : (
          env.atm.map(([k, w, v, warn]) => (
            <div key={k} className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-1.5 border-b border-dotted border-ink-3/20 py-px">
              <span className={`text-[7px] tracking-[0.06em] ${warn ? 'text-dat' : 'text-acc'}`}>{k}</span>
              <span className="relative h-[5px] overflow-hidden border border-ink-3/25 bg-bgg/65">
                <span className={`absolute inset-y-0 left-0 ${warn ? 'bl-fill-warn' : 'bl-fill-atm'}`} style={{ width: `${w * 100}%` }} />
              </span>
              <span className={`whitespace-nowrap text-right text-[7.5px] tabular-nums ${warn ? 'text-dat' : 'text-ink-2'}`}>{v}</span>
            </div>
          ))
        )}
      </div>

      {/* ROTATION / WATER */}
      <div className="border-t border-ink-3/20 px-2.5 pt-1.5 pb-1">
        <div className="mb-1 text-[7.5px] uppercase tracking-[0.18em] text-acc">
          ВРАЩ. · ВОДА<span className="mt-px block text-[6.5px] tracking-[0.16em] text-ink-3">ROTATION · WATER LOOP</span>
        </div>
        {offline ? (
          <NoSource />
        ) : (
          env.rot.map(([k, lat, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-1 border-b border-dotted border-ink-3/20 py-px">
              <span className="truncate text-[7.5px] tracking-[0.06em] text-ink-3">
                <span className="mr-0.5 text-[7px] tracking-[0.1em] text-acc">{k}</span>
                {lat}
              </span>
              <span className="whitespace-nowrap text-[8px] tabular-nums text-ink-2">{v}</span>
            </div>
          ))
        )}
      </div>

      {/* STRAINS */}
      <div className="border-t border-ink-3/20 px-2.5 pt-1.5 pb-1">
        <div className="mb-1 text-[7.5px] uppercase tracking-[0.18em] text-acc">
          СОРТА · TOP 5<span className="mt-px block text-[6.5px] tracking-[0.16em] text-ink-3">STRAIN BANK · KG / CYC</span>
        </div>
        {offline ? (
          <NoSource />
        ) : (
          strains.map((s, i) => (
            <div key={s + i} className={`flex items-baseline justify-between gap-1 border-b border-dotted border-ink-3/20 py-px text-[7.5px] ${i === 2 ? 'text-alm' : ''}`}>
              <span className="truncate tracking-[0.06em] text-ink-2">
                {i === 2 ? <span className="mr-0.5 text-[7px] text-dat">★ </span> : null}
                {s}
              </span>
              <span className="whitespace-nowrap tabular-nums text-dat">{(10 + det(hashCode(s + i)) * 35).toFixed(1)} kg</span>
            </div>
          ))
        )}
      </div>

      <div className="mt-auto border-t border-ink-3/20 px-2.5 py-1.5 text-[7px] tracking-[0.16em] text-ink-3">
        ЗАВТ. · <span className="text-dat">{offline ? 'NO DATA' : flagged ? `${flagged} → P23` : '0 → P23'}</span> · 09:14 UTC
      </div>
    </aside>
  )
}

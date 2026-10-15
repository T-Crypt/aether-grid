// EdgeBars: the top and bottom chrome strips. Desktop: fixed 30 px / 36 px
// bars across the top and bottom of the root. Mobile: the same strips wrap
// into flowing rows (the reference's mobile strategy).
//
// Bound to telemetry: UTC clock marches at feed rate (tick, no scene timer),
// grow-day advances per feed tick cadence, the bottom pills follow the
// conductor's heat/alert/flow scalars and the drone-flag count, INT. TEMP
// follows gpu. Everything else is facility lore (flagged decorative).

import { useScene } from '../../scene/SceneRoot'
import { fmtClock, growDay, staleOf, activeOf } from './shared'

export function EdgeTop() {
  const { snap, tick, conductor } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const heat = Math.min(1, conductor.heat)
  const stale = staleOf(snap)
  const act = activeOf(snap)
  const hero = stale || offline
    ? `HELD · ${act.model || 'NO MODEL'} · DRIFT`
    : `FLOWERED · ${act.model || 'NO MODEL'} · ${act.tps != null ? `${Math.round(act.tps)} TOK/S` : '— TOK/S'} · ENG ${act.engine || '—'} · ${act.temp != null ? `${Math.round(act.temp)}°C` : '—'} · MTP ${act.mtp != null ? `${Math.round(act.mtp)}%` : '—'} · THINK ${act.think != null ? Math.round(act.think) : '—'}`
  return (
    <header
      className="z-20 flex flex-wrap items-center gap-x-4 gap-y-1 bg-bgg/85 px-4 py-1 text-[9px] tracking-[0.16em] text-ink-1 min-[769px]:h-[30px] min-[769px]:shrink-0 min-[769px]:flex-nowrap min-[769px]:overflow-hidden min-[769px]:backdrop-blur-sm"
      aria-label="Facility identity bar"
    >
      <span className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="text-[7.5px] tracking-[0.2em] text-ink-3">MODULE</span>
        <span className="tabular-nums tracking-[0.06em]">BLOOM-LINE</span>
      </span>
      <span className="hidden items-baseline gap-1.5 whitespace-nowrap sm:flex">
        <span className="text-[7.5px] tracking-[0.2em] text-ink-3">CALL</span>
        <span className="tabular-nums tracking-[0.06em]">BL-180</span>
      </span>
      <span className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="text-[7.5px] tracking-[0.2em] text-ink-3">OWNER</span>
        <span className="bl-foundation tracking-[0.18em] text-acc">FOUND. XENO-HERIT.</span>
      </span>
      <span className="hidden items-baseline gap-1.5 whitespace-nowrap lg:flex">
        <span className="text-[7.5px] tracking-[0.2em] text-ink-3">OPER.</span>
        <span className="tabular-nums tracking-[0.06em]">YUMI ADEYEMI-PARK</span>
      </span>
      <span className="hidden min-w-0 shrink truncate whitespace-nowrap sm:block" title={hero} aria-label="Active runtime hero">
        <span className="text-[7.5px] tracking-[0.2em] text-ink-3">{stale || offline ? 'HELD' : 'FLOWERED'}</span>{' '}
        <span
          className={`tabular-nums tracking-[0.06em] ${
            stale || offline ? 'text-ink-2' : 'text-dat [text-shadow:0_0_4px_rgb(var(--dat)_/_0.4)]'
          }`}
        >
          {hero.replace(/^(FLOWERED|HELD) · /, '')}
        </span>
      </span>
      <span className="min-w-0 flex-1" />
      <span className="flex items-baseline gap-1 whitespace-nowrap">
        <span className="text-[7.5px] tracking-[0.18em] text-ink-3">UTC</span>
        <span
          className="text-[11px] tabular-nums tracking-[0.06em] text-dat [text-shadow:0_0_4px_rgb(var(--dat)_/_0.4)]"
          aria-label="UTC clock"
        >
          {offline ? '--:--:--' : fmtClock(tick, 22 * 3600 + 10 * 60 + 1)}
        </span>
      </span>
      <span className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="text-[7.5px] tracking-[0.2em] text-ink-3">GROW-DAY</span>
        <span
          className={`border px-1.5 py-px text-[8px] tabular-nums tracking-[0.1em] ${
            offline ? 'border-ink-3/40 text-ink-3' : 'border-col text-col'
          }`}
        >
          {offline ? '— / 240' : `${growDay(snap)} / 240`}
        </span>
      </span>
      <span className="sr-only">scene heat {Math.round(heat * 100)}%</span>
    </header>
  )
}

export function EdgeBot() {
  const { snap, conductor } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const heat = Math.min(1, conductor.heat)
  const alert = Math.min(1, conductor.alert)
  const sessions = (snap && snap.sessions) || []
  const flagged = offline ? 0 : sessions.filter((s) => s.window && (s.used || 0) / s.window >= 0.85).length
  const temp = offline ? null : 20 + heat * 6
  const pills = [
    ['IRRIGATION', offline ? 'NO DATA' : 'NORMAL', offline ? 'off' : 'ok'],
    ['MIRROR', offline ? 'NO DATA' : heat > 0.6 ? 'ADJUST' : 'TRACKING', offline ? 'off' : heat > 0.6 ? 'dat' : 'ok'],
    ['DRONES', offline ? 'NO DATA' : flagged ? `${flagged} → P23` : 'DOCKED', offline ? 'off' : flagged ? 'dat' : 'ok'],
    ['ATMOS.', offline ? 'NO DATA' : heat > 0.55 ? 'BOOST' : 'NOMINAL', offline ? 'off' : heat > 0.55 ? 'dat' : 'ok'],
    ['P23', offline ? 'NO DATA' : alert > 0.25 ? 'BLOOM ★' : 'NOMINAL', offline ? 'off' : alert > 0.25 ? 'alm' : 'ok'],
  ]
  return (
    <footer
      className="z-20 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink-3/20 bg-bgg/90 px-4 py-1 text-[9px] tracking-[0.14em] text-ink-1 min-[769px]:h-[36px] min-[769px]:shrink-0 min-[769px]:flex-nowrap min-[769px]:overflow-hidden min-[769px]:backdrop-blur-sm"
      aria-label="System status bar"
    >
      {pills.map(([lbl, val, st]) => (
        <span key={lbl} className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-[7.5px] tracking-[0.18em] text-ink-3">{lbl}</span>
          <span
            className={`border px-1.5 py-px text-[7.5px] tracking-[0.2em] ${
              st === 'alm'
                ? 'border-alm bg-alm text-bgg'
                : st === 'dat'
                  ? 'border-dat text-dat'
                  : st === 'off'
                    ? 'border-ink-3/40 text-ink-3'
                    : 'border-acc text-acc'
            }`}
          >
            {val}
          </span>
        </span>
      ))}
      <span className="hidden h-4 w-px bg-ink-3/30 sm:block" aria-hidden="true" />
      <span className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="text-[7.5px] tracking-[0.18em] text-ink-3">INT. TEMP</span>
        <span className="text-[13px] tabular-nums text-dat [text-shadow:0_0_6px_rgb(var(--dat)_/_0.4)]">
          {temp == null ? '---.-°C' : `${temp.toFixed(1)}°C`}
        </span>
        <span className="text-[9px] tabular-nums text-acc">{offline ? '+0.0°/h' : `${heat >= 0.5 ? '+' : '−'}0.0°/h`}</span>
      </span>
      <span className="min-w-0 flex-1" />
      <span className="whitespace-nowrap text-[8px] tracking-[0.16em] text-ink-3">
        OPERATOR <span className="text-[9px] tracking-[0.1em] text-ink-2">ADEYEMI-PARK · 3y4m</span>
      </span>
      <span className="hidden whitespace-nowrap text-[8px] tracking-[0.16em] text-ink-3 lg:inline">
        L2↔EARTH <span className={offline ? 'text-alm' : 'text-acc'}>{offline ? 'NO LINK' : 'LAGOS RELAY'}</span>
      </span>
    </footer>
  )
}

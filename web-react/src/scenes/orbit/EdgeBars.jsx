// EdgeBars: the top and bottom chrome strips. Desktop: fixed 30 px / 36 px
// bars across the top and bottom of the root. Mobile: the same strips wrap
// into flowing rows.
//
// Bound to telemetry: the UTC clock marches at feed rate (tick, no scene
// timer), the VRAM pill follows gpu.vram/vramTotal, the bottom pills follow
// the conductor scalars, the well-state flag count and the queue; INT. TEMP
// is the gpu die temp. Everything else is runtime meta (model, engine, feed).

import { useScene } from '../../scene/SceneRoot'
import { clockOf, staleOf, activeOf, vramStats } from './shared'

export function EdgeTop() {
  const { snap, tick, conductor } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const stale = staleOf(snap)
  const heat = Math.min(1, conductor.heat)
  const act = activeOf(snap)
  const vr = vramStats(snap)
  const hero = stale || offline
    ? `HELD · ${act.model || 'NO MODEL'} · DRIFT`
    : `ORBITING · ${act.model || 'NO MODEL'} · ${act.tps != null ? `${Math.round(act.tps)} TOK/S` : '— TOK/S'} · ENG ${act.engine || '—'} · ${act.temp != null ? `${Math.round(act.temp)}°C` : '—'} · MTP ${act.mtp != null ? `${Math.round(act.mtp)}%` : '—'} · THINK ${act.think != null ? Math.round(act.think) : '—'}`
  return (
    <header
      className="z-20 flex flex-wrap items-center gap-x-4 gap-y-1 bg-bgg/85 px-4 py-1 text-[9px] tracking-[0.16em] text-ink-1 min-[769px]:h-[30px] min-[769px]:shrink-0 min-[769px]:flex-nowrap min-[769px]:overflow-hidden min-[769px]:backdrop-blur-sm"
      aria-label="Runtime identity bar"
    >
      <span className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="text-[7.5px] tracking-[0.2em] text-ink-3">SCENE</span>
        <span className="tabular-nums tracking-[0.06em]">CONTEXT ORBIT</span>
      </span>
      <span className="hidden items-baseline gap-1.5 whitespace-nowrap sm:flex">
        <span className="text-[7.5px] tracking-[0.2em] text-ink-3">ENGINE</span>
        <span className="tabular-nums tracking-[0.06em]">{act.engine || '—'}</span>
      </span>
      <span className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="text-[7.5px] tracking-[0.2em] text-ink-3">MODEL</span>
        <span className="or-live tracking-[0.18em] text-acc">{(act.model || 'NO MODEL').toUpperCase()}</span>
      </span>
      <span className="hidden items-baseline gap-1.5 whitespace-nowrap lg:flex">
        <span className="text-[7.5px] tracking-[0.2em] text-ink-3">FEED</span>
        <span className="tabular-nums tracking-[0.06em]">{offline ? 'NO LINK' : (snap && snap.feed) || 'SSE'}</span>
      </span>
      <span className="hidden min-w-0 shrink truncate whitespace-nowrap sm:block" title={hero} aria-label="Active runtime hero">
        <span className="text-[7.5px] tracking-[0.2em] text-ink-3">{stale || offline ? 'HELD' : 'ORBITING'}</span>{' '}
        <span
          className={`tabular-nums tracking-[0.06em] ${
            stale || offline ? 'text-ink-2' : 'text-dat [text-shadow:0_0_4px_rgb(var(--dat)_/_0.4)]'
          }`}
        >
          {hero.replace(/^(ORBITING|HELD) · /, '')}
        </span>
      </span>
      <span className="min-w-0 flex-1" />
      <span className="flex items-baseline gap-1 whitespace-nowrap">
        <span className="text-[7.5px] tracking-[0.18em] text-ink-3">UTC</span>
        <span
          className="text-[11px] tabular-nums tracking-[0.06em] text-dat [text-shadow:0_0_4px_rgb(var(--dat)_/_0.4)]"
          aria-label="UTC clock"
        >
          {offline ? '--:--:--' : clockOf(tick, 14 * 3600 + 20 * 60 + 5)}
        </span>
      </span>
      <span className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="text-[7.5px] tracking-[0.2em] text-ink-3">VRAM</span>
        <span
          className={`border px-1.5 py-px text-[8px] tabular-nums tracking-[0.1em] ${
            vr.pct != null && vr.pct >= 0.9
              ? 'border-alm text-alm'
              : vr.pct != null && vr.pct >= 0.75
                ? 'border-dat text-dat'
                : 'border-col text-col'
          }`}
        >
          {vr.pct != null ? `${Math.round(vr.pct * 100)}% POOL` : '— POOL'}
        </span>
      </span>
      <span className="sr-only">scene heat {Math.round(heat * 100)}%</span>
    </header>
  )
}

export function EdgeBot() {
  const { snap } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const k = (snap && snap.kpi) || {}
  const vr = vramStats(snap)
  const sessions = (snap && snap.sessions) || []
  const flagged = offline ? 0 : sessions.filter((s) => s.window && (s.used || 0) / s.window >= 0.85).length
  const engines = (snap && snap.engines) || []
  const upEng = engines.filter((e) => e && e.up).length
  const alerts = (snap && snap.alerts) || []
  const pct = vr.pct != null ? Math.round(vr.pct * 100) : null
  const temp = offline ? null : snap && snap.gpu && snap.gpu.temp
  const pills = [
    ['VRAM', offline || pct == null ? 'NO DATA' : pct >= 90 ? 'CRIT' : pct >= 75 ? 'PRESSURE' : 'NOMINAL', offline || pct == null ? 'off' : pct >= 90 ? 'alm' : pct >= 75 ? 'dat' : 'ok'],
    ['KV POOL', offline ? 'NO DATA' : k.cache != null && k.cache < 40 ? 'LOW' : `${Math.round(k.cache)}%`, offline ? 'off' : k.cache != null && k.cache < 40 ? 'dat' : 'ok'],
    ['SLOTS', offline ? 'NO DATA' : flagged ? `${flagged} RISK` : 'STABLE', offline ? 'off' : flagged ? 'dat' : 'ok'],
    ['QUEUE', offline ? 'NO DATA' : k.queue != null && k.queue > 8 ? 'DEEP' : k.queue != null ? 'CLEAR' : '—', offline ? 'off' : k.queue != null && k.queue > 8 ? 'dat' : 'ok'],
    ['ALERT', offline ? 'NO DATA' : alerts.length ? `${alerts.length} ACTIVE` : 'NONE', offline ? 'off' : alerts.length ? 'alm' : 'ok'],
  ]
  return (
    <footer
      className="z-20 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink-3/20 bg-bgg/90 px-4 py-1 text-[9px] tracking-[0.14em] text-ink-1 min-[769px]:h-[36px] min-[769px]:shrink-0 min-[769px]:flex-nowrap min-[769px]:overflow-hidden min-[769px]:backdrop-blur-sm"
      aria-label="Pressure status bar"
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
        <span className="text-[7.5px] tracking-[0.18em] text-ink-3">GPU TEMP</span>
        <span className="text-[13px] tabular-nums text-dat [text-shadow:0_0_6px_rgb(var(--dat)_/_0.4)]">
          {temp == null ? '--°C' : `${Math.round(temp)}°C`}
        </span>
        <span className="text-[9px] tabular-nums text-acc">{temp != null && temp >= 70 ? 'THERM WATCH' : 'THERM NOM'}</span>
      </span>
      <span className="min-w-0 flex-1" />
      <span className="whitespace-nowrap text-[8px] tracking-[0.16em] text-ink-3">
        ENGINES <span className="text-[9px] tracking-[0.1em] text-ink-2">{offline ? '— / —' : `${upEng}/${engines.length}`}</span>
      </span>
      <span className="hidden whitespace-nowrap text-[8px] tracking-[0.16em] text-ink-3 lg:inline">
        FEED <span className={offline ? 'text-alm' : 'text-acc'}>{offline ? 'NO LINK' : 'SSE · 1.0S'}</span>
      </span>
    </footer>
  )
}

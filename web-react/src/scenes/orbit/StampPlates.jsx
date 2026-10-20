// StampPlates: the floating engineering plates over the stage. Desktop:
// absolutely positioned inside the root over the stage. Mobile: the same
// plates stack as full-width cards below the hero; the plate trims at
// 480 px. Every value is a snapshot key (vramStats, kpi, sessions, host,
// snap.phase, snap.mode); nothing here carries a fictional identity.

import { useScene } from '../../scene/SceneRoot'
import { vramStats, grp, uptimeOf } from './shared'

function plateBase() {
  // z above the stage row (z-10) so a plate stays hit-testable, below the
  // vignette (z-60) so the edge shading still falls over it.
  return 'z-[20] border border-ink-3/25 bg-bgg/95 shadow-[0_4px_14px_rgb(0_0_0_/_0.4),inset_0_1px_0_rgb(var(--acc)_/_0.08)]'
}

export function StampTitle() {
  const { snap } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const vr = vramStats(snap)
  return (
    <div
      className={`${plateBase()} px-3 py-2 min-[769px]:absolute min-[769px]:left-[172px] min-[769px]:top-[56px] min-[769px]:max-w-[360px]`}
      aria-label="Runtime title block"
    >
      <span className="block text-[8.5px] tracking-[0.3em] text-acc">AETHER GRID · LOCAL LLM RUNTIME</span>
      <span className="mt-0.5 block text-[13px] tracking-[0.28em] text-ink-1 [text-shadow:0_0_6px_rgb(var(--acc)_/_0.35)] min-[769px]:text-[17px]">
        CONTEXT ORBIT · KV SYSTEM
      </span>
      <span className="mt-1 block text-[8px] tracking-[0.18em] text-ink-3">
        {vr.total != null ? `${vr.total.toFixed(0)} GB POOL` : '— POOL'} · {offline ? 'FEED HELD' : `FEED ${(snap && snap.feed) || 'SSE'} · 1.0S`}
      </span>
    </div>
  )
}

export function StampPlate() {
  const { snap } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const engines = (snap && snap.engines) || []
  const events = (snap && snap.events) || []
  const alerts = (snap && snap.alerts) || []
  const rows = [
    ['MODE', offline ? 'HELD' : ((snap && snap.mode) || '—').toUpperCase()],
    ['FEED', offline ? 'NO LINK' : ((snap && snap.feed) || '—').toUpperCase()],
    ['UPTIME', offline ? '—' : uptimeOf(snap)],
    ['ENGINES', `${engines.filter((e) => e && e.up).length}/${engines.length} UP`],
    ['EVENTS', grp(events.length)],
    ['ALERTS', alerts.length ? grp(alerts.length) : 'NONE'],
    ['PHASE', ((snap && snap.phase) || '—').toUpperCase()],
  ]
  return (
    <div
      className={`${plateBase()} px-2.5 py-1.5 text-right max-[480px]:hidden min-[769px]:absolute min-[769px]:right-[216px] min-[769px]:top-[174px] min-[769px]:max-w-[240px]`}
      aria-label="Feed plate"
    >
      {rows.map(([k, v]) => (
        <span key={k} className="block text-[8px] leading-[1.5] tracking-[0.16em]">
          <span className="mr-1.5 text-ink-3">{k}</span>
          <span className="text-ink-2">{v}</span>
        </span>
      ))}
    </div>
  )
}

export function StampData() {
  const { snap } = useScene()
  const k = (snap && snap.kpi) || {}
  const sessions = (snap && snap.sessions) || []
  const flagged = sessions.filter((s) => s.window && (s.used || 0) / s.window >= 0.85).length
  const vr = vramStats(snap)
  const cells = [
    ['VRAM', vr.gb != null ? `${vr.gb.toFixed(1)} / ${vr.total != null ? vr.total.toFixed(0) : '—'} GB` : '—'],
    ['KV POOL', k.cache != null ? `${Math.round(k.cache)}%` : '—'],
    ['SLOTS', grp(sessions.length)],
    ['AT RISK', flagged ? grp(flagged) : '0'],
    ['TOK/S', k.tps != null ? grp(k.tps) : '—'],
    ['QUEUE', k.queue != null ? grp(k.queue) : '—'],
    ['REINGEST', k.reingest != null ? `${Math.round(k.reingest)}%` : '—'],
    ['MTP', k.mtp != null ? `${k.mtp.toFixed(1)}%` : '—'],
  ]
  return (
    <div
      className={`${plateBase()} px-3 py-2 min-[769px]:absolute min-[769px]:bottom-[250px] min-[769px]:left-[172px] min-[769px]:w-[360px]`}
      aria-label="Capacity data plate"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[8.5px] min-[769px]:text-[8.5px]">
        {cells.map(([key, v]) => (
          <span key={key} className="contents">
            <span className="text-[7.5px] uppercase tracking-[0.14em] whitespace-nowrap text-ink-3">{key}</span>
            <span className="truncate tabular-nums tracking-[0.04em] text-ink-2" title={v}>{v}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// StampPlates: the floating engineering plates over the stage (the
// reference's corner stamps). Desktop: absolutely positioned inside the
// root over the stage. Mobile: the same plates stack as full-width cards
// below the hero (reference mobile strategy); the plate trims at 480 px.
// OPER/AGE bind to host.uptime where the collector reports it; the rest is
// the reference's facility lore (flagged decorative in the report).

import { useScene } from '../../scene/SceneRoot'

function plateBase() {
  return 'border border-ink-3/25 bg-bgg/95 shadow-[0_4px_14px_rgb(0_0_0_/_0.4),inset_0_1px_0_rgb(var(--acc)_/_0.08)]'
}

export function StampTitle() {
  return (
    <div
      className={`${plateBase()} z-[7] px-3 py-2 min-[769px]:absolute min-[769px]:left-[172px] min-[769px]:top-[56px] min-[769px]:max-w-[360px]`}
      aria-label="Facility title block"
    >
      <span className="block text-[8.5px] tracking-[0.3em] text-acc">BLOOM-LINE · L2 · 14m × 6m</span>
      <span className="mt-0.5 block text-[13px] tracking-[0.28em] text-ink-1 [text-shadow:0_0_6px_rgb(var(--acc)_/_0.35)] min-[769px]:text-[17px]">
        ORBITAL GREENHOUSE · 47 SP.
      </span>
      <span className="mt-1 block text-[8px] tracking-[0.18em] text-ink-3">HK-BIO-180-2178 · FOUND. XENO-HERIT. since 2186</span>
    </div>
  )
}

export function StampPlate() {
  const { snap } = useScene()
  const host = (snap && snap.host) || null
  const up = host && host.uptime != null ? Math.floor(host.uptime / 3600) : null
  const rot = up != null ? `ROT ${Math.floor(up / 8760)}y${Math.floor(((up % 8760) / 730) * 12)}m` : 'ROT 3y4m'
  const rows = [
    ['OPER.', 'YUMI ADEYEMI-PARK'],
    ['AGE', `35 · ${rot}`],
    ['PARTNER', 'MAYA · LAGOS'],
    ['PET', 'MOCHI (with Maya)'],
    ['NEXT ROT END', '2210-10-14'],
  ]
  return (
    <div
      className={`${plateBase()} px-2.5 py-1.5 text-right max-[480px]:hidden min-[769px]:absolute min-[769px]:right-[216px] min-[769px]:top-[174px] min-[769px]:max-w-[240px]`}
      aria-label="Operator plate"
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
  const { snap, conductor } = useScene()
  const k = (snap && snap.kpi) || {}
  const engines = (snap && snap.engines) || []
  const sessions = (snap && snap.sessions) || []
  const upEng = engines.filter((e) => e && e.up).length
  const heat = Math.min(1, conductor.heat)
  const cells = [
    ['AREA', '240 m²'],
    ['ROT', '1.6 RPM · 0.40 g'],
    ['SPECIES', `${upEng}/${engines.length || 47} NOM.`],
    ['DRONES', `${Math.min(28, sessions.length || 0)} / 28 DOC.`],
    ['CYCLE', `DAY ${snap ? `${187 + Math.floor((snap.t || 0) / 90)} / 240` : '— / 240'}`],
    ['NEXT SHIP', `4d · ${((k.queue || 0) * 0.32).toFixed(1)} kg`],
    ['YIELD/MO', `~${Math.round(120 + heat * 40)} kg`],
    ['P23 BLOOM', '★ TASHKENT YEL.'],
  ]
  return (
    <div
      className={`${plateBase()} px-3 py-2 min-[769px]:absolute min-[769px]:bottom-[198px] min-[769px]:left-[172px] min-[769px]:max-w-[360px]`}
      aria-label="Data plate"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[8.5px] min-[769px]:text-[8.5px]">
        {cells.map(([k, v]) => (
          <span key={k} className="contents">
            <span className="text-[7.5px] uppercase tracking-[0.14em] text-ink-3">{k}</span>
            <span className="tabular-nums tracking-[0.04em] text-ink-2">{v}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

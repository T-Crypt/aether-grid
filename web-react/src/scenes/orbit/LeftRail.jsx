// LeftRail: the 156 px memory strip (hidden below 768 px per the mobile
// strategy). VRAM and host RAM bars bind to gpu.vram/vramTotal and
// host.ramUsed/ramTotal; the GPU block prints die temp, board draw and
// compute util with their absolute thresholds; the mini plot is the VRAM
// pressure history (kpiHist.vram); the KV slot grid binds to the session
// pool (flagged = past the 85% evict line). Offline: the frames stay,
// bodies show "no source". The stack scrolls rather than dropping its
// footer row off the bottom edge.

import SceneCanvas from '../../scene/Canvas'
import { useScene } from '../../scene/SceneRoot'
import { tempState } from '../../lib/format'
import { paintVramHist } from './painters'
import { memOf, podsOf, POD_COUNT, grp, uptimeOf } from './shared'

function Head({ key1, key2 }) {
  return (
    <div className="px-2.5 pt-2 pb-1.5">
      <span className="block text-[8px] tracking-[0.18em] text-acc">{key1}</span>
      <span className="mt-px block text-[7px] tracking-[0.2em] text-ink-3">{key2}</span>
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

function MemBar({ label, sub, m }) {
  const pct = m.pct != null ? Math.round(m.pct * 100) : null
  const hot = pct != null && pct >= 90
  const warm = pct != null && pct >= 75
  return (
    <div className="px-2.5 pb-1">
      <div className="flex items-baseline justify-between gap-1 text-[7.5px] tracking-[0.1em]">
        <span className="text-ink-2">{label}</span>
        <span className="tabular-nums text-ink-3">{sub}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <div className="relative h-[9px] min-w-0 flex-1 overflow-hidden border border-ink-3/25 bg-bgg/75">
          <div
            className={`absolute inset-y-0 left-0 ${hot ? 'or-fill-risk' : warm ? 'or-fill-warn' : 'or-fill'}`}
            style={{ width: `${pct != null ? pct : 0}%` }}
          />
          {/* the 75% pressure line */}
          <div className="absolute inset-y-0 left-[75%] w-px bg-dat/60" aria-hidden="true" />
        </div>
        <span className={`w-[38px] shrink-0 text-right text-[8px] tabular-nums ${hot ? 'text-alm' : warm ? 'text-dat' : 'text-ink-2'}`}>
          {pct != null ? `${pct}%` : '—'}
        </span>
      </div>
    </div>
  )
}

export default function LeftRail() {
  const { snap } = useScene()
  const offline = !snap || snap.mode === 'offline'
  const m = offline ? null : memOf(snap)
  const pods = offline ? [] : podsOf(snap)
  const flagged = pods.filter((p) => p.fill >= 0.85).length
  const v = m ? m.vram : null
  const r = m ? m.ram : null
  const gpuName = v ? v.name : null

  return (
    <aside
      className="scrollbar-thin-x hidden min-w-0 flex-col overflow-x-hidden overflow-y-auto border-r border-ink-3/20 bg-gradient-to-r from-bgg/70 to-bgg/40 text-[9px] min-[769px]:flex min-[769px]:w-[156px]"
      aria-label="Memory rail"
    >
      {/* VRAM / HOST RAM */}
      <Head key1="MEMORY · GPU / HOST" key2="VRAM AND HOST RAM" />
      {offline || !m ? (
        <NoSource />
      ) : (
        <div className="flex flex-col gap-0.5 pb-1">
          <MemBar label="GPU VRAM" sub={v.used != null ? `${v.used.toFixed(1)} / ${v.total != null ? v.total.toFixed(0) : '—'} GB` : '—'} m={v} />
          <MemBar label="HOST RAM" sub={r.used != null ? `${r.used.toFixed(1)} / ${r.total != null ? r.total.toFixed(0) : '—'} GB` : '—'} m={r} />
          {gpuName ? (
            <div className="truncate px-2.5 pt-0.5 text-[6.5px] tracking-[0.14em] text-ink-3" title={gpuName}>
              {gpuName.toUpperCase()}
            </div>
          ) : null}
        </div>
      )}

      {/* GPU readouts */}
      <div className="border-t border-ink-3/20 px-2.5 pt-1.5 pb-1">
        <div className="mb-1 text-[7.5px] uppercase tracking-[0.18em] text-acc">
          GPU · DIE<span className="mt-px block text-[6.5px] tracking-[0.16em] text-ink-3">TEMP · DRAW · LOAD</span>
        </div>
        {offline || !m ? (
          <NoSource />
        ) : (
          [
            ['TEMP', `${m.temp != null ? `${Math.round(m.temp)}°C` : '—'}`, m.temp != null ? tempState(m.temp) : 'ok'],
            ['DRAW', `${m.power != null ? `${Math.round(m.power)}W` : '—'}`, m.power != null && m.power > 380 ? 'warn' : 'ok'],
            ['LOAD', `${m.util != null ? `${Math.round(m.util)}%` : '—'}`, m.util != null && m.util >= 90 ? 'warn' : 'ok'],
          ].map(([k, v2, st]) => (
            <div key={k} className="flex items-baseline justify-between gap-1 border-b border-dotted border-ink-3/20 py-px">
              <span className="truncate text-[7.5px] tracking-[0.06em] text-ink-3">
                <span className="mr-0.5 text-[7px] tracking-[0.1em] text-acc">{k}</span>
                {k === 'TEMP' ? 'die temp' : k === 'DRAW' ? 'board draw' : 'compute util'}
              </span>
              <span className={`whitespace-nowrap text-[8px] tabular-nums ${st === 'warn' ? 'text-dat' : st === 'alert' ? 'text-alm' : 'text-ink-2'}`}>{v2}</span>
            </div>
          ))
        )}
      </div>

      {/* VRAM pressure history */}
      <div className="border-t border-ink-3/20 px-2.5 pt-1.5 pb-1">
        <div className="mb-1 text-[7.5px] uppercase tracking-[0.18em] text-acc">
          VRAM · PRESSURE<span className="mt-px block text-[6.5px] tracking-[0.16em] text-ink-3">LAST 90 TICKS · GB</span>
        </div>
        {offline || !m ? (
          <NoSource />
        ) : (
          <>
            <div className="flex items-baseline gap-1">
              <span className="or-vt text-[17px] leading-none text-ink-1 [text-shadow:0_0_8px_rgb(var(--dat)_/_0.45)] tabular-nums">
                {v.used != null ? v.used.toFixed(1) : '—'}
              </span>
              <span className="text-[7.5px] text-ink-3 tabular-nums">GB NOW</span>
            </div>
            <div className="mt-1 h-[42px]">
              <SceneCanvas draw={paintVramHist} label="VRAM pressure history trace" className="h-full w-full" />
            </div>
          </>
        )}
      </div>

      {/* KV SLOT grid */}
      <div className="border-t border-ink-3/20 px-2.5 pt-1.5 pb-2">
        <div className="mb-1 text-[7.5px] tracking-[0.18em] text-acc">KV SLOTS · {POD_COUNT} PODS</div>
        {offline || pods.length === 0 ? (
          <NoSource />
        ) : (
          <div className="grid grid-cols-2 gap-x-1.5 gap-y-1">
            {pods.map((p) => (
              <div
                key={p.pod}
                className={`flex flex-col gap-0.5 p-0.5 ${p.fill >= 0.85 ? 'border border-alm/60 bg-alm/10' : ''}`}
                title={`POD ${p.pod + 1} · SLOT ${p.id}${p.idx >= 0 ? ` · SESSION ${p.idx + 1}` : ' · EMPTY'}`}
              >
                <div className="flex justify-between text-[7px] tracking-[0.1em] text-ink-3">
                  <span className="text-ink-2">P{String(p.pod + 1).padStart(2, '0')}</span>
                  <span className="truncate">{p.id}</span>
                </div>
                <div className="relative h-[22px] w-full overflow-hidden border border-ink-3/25 bg-bgg/75">
                  <div
                    className={`absolute inset-x-0 bottom-0 ${p.fill >= 0.85 ? 'or-fill-risk' : p.fill >= 0.6 ? 'or-fill-warn' : 'or-fill'}`}
                    style={{ height: `${Math.round(p.fill * 100)}%` }}
                  />
                </div>
                <div className={`text-right text-[7.5px] tabular-nums ${p.fill >= 0.85 ? 'text-alm' : 'text-dat'}`}>
                  {p.win ? `${Math.round(p.fill * 100)}%` : 'IDLE'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-auto border-t border-ink-3/20 px-2.5 py-1.5 text-[7px] tracking-[0.16em] text-ink-3">
        UPTIME · <span className="text-dat">{offline ? 'NO DATA' : uptimeOf(snap)}</span> · AT RISK{' '}
        <span className={flagged ? 'text-alm' : 'text-dat'}>{offline ? '—' : grp(flagged)}</span>
      </div>
    </aside>
  )
}

import { KPI_KEYS, tempState, fmtKpi } from '../lib/format'

// Status colours are absolute (never skin-derived) so "warning" always looks
// like a warning. `glow` is the accent, used for healthy/live state.
const TONE = {
  ok: { text: 'text-acc', dot: 'bg-acc', border: 'border-acc/35', bg: 'bg-acc/[0.08]' },
  live: { text: 'text-acc', dot: 'bg-acc', border: 'border-acc/45', bg: 'bg-acc/10' },
  data: { text: 'text-dat', dot: 'bg-dat', border: 'border-dat/35', bg: 'bg-dat/[0.08]' },
  warn: { text: 'text-dat', dot: 'bg-dat', border: 'border-dat/45', bg: 'bg-dat/10' },
  crit: { text: 'text-col', dot: 'bg-col', border: 'border-col/45', bg: 'bg-col/10' },
  idle: { text: 'text-ink-3', dot: 'bg-ink-3', border: 'border-ink-3/30', bg: 'bg-ink-3/5' },
}

export function Pill({ label, value, tone = 'ok', pulse = false }) {
  const t = TONE[tone] || TONE.ok
  return (
    <span
      className={`inline-flex items-center gap-2 rounded border ${t.border} ${t.bg} px-2 py-1 text-2xs ${t.text}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.dot} ${pulse ? 'animate-pulseDot' : ''}`} />
      <span className="text-ink-3">{label}</span>
      <span className="tabular-nums text-ink-1">{value}</span>
    </span>
  )
}

/** Derive the pill row from one snapshot, mirroring renderPills() in web/app.js. */
export function derivePills(snap) {
  const engines = snap.engines || []
  const up = engines.filter((e) => e.up).length
  const kpi = snap.kpi || {}
  const gpu = snap.gpu || {}
  const tmp = tempState(gpu.temp)
  const tmpTone = tmp === 'alert' ? 'crit' : tmp === 'warn' ? 'warn' : tmp === 'ok' ? 'ok' : 'idle'
  const q = kpi.queue || 0
  const link =
    {
      live: { value: 'live', tone: 'live' },
      demo: { value: 'sim', tone: 'live' },
      offline: { value: 'offline', tone: 'crit' },
      boot: { value: 'boot', tone: 'warn' },
    }[snap.mode] || { value: 'boot', tone: 'warn' }

  return [
    { key: 'link', label: 'link', value: link.value, tone: link.tone, pulse: true },
    { key: 'eng', label: 'engines', value: `${up}/${engines.length}`, tone: up ? 'ok' : 'crit' },
    { key: 'tps', label: 'tok/s', value: fmtKpi('tps', kpi.tps) ?? '—', tone: 'live' },
    { key: 'queue', label: 'queue', value: fmtKpi('queue', q) ?? '—', tone: q >= 10 ? 'warn' : 'ok' },
    { key: 'vram', label: 'vram', value: fmtKpi('vram', kpi.vram) ?? '—', tone: 'data' },
    {
      key: 'tmp',
      label: 'gpu',
      value: gpu.temp != null && isFinite(gpu.temp) ? `${Math.round(gpu.temp)}C` : '—',
      tone: tmpTone,
    },
    { key: 'strata', label: 'strata', value: snap.strata?.up ? 'up' : snap.strata?.up === false ? 'down' : 'n/a', tone: snap.strata?.up ? 'ok' : 'idle' },
    {
      key: 'alerts',
      label: 'alerts',
      value: String((snap.alerts || []).length),
      tone: (snap.alerts || []).length ? 'crit' : 'ok',
      pulse: (snap.alerts || []).length > 0,
    },
  ]
}

export { KPI_KEYS }

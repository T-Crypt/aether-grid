// Seeded in-browser simulator. Same state shape as the live feed
// (src/lib/adapt.js maps the collector snapshot and tick onto it), so every
// component is fed real-shaped data and live and demo share one paint path.
//
// Deterministic on purpose: a reload replays the same run, which is what makes
// screenshot diffs and the reduced-motion snapshot meaningful.

export const HIST_CAP = 240 // 4 min @ 1 Hz — enough for the sparklines

// Local copy of the KPI key list; the simulator stays UI-free.
const KPI_KEYS = ['tps', 'rpm', 'p95', 'ttft', 'tpot', 'vram', 'cache', 'reingest', 'mtp', 'queue']

function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 0x21f0ffad)
    t = Math.imul(t ^ (t >>> 7), 0x84222325)
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296
  }
}

const pushHist = (arr, v) => {
  arr.push(v == null || !isFinite(v) ? 0 : v)
  if (arr.length > HIST_CAP) arr.splice(0, arr.length - HIST_CAP)
}

const ENGINE = { key: 'sim', label: 'simulated runtime', origin: 'sim', up: true }

export function createSimulator(seed = 0xc0ffee) {
  const R = mulberry32(seed)
  const now = () => Date.now() / 1000

  const d = {
    tps: 158,
    rpm: 214,
    p95: 340,
    ttft: 210,
    tpot: 26,
    cache: 62,
    queue: 3,
    mtp: 71,
    util: 74,
    temp: 61,
    power: 268,
    vram: 18.4,
    vramTotal: 24,
    cpu: 38,
    ramUsed: 18.9,
    ramTotal: 32.5,
    reqId: 0,
    evId: 0,
    t: 0,
  }

  const sessions = Array.from({ length: 28 }, (_, i) => ({
    id: 's' + (1000 + i),
    window: 131072,
    used: Math.floor(131072 * (0.12 + R() * 0.62)),
    cached: Math.floor(131072 * (0.1 + R() * 0.5)),
  }))

  const state = {
    mode: 'demo',
    feed: 'sim',
    gpu: { name: 'RTX 4090 (sim)', util: d.util, temp: d.temp, power: d.power, vram: d.vram, vramTotal: d.vramTotal },
    host: { cpu: d.cpu, ramUsed: d.ramUsed, ramTotal: d.ramTotal, uptime: 41 * 3600 },
    kpi: {},
    kpiHist: Object.fromEntries(KPI_KEYS.map((k) => [k, []])),
    engHist: { sim: [] },
    hostHist: { cpu: [], ram: [] },
    engines: [{ ...ENGINE, queue: 3, rates: { decode_tps: 158 }, mtp: 71, sessions }],
    sessions,
    strata: { up: true, models: ['sim-model', 'sim-draft'] },
    models: ['sim-model', 'sim-draft'],
    alerts: [],
    events: [],
    requests: [],
    reasoning: { t: 0, requests: 0, thinking_tokens: 0, mtp_acc: 0, mtp_tot: 0, mtp_accept_pct: null },
  }

  const drift = (v, lo, hi, pull) => v + (lo + (hi - lo) * pull - v) * 0.06 + (R() - 0.5) * 2

  function snapshot() {
    // Fresh object each tick so React sees a new reference; the arrays are
    // sliced copies so a consumer cannot mutate the simulator's history.
    return {
      ...state,
      gpu: { ...state.gpu },
      host: { ...state.host },
      kpi: { ...state.kpi },
      strata: { ...state.strata },
      reasoning: { ...state.reasoning },
      engines: state.engines.map((e) => ({ ...e, rates: { ...e.rates }, sessions: e.sessions.slice() })),
      sessions: state.sessions.slice(),
      models: state.models.slice(),
      alerts: state.alerts.slice(),
      events: state.events.slice(),
      requests: state.requests.slice(),
      kpiHist: Object.fromEntries(KPI_KEYS.map((k) => [k, state.kpiHist[k].slice()])),
      engHist: { sim: state.engHist.sim.slice() },
      hostHist: { cpu: state.hostHist.cpu.slice(), ram: state.hostHist.ram.slice() },
    }
  }

  function step() {
    state.t = d.t = d.t + 1
    const load = 0.45 + 0.4 * Math.sin(d.t / 40) + R() * 0.15

    d.tps = Math.max(12, drift(d.tps, 60, 260, load))
    d.rpm = Math.max(20, drift(d.rpm, 120, 340, load))
    d.p95 = Math.max(90, drift(d.p95, 220, 620, load * 0.9))
    d.ttft = Math.max(60, drift(d.ttft, 120, 430, load))
    d.tpot = Math.max(8, drift(d.tpot, 18, 46, load))
    d.queue = Math.max(0, drift(d.queue, 0, 14, load * 0.7))
    d.cache = Math.min(96, Math.max(20, drift(d.cache, 45, 82, 0.6)))
    d.util = Math.min(100, Math.max(0, drift(d.util, 30, 99, load)))
    d.temp = Math.max(34, drift(d.temp, 42, 86, load * 0.9))
    d.vram = Math.min(24, Math.max(6, drift(d.vram, 12, 23.5, 0.55)))
    d.cpu = Math.min(100, Math.max(4, drift(d.cpu, 18, 72, load * 0.8)))

    state.gpu = { ...state.gpu, util: d.util, temp: d.temp, vram: d.vram }
    state.host = { ...state.host, cpu: d.cpu }
    state.kpi = {
      tps: d.tps,
      rpm: d.rpm,
      p95: d.p95,
      ttft: d.ttft,
      tpot: d.tpot,
      vram: d.vram,
      cache: d.cache,
      reingest: 100 - d.cache,
      mtp: d.mtp + (R() - 0.5) * 1.2,
      queue: d.queue,
    }
    for (const k of KPI_KEYS) pushHist(state.kpiHist[k], state.kpi[k])
    pushHist(state.engHist.sim, d.tps)
    pushHist(state.hostHist.cpu, d.cpu)
    pushHist(state.hostHist.ram, d.ramUsed)

    state.engines[0].rates = { decode_tps: Math.round(d.tps) }
    state.engines[0].queue = Math.round(d.queue)

    for (const s of sessions) s.used = Math.min(s.window, Math.max(256, s.used + Math.floor((R() - 0.45) * 900)))
    state.sessions = sessions

    if (d.t % 4 === 0) {
      state.requests = [
        {
          id: 'sim-' + ++d.reqId,
          t: now(),
          model: R() < 0.78 ? 'sim-model' : 'sim-draft',
          prompt: 800 + Math.floor(R() * 2400),
          output: Math.floor(80 + R() * 420),
          decode_tps: Math.round(d.tps),
        },
        ...state.requests,
      ].slice(0, 120)
    }

    if (R() < 0.12) {
      const r = R()
      const level = r < 0.62 ? 'ok' : r < 0.9 ? 'warn' : 'err'
      state.events = [
        {
          id: 'ev-' + ++d.evId,
          t: now(),
          level,
          msg:
            level === 'ok'
              ? `tick ${d.t} · ${Math.round(d.tps)} tok/s`
              : level === 'warn'
                ? `queue depth ${Math.round(d.queue)}`
                : `vram pressure ${(d.vram / d.vramTotal * 100).toFixed(0)}%`,
        },
        ...state.events,
      ].slice(0, 60)
    }

    const hot = sessions.filter((s) => s.used / s.window >= 0.85).length
    state.alerts = hot > 0 ? [`${hot} slot(s) above 85%`] : []

    const rs = state.reasoning
    rs.t += 1
    rs.requests += 1
    rs.thinking_tokens += Math.floor(40 + R() * 320)
    rs.mtp_acc += R() < 0.71 ? 1 : 0
    rs.mtp_tot += 1
    rs.mtp_accept_pct = Math.round((100 * rs.mtp_acc) / rs.mtp_tot * 10) / 10

    return snapshot()
  }

  // Warm the histories so sparklines and the terrain are populated on paint.
  for (let i = 0; i < HIST_CAP; i++) step()

  return { state: snapshot(), step }
}

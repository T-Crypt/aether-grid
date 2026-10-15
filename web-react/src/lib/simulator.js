// Seeded in-browser simulator. Same state shape as the live feed
// (src/lib/adapt.js maps the collector snapshot and tick onto it), so every
// component is fed real-shaped data and live and demo share one paint path.
//
// Deterministic on purpose: a reload replays the same run, which keeps
// screenshot diffs and the reduced-motion snapshot meaningful.
//
// The demo is a slow 60 s story loop, one lap per PHASES cycle below, so
// the console reads as a machine running. The scene translator
// (src/scene/conductor.js) derives its canonical events from these metric
// moves, so the choreography reaches the helix, cables, KV grid, scatter
// and log without the simulator knowing anything about the scene.

export const HIST_CAP = 240 // 4 min @ 1 Hz — enough for the sparklines

// Local copy of the KPI key list; the simulator stays UI-free.
const KPI_KEYS = ['tps', 'rpm', 'p95', 'ttft', 'tpot', 'vram', 'cache', 'reingest', 'mtp', 'queue']

// One scenario lap. Durations in ticks (1 Hz).
const PHASES = [
  {
    name: 'idle',
    dur: 12,
    kpi: { tps: 70, rpm: 92, p95: 260, ttft: 150, tpot: 14, queue: 1, vram: 10.4, cache: 76, mtp: 74 },
    gpu: { util: 36, temp: 46, power: 108 },
    host: { cpu: 14 },
    fill: 0.34,
    mtpP: 0.74,
    think: 0.5,
  },
  {
    name: 'burst',
    dur: 12,
    kpi: { tps: 265, rpm: 338, p95: 640, ttft: 420, tpot: 44, queue: 13, vram: 15.2, cache: 60, mtp: 64 },
    gpu: { util: 92, temp: 68, power: 340 },
    host: { cpu: 55 },
    fill: 0.58,
    mtpP: 0.66,
    think: 1.0,
  },
  {
    name: 'pressure',
    dur: 12,
    kpi: { tps: 212, rpm: 300, p95: 780, ttft: 520, tpot: 55, queue: 9, vram: 21.6, cache: 52, mtp: 58 },
    gpu: { util: 84, temp: 79, power: 401 },
    host: { cpu: 58 },
    fill: 0.78,
    mtpP: 0.6,
    think: 0.8,
  },
  {
    name: 'overflow',
    dur: 12,
    kpi: { tps: 150, rpm: 258, p95: 960, ttft: 640, tpot: 71, queue: 11, vram: 22.6, cache: 40, mtp: 52 },
    gpu: { util: 76, temp: 85, power: 421 },
    host: { cpu: 60 },
    fill: 0.93,
    mtpP: 0.54,
    think: 0.7,
  },
  {
    name: 'recover',
    dur: 12,
    kpi: { tps: 92, rpm: 122, p95: 300, ttft: 180, tpot: 16, queue: 2, vram: 14.0, cache: 68, mtp: 70 },
    gpu: { util: 45, temp: 55, power: 152 },
    host: { cpu: 20 },
    fill: 0.42,
    mtpP: 0.7,
    think: 0.5,
  },
]

const LAP = PHASES.reduce((a, p) => a + p.dur, 0) // 60 s lap

function phaseAt(t) {
  let u = ((t % LAP) + LAP) % LAP
  for (const p of PHASES) {
    if (u < p.dur) return { ...p, prog: u / p.dur, idx: PHASES.indexOf(p) }
    u -= p.dur
  }
  return { ...PHASES[0], prog: 0, idx: 0 }
}

function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 0x21f0ffad)
    t = (t + Math.imul(t ^ (t >>> 7), 0x84222325)) | 0
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296
  }
}

const det = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

const pushHist = (arr, v) => {
  arr.push(v == null || !isFinite(v) ? 0 : v)
  if (arr.length > HIST_CAP) arr.splice(0, arr.length - HIST_CAP)
}

const ENGINE = { key: 'sim', label: 'simulated runtime', origin: 'sim', up: true }

export function createSimulator(seed = 0xc0ffee) {
  const R = mulberry32(seed)
  const now = () => Date.now() / 1000

  // Current values. Each tick relaxes 18% of the way to the active phase
  // target (roughly a 5 s settle at 1 Hz) plus seeded noise, so phase
  // boundaries ramp instead of stepping.
  const d = {
    tps: 70,
    rpm: 92,
    p95: 260,
    ttft: 150,
    tpot: 14,
    queue: 1,
    vram: 10.4,
    cache: 76,
    mtp: 74,
    util: 36,
    temp: 46,
    power: 108,
    cpu: 14,
    vramTotal: 24,
    ramUsed: 14.2,
    ramTotal: 32.5,
    reqId: 0,
    evId: 0,
    t: 0,
  }

  const sessions = Array.from({ length: 28 }, (_, i) => ({
    id: 's' + (1000 + i),
    window: 131072,
    used: Math.floor(131072 * (0.2 + det(i * 1.7) * 0.3)),
    cached: Math.floor(131072 * (0.1 + det(i * 3.1) * 0.4)),
    off: (det(i * 5.3) - 0.5) * 0.2,
    evictAt: null, // tick at which this slot gets evicted (overflow)
  }))

  const state = {
    mode: 'demo',
    feed: 'sim',
    phase: 'idle',
    gpu: { name: 'RTX 4090 (sim)', util: d.util, temp: d.temp, power: d.power, vram: d.vram, vramTotal: d.vramTotal },
    host: { cpu: d.cpu, ramUsed: d.ramUsed, ramTotal: d.ramTotal, uptime: 41 * 3600 },
    kpi: {},
    kpiHist: Object.fromEntries(KPI_KEYS.map((k) => [k, []])),
    engHist: { sim: [] },
    hostHist: { cpu: [], ram: [] },
    engines: [{ ...ENGINE, queue: 1, rates: { decode_tps: 70 }, mtp: 74, sessions: [] }],
    sessions: [],
    strata: { up: true, models: ['sim-model', 'sim-draft'] },
    models: ['sim-model', 'sim-draft'],
    alerts: [],
    events: [],
    requests: [],
    reasoning: { t: 0, requests: 0, thinking_tokens: 0, mtp_acc: 0, mtp_tot: 0, mtp_accept_pct: null },
  }

  const relax = (v, target, noise = 0) => v + (target - v) * 0.18 + (R() - 0.5) * noise

  function pushEvent(level, msg) {
    state.events = [{ id: 'ev-' + ++d.evId, t: now(), level, msg }, ...state.events].slice(0, 60)
  }

  function snapshot() {
    // Fresh object each tick so React sees a new reference; the arrays are
    // sliced copies so a consumer cannot mutate the simulator's history.
    const flatSessions = sessions.map(({ id, window, used, cached }) => ({ id, engine: 'simulated runtime', window, used, cached }))
    state.sessions = flatSessions
    return {
      ...state,
      phase: state.phase,
      gpu: { ...state.gpu },
      host: { ...state.host },
      kpi: { ...state.kpi },
      strata: { ...state.strata },
      reasoning: { ...state.reasoning },
      engines: state.engines.map((e) => ({ ...e, rates: { ...e.rates }, sessions: flatSessions })),
      sessions: flatSessions.slice(),
      models: state.models.slice(),
      alerts: state.alerts.slice(),
      events: state.events.slice(),
      requests: state.requests.slice(),
      kpiHist: Object.fromEntries(KPI_KEYS.map((k) => [k, state.kpiHist[k].slice()])),
      engHist: { sim: state.engHist.sim.slice() },
      hostHist: { cpu: state.hostHist.cpu.slice(), ram: state.hostHist.ram.slice() },
    }
  }

  let lastPhase = null

  function step() {
    state.t = d.t = d.t + 1
    const ph = phaseAt(d.t)
    state.phase = ph.name

    if (ph.name !== lastPhase) {
      const beat = {
        idle: 'quiet baseline · decode steady',
        burst: 'request surge · decode ramping',
        pressure: `vram ${(ph.kpi.vram / 24 * 100).toFixed(0)}% · power ${ph.gpu.power}W`,
        overflow: 'kv cohort saturating · slot eviction armed',
        recover: 'pressure released · cohort draining',
      }[ph.name]
      pushEvent(ph.name === 'overflow' ? 'err' : ph.name === 'idle' ? 'ok' : 'warn', `phase → ${ph.name} · ${beat}`)
      lastPhase = ph.name
    }

    d.tps = Math.max(8, relax(d.tps, ph.kpi.tps, 6))
    d.rpm = Math.max(12, relax(d.rpm, ph.kpi.rpm, 8))
    d.p95 = Math.max(90, relax(d.p95, ph.kpi.p95, 18))
    d.ttft = Math.max(60, relax(d.ttft, ph.kpi.ttft, 14))
    d.tpot = Math.max(8, relax(d.tpot, ph.kpi.tpot, 3))
    d.queue = Math.max(0, relax(d.queue, ph.kpi.queue, 1.4))
    d.cache = Math.min(97, Math.max(20, relax(d.cache, ph.kpi.cache, 2)))
    d.vram = Math.min(23.9, Math.max(6, relax(d.vram, ph.kpi.vram, 0.35)))
    d.util = Math.min(100, Math.max(0, relax(d.util, ph.gpu.util, 4)))
    d.temp = Math.max(34, relax(d.temp, ph.gpu.temp, 1.2))
    d.power = Math.max(40, relax(d.power, ph.gpu.power, 9))
    d.cpu = Math.min(100, Math.max(3, relax(d.cpu, ph.host.cpu, 3)))
    d.ramUsed = Math.min(d.ramTotal, Math.max(4, d.ramUsed + (12 + d.cpu * 0.12 - d.ramUsed) * 0.05 + (R() - 0.5) * 0.2))

    state.gpu = { ...state.gpu, util: d.util, temp: d.temp, vram: d.vram }
    state.host = { ...state.host, cpu: d.cpu, ramUsed: d.ramUsed }
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
    d.mtp = Math.min(99, Math.max(30, relax(d.mtp, ph.kpi.mtp, 1.5)))
    for (const k of KPI_KEYS) pushHist(state.kpiHist[k], state.kpi[k])
    pushHist(state.engHist.sim, d.tps)
    pushHist(state.hostHist.cpu, d.cpu)
    pushHist(state.hostHist.ram, d.ramUsed)

    state.engines[0].rates = { decode_tps: Math.round(d.tps) }
    state.engines[0].queue = Math.round(d.queue)

    // KV cohort: slots relax toward the phase fill; overflow pushes the hot
    // ones over the alert line and evicts a few mid-phase.
    const lapPos = ((d.t % LAP) + LAP) % LAP
    const overT = PHASES[0].dur + PHASES[1].dur + PHASES[2].dur // overflow starts here
    if (ph.name === 'overflow' && Math.abs(lapPos - (overT + 5)) < 0.6) {
      const hotIds = [...sessions]
        .sort((a, b) => b.used / b.window - a.used / a.window)
        .slice(0, 5)
        .map((s) => s.id)
      for (const s of sessions) {
        if (hotIds.includes(s.id)) {
          s.used = Math.floor(s.window * (0.08 + det(s.id.length * 7) * 0.08))
          s.evictAt = d.t
        }
      }
      pushEvent('err', `kv overflow · evicted ${hotIds.length} slot(s), reingest ${(100 - d.cache).toFixed(0)}%`)
      state.alerts = [`${hotIds.length} slot(s) evicted · cohort refilling`]
    }

    for (const s of sessions) {
      const target = Math.min(0.99, Math.max(0.04, ph.fill + (s.off || 0)))
      const cur = s.used / s.window
      s.used = Math.min(s.window, Math.max(256, s.used + (target - cur) * 0.2 * s.window + (R() - 0.5) * s.window * 0.006))
    }

    // Requests: new-record rate tracks rpm, so request_arrived events land
    // in step with the story (bursts visibly busier than idle).
    const perTick = Math.max(0, (d.rpm / 60) * (0.4 + R() * 0.9))
    let nReq = Math.floor(perTick)
    if (R() < perTick - nReq) nReq += 1
    if (nReq > 0) {
      const fresh = []
      for (let i = 0; i < nReq; i++) {
        fresh.push({
          id: 'sim-' + ++d.reqId,
          t: now(),
          model: R() < 0.78 ? 'sim-model' : 'sim-draft',
          prompt: 800 + Math.floor(R() * 2400),
          output: Math.floor(80 + R() * 420),
          decode_tps: Math.round(d.tps),
        })
      }
      state.requests = [...fresh.reverse(), ...state.requests].slice(0, 120)
    }

    if (d.t % 4 === 0) {
      const beat =
        ph.name === 'idle'
          ? { level: 'ok', msg: `tick ${d.t} · ${Math.round(d.tps)} tok/s` }
          : ph.name === 'burst'
            ? R() < 0.5
              ? { level: 'ok', msg: `decode ${Math.round(d.tps)} tok/s · queue ${Math.round(d.queue)}` }
              : { level: 'warn', msg: `queue depth ${Math.round(d.queue)} · p95 ${(d.p95 / 1000).toFixed(1)}s` }
            : ph.name === 'pressure'
              ? { level: 'warn', msg: `vram pressure ${(d.vram / 24 * 100).toFixed(0)}% · ${Math.round(d.power)}W` }
              : ph.name === 'overflow'
                ? { level: 'err', msg: `kv pressure · reingest ${(100 - d.cache).toFixed(0)}%` }
                : { level: 'ok', msg: `recovered · ${Math.round(d.tps)} tok/s · vram ${(d.vram / 24 * 100).toFixed(0)}%` }
      pushEvent(beat.level, beat.msg)
    }

    const hot = sessions.filter((s) => s.used / s.window >= 0.85).length
    const alerts = []
    if (hot > 0) alerts.push(`${hot} slot(s) above 85%`)
    if (d.vram / d.vramTotal >= 0.9) alerts.push(`vram ${Math.round((d.vram / d.vramTotal) * 100)}% of pool`)
    state.alerts = alerts

    const rs = state.reasoning
    rs.t += 1
    rs.requests += nReq
    rs.thinking_tokens += Math.floor((60 + d.tps) * ph.think * (0.7 + R() * 0.6))
    for (let i = 0; i < 4; i++) {
      rs.mtp_acc += R() < ph.mtpP ? 1 : 0
      rs.mtp_tot += 1
    }
    rs.mtp_accept_pct = Math.round((100 * rs.mtp_acc) / rs.mtp_tot * 10) / 10

    return snapshot()
  }

  // Warm the histories so sparklines, terrain and cohort are populated on
  // the first paint.
  for (let i = 0; i < HIST_CAP; i++) step()

  return { state: snapshot(), step }
}

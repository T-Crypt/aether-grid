/* =========================================================================
   app.js — HEX-LAB static clone (no build, Canvas 2D + rAF only).
   State shape mirrors speculum: snapshot() and tick() fill the same fields;
   ?demo uses a seeded simulator fallback. Live and demo share one paint path.
   ========================================================================= */

import { paintTerrain, paintHelix } from './field.js';
import { paintBackdrop, paintScatter, paintCables, paintScopeStrip, layerFlags } from './layers.js';

const $ = (s, r = document) => r.querySelector(s);
const DEMO = new URLSearchParams(location.search).has('demo');
const API = ''; // same-origin absolute paths below (/api/...) work from /web/

/* --- state (same shape as speculum app.js) -------------------------------- */
const state = {
  mode: 'boot', feed: '—', paused: false,
  gpu: null, host: null,
  kpi: {}, kpiHist: {},
  engHist: {}, hostHist: { cpu: [], ram: [] },
  engines: [], strata: { up: null, models: [] },
  models: [], alerts: [], requests: [], events: [], sessions: [],
  t: 0,
};
const KPI_KEYS = ['tps', 'rpm', 'p95', 'ttft', 'tpot', 'vram', 'cache', 'reingest', 'mtp', 'queue'];
const HIST_CAP = 3600;

function pushHist(arr, v, cap = HIST_CAP) {
  if (!Array.isArray(arr)) return;
  arr.push(v == null ? 0 : v);
  if (arr.length > cap) arr.splice(0, arr.length - cap);
}
function normGpu(g) {
  if (!g) return null;
  const num = v => { const x = parseFloat(v); return isFinite(x) ? x : null; };
  return {
    name: g.name || '—', temp: num(g['temperature.gpu']), util: num(g['utilization.gpu']),
    power: num(g['power.draw']), vram: num(g['memory.used_gb']), vramTotal: num(g['memory.total_gb']),
  };
}
function normHost(h) {
  if (!h) return null;
  return { cpu: h.cpu_total_pct ?? null, ramUsed: h.ram_used_gb, ramTotal: h.ram_total_gb, uptime: h.uptime_s };
}

/* --- feed: /api/snapshot + /api/stream SSE, poll fallback ------------------ */
let es = null, pollTimer = null;
const feed = { lastTick: null };

async function fetchSnap() {
  const paths = ['/api/snapshot', '../api/snapshot', 'api/snapshot'];
  let err = null;
  for (const p of paths) {
    try { const r = await fetch(p, { cache: 'no-store' }); if (!r.ok) throw new Error('http ' + r.status); return await r.json(); }
    catch (e) { err = e; }
  }
  throw err || new Error('snapshot failed');
}

function applySnapshot(s) {
  state.gpu = normGpu(s.gpu && s.gpu.last);
  state.host = normHost(s.host);
  state.kpi = { ...((s.kpi && s.kpi.last) || {}) };
  state.kpiHist = {};
  for (const k of KPI_KEYS) state.kpiHist[k] = [...(((s.kpi && s.kpi.hist && s.kpi.hist[k]) || []))];
  state.engines = Object.values(s.engines || {});
  state.engHist = {};
  for (const e of state.engines) state.engHist[e.key] = [...(e.hist || [])];
  state.strata = s.strata || { up: null, models: [] };
  state.models = s.models || [];
  state.alerts = s.alerts || [];
  for (const r of s.requests || []) pushRequest(r);
  for (const ev of (s.events || []).slice(0, 100)) pushEvent(ev);
  refreshDerived();
  state.mode = 'live';
  feed.lastTick = performance.now();
}

function applyTick(d) {
  if (d.gpu !== undefined) state.gpu = normGpu(d.gpu);
  if (d.host !== undefined) state.host = normHost(d.host);
  for (const k of KPI_KEYS) { state.kpi[k] = d.kpi ? d.kpi[k] : state.kpi[k]; pushHist(state.kpiHist[k], d.kpi ? d.kpi[k] : null); }
  if (d.kpi && d.kpi.tps_models != null) state.kpi.tps_models = d.kpi.tps_models;
  state.strata.up = d.strata_up != null ? d.strata_up : state.strata.up;
  state.alerts = d.alerts || state.alerts;
  if (d.engines) for (const key of Object.keys(d.engines)) {
    const t = d.engines[key];
    let e = state.engines.find(x => x.key === key);
    if (!e) { e = { key, label: key, origin: key, sessions: [] }; state.engines.push(e); state.engHist[key] = []; }
    Object.assign(e, { up: t.up ?? e.up, queue: t.queue ?? e.queue, rates: t.rates ?? e.rates, mtp: t.mtp ?? e.mtp });
    if (t.sessions) e.sessions = t.sessions;
    if (t.rate != null) pushHist(state.engHist[e.key], t.rate);
  }
  for (const r of d.new_requests || []) pushRequest(r);
  for (const ev of d.new_events || []) pushEvent(ev);
  if (state.mode === 'offline') state.mode = 'live';
  state.feed = 'sse';
  feed.lastTick = performance.now();
  refreshDerived();
}

function pushRequest(r) {
  if (!r || (r.id && state.requests.some(x => x.id === r.id))) return;
  state.requests.unshift(r);
  if (state.requests.length > 200) state.requests.length = 200;
}
const evSeen = new Set();
function pushEvent(ev) {
  if (!ev) return;
  const k = (ev.t || 0) + '|' + ev.level + '|' + (ev.msg || '');
  if (evSeen.has(k)) return;
  evSeen.add(k);
  state.events.unshift(ev);
  if (state.events.length > 100) state.events.length = 100;
}

function refreshDerived() {
  state.sessions = [];
  for (const e of state.engines) {
    if (!e.up && e.key !== 'strata') continue;
    for (const s of e.sessions || []) {
      state.sessions.push({
        id: s.id + (s.session ? '-' + s.session : ''),
        engine: e.label || e.key, window: s.window || e.window,
        used: s.used, cached: s.cached,
      });
    }
  }
}

function streamUrl(p) {
  // absolute first (server root), then relative fallbacks
  return p;
}
function openSSE() {
  if (es) { try { es.close(); } catch {} es = null; }
  const candidates = ['/api/stream', '../api/stream'];
  const tryOpen = (i) => {
    if (i >= candidates.length) { startPoll(); return; }
    try {
      const src = new EventSource(candidates[i]);
      src.onopen = () => { es = src; state.feed = 'sse'; feed.lastTick = performance.now(); };
      src.addEventListener('tick', ev => { try { applyTick(JSON.parse(ev.data)); } catch {} });
      src.onerror = () => { try { src.close(); } catch {} if (es === src) es = null; tryOpen(i + 1); };
    } catch { tryOpen(i + 1); }
  };
  tryOpen(0);
}
function startPoll() {
  if (pollTimer) return;
  state.feed = state.feed === 'sse' ? 'poll' : state.feed;
  pollTimer = setInterval(async () => {
    try { applySnapshot(await fetchSnap()); state.feed = 'poll'; }
    catch { state.mode = 'offline'; }
  }, 2000);
}
async function bootLive() {
  try { applySnapshot(await fetchSnap()); openSSE(); }
  catch { state.mode = 'offline'; startPoll(); setInterval(() => { if (state.mode === 'offline' && !es) openSSE(); }, 10000); }
}

/* --- demo simulator (seeded, same state shape) ----------------------------- */
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 0x21F0FFAD);
    t = Math.imul(t ^ (t >>> 7), 0x84222325);
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0xBE57);
let demo = null;
function initDemo() {
  const R = mulberry32(0xC0FFEE); // deterministic seed
  demo = {
    tps: 140, rpm: 200, p95: 340, ttft: 210, tpot: 26, cache: 62, queue: 3, mtp: 71,
    gpu: { name: 'RTX 4090 (sim)', 'temperature.gpu': 61, 'utilization.gpu': 74, 'power.draw': 268, 'memory.used_gb': 18.4, 'memory.total_gb': 24 },
    host: { cpu_total_pct: 38, ram_used_gb: 18.9, ram_total_gb: 32.5, uptime_s: 41 * 3600 },
    engine: { key: 'sim', label: 'simulated runtime', origin: 'sim', up: true, queue: 3, rates: { decode_tps: 140 }, mtp: 71, window: 131072, sessions: [] },
    reqId: 0, R,
  };
  for (let i = 0; i < 12; i++) {
    demo.engine.sessions.push({ id: 's' + (1000 + i), window: 131072, used: Math.floor(131072 * (0.15 + R() * 0.6)), cached: Math.floor(131072 * (0.1 + R() * 0.5)) });
  }
  state.engines = [demo.engine];
  state.engHist = { sim: [] };
  state.strata = { up: true, models: [] };
  state.mode = 'demo'; state.feed = 'sim';
  for (let i = 0; i < 300; i++) demoStep();
  refreshDerived();
}
function demoStep() {
  const d = demo, R = d.R;
  state.t += 1;
  const load = 0.45 + 0.4 * Math.sin(state.t / 40) + R() * 0.15;
  const drift = (v, lo, hi, pull) => v + (lo + (hi - lo) * pull - v) * 0.06 + (R() - 0.5) * 2;
  d.tps = Math.max(12, drift(d.tps, 60, 260, load));
  d.rpm = Math.max(20, drift(d.rpm, 120, 340, load));
  d.p95 = Math.max(90, drift(d.p95, 220, 620, load * 0.9));
  d.ttft = Math.max(60, drift(d.ttft, 120, 430, load));
  d.tpot = Math.max(8, drift(d.tpot, 18, 46, load));
  d.queue = Math.max(0, drift(d.queue, 0, 14, load * 0.7));
  d.cache = Math.min(96, Math.max(20, drift(d.cache, 45, 82, 0.6)));
  d.gpu['utilization.gpu'] = Math.min(100, Math.max(0, drift(d.gpu['utilization.gpu'], 30, 99, load)));
  d.gpu['temperature.gpu'] = Math.max(34, drift(d.gpu['temperature.gpu'], 42, 86, load * 0.9));
  d.gpu['memory.used_gb'] = Math.min(24, Math.max(6, drift(d.gpu['memory.used_gb'], 12, 23.5, 0.55)));
  state.gpu = normGpu(d.gpu);
  state.host = normHost(d.host);
  state.kpi = { tps: d.tps, rpm: d.rpm, p95: d.p95, ttft: d.ttft, tpot: d.tpot, vram: d.gpu['memory.used_gb'], cache: d.cache, reingest: 100 - d.cache, mtp: d.mtp, queue: d.queue, tps_models: ['sim-model'] };
  for (const k of KPI_KEYS) pushHist(state.kpiHist[k] ??= [], state.kpi[k]);
  pushHist(state.engHist.sim ??= [], d.tps);
  pushHist(state.hostHist.cpu, d.host.cpu_total_pct);
  d.engine.rates = { decode_tps: Math.round(d.tps) };
  d.engine.queue = Math.round(d.queue);
  for (const s of d.engine.sessions) s.used = Math.min(s.window, Math.max(256, s.used + Math.floor((R() - 0.45) * 900)));
  if (state.t % 5 === 0) pushRequest({ id: 'sim-' + (++d.reqId), t: Date.now() / 1000, model: 'sim-model', prompt: 1000, output: Math.floor(80 + R() * 400), decode_tps: Math.round(d.tps) });
  if (R() < 0.1) pushEvent({ t: Date.now() / 1000, level: R() < 0.7 ? 'ok' : 'warn', msg: 'sim tick · ' + Math.round(d.tps) + ' tok/s' });
  feed.lastTick = performance.now();
  refreshDerived();
}

/* --- render (DOM, throttled) ---------------------------------------------- */
function pill(label, val, s) {
  return '<span class="pill" data-s="' + s + '"><span class="dot"></span>' + label + ' ' + val + '</span>';
}
function renderPills() {
  const bar = $('#pills');
  const up = state.engines.filter(e => e.up).length;
  const modeS = state.mode === 'live' ? 'live' : state.mode === 'demo' ? 'live' : state.mode === 'offline' ? 'crit' : 'warn';
  const q = state.kpi.queue || 0;
  bar.innerHTML = '<span class="brand">HEX-LAB <small>field monitor</small></span>'
    + pill('mode', state.mode, modeS)
    + pill('feed', state.feed, state.feed === 'sse' || state.feed === 'sim' ? 'live' : 'warn')
    + pill('engines', up + '/' + state.engines.length, up ? 'ok' : 'crit')
    + pill('tps', Math.round(state.kpi.tps || 0), 'live')
    + pill('queue', Math.round(q), q >= 10 ? 'crit' : q >= 4 ? 'warn' : 'ok')
    + pill('vram', (state.kpi.vram != null ? state.kpi.vram.toFixed(1) : '—') + 'G', 'live');
}
const KPI_FMT = {
  tps: v => Math.round(v), rpm: v => Math.round(v), queue: v => Math.round(v),
  ttft: v => (v / 1000).toFixed(2) + 's', tpot: v => Math.round(v) + 'ms', p95: v => (v / 1000).toFixed(1) + 's',
  cache: v => v.toFixed(1) + '%', reingest: v => v.toFixed(1) + '%', mtp: v => v.toFixed(1) + '%', vram: v => v.toFixed(1) + 'G',
};
function renderKpis() {
  $('#kpis').innerHTML = KPI_KEYS.map(k => {
    const v = state.kpi[k];
    return '<div class="kpi"><div class="k">' + k + '</div><div class="v">' + (v != null && isFinite(v) ? KPI_FMT[k](v) : '—') + '</div></div>';
  }).join('');
}
function renderCohort() {
  const box = $('#cohort');
  if (!state.sessions.length) { box.innerHTML = '<div class="slot"><div class="meta">no live slots</div></div>'; return; }
  box.innerHTML = state.sessions.slice(0, 48).map(s => {
    const f = s.window ? Math.min(1, (s.used || 0) / s.window) : 0;
    return '<div class="slot"><div>' + s.id + ' · ' + (s.engine || '') + '</div>'
      + '<div class="bar"><i style="width:' + (f * 100).toFixed(1) + '%"></i></div>'
      + '<div class="meta">' + (s.used || 0) + ' / ' + (s.window || '?') + ' · cached ' + (s.cached || 0) + '</div></div>';
  }).join('');
}
function renderLogs() {
  $('#events').innerHTML = state.events.slice(0, 30).map(e => '<li>[' + (e.level || '?') + '] ' + (e.msg || '') + '</li>').join('');
  $('#requests').innerHTML = state.requests.slice(0, 30).map(r => '<li>' + (r.id || '?') + ' · ' + (r.model || '') + ' · ' + Math.round(r.decode_tps || r.tps || 0) + ' tok/s</li>').join('');
  $('#foot').textContent = 'hex-lab · mode ' + state.mode + ' · feed ' + state.feed + ' · ' + new Date().toLocaleTimeString();
}
function renderText() { renderPills(); renderKpis(); renderCohort(); renderLogs(); }

/* --- layer toggles -------------------------------------------------------- */
function bindLayerToggles() {
  const map = [
    ['tgl-declination', 'declination', 'backdrop'],
    ['tgl-scope', 'scopeOmega', 'scatter'],
    ['tgl-loom', 'loom9', 'cables'],
    ['tgl-safehouse', 'safehouse', 'scope'],
  ];
  for (const [tglId, flag, canvasId] of map) {
    const box = document.getElementById(tglId);
    if (!box) continue;
    box.checked = layerFlags[flag];
    box.addEventListener('change', () => {
      layerFlags[flag] = box.checked;
      const c = document.getElementById(canvasId);
      if (c) c.style.display = box.checked ? '' : 'none';
    });
  }
}

/* --- main loop: single rAF drives both canvases; DOM at ~2 Hz -------------- */
const terrainEl = () => $('#terrain');
const helixEl = () => $('#helix');
let lastDom = 0, lastSim = 0;
function frame(now) {
  if (state.mode === 'demo' && now - lastSim > 1000) { lastSim = now; demoStep(); }
  const hist = state.kpiHist.tps && state.kpiHist.tps.length ? state.kpiHist.tps : state.engHist[Object.keys(state.engHist)[0]] || [0];
  paintTerrain(terrainEl(), hist, now);
  const maxTps = Math.max(1, ...(hist.slice(-60)));
  paintHelix(helixEl(), (state.kpi.tps || 0) / Math.max(maxTps, state.kpi.tps || 1), state.sessions, now);
  if (layerFlags.declination) paintBackdrop($('#backdrop'), state.kpiHist.tps, now);
  if (layerFlags.scopeOmega) paintScatter($('#scatter'), state.kpiHist, state.alerts, state.events, now);
  if (layerFlags.loom9) paintCables($('#cables'), state.engines, state.requests, now);
  if (layerFlags.safehouse) paintScopeStrip($('#scope'), state.sessions, now);
  if (now - lastDom > 500) { lastDom = now; renderText(); }
  requestAnimationFrame(frame);
}

if (DEMO) initDemo(); else bootLive();
bindLayerToggles();
renderText();
requestAnimationFrame(frame);

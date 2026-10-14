/* =========================================================================
   app.js — HEX-LAB static clone (no build, Canvas 2D + rAF only).
   State shape mirrors speculum: snapshot() and tick() fill the same fields;
   ?demo uses a seeded simulator fallback. Live and demo share one paint path.
   ========================================================================= */

import { paintTerrain, paintHelix, paintGauges } from './field.js';
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
  router: { nodes: [], runs: [] }, reasoning: null,
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
  state.router = s.router || { nodes: [], runs: [] };
  state.reasoning = s.reasoning || null;
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
  if (d.router) state.router = d.router;
  if (d.reasoning) state.reasoning = d.reasoning;
  state.alerts = d.alerts || state.alerts;
  if (d.engines) for (const key of Object.keys(d.engines)) {
    const t = d.engines[key];
    let e = state.engines.find(x => x.key === key);
    if (!e) { e = { key, label: key, origin: key, sessions: [] }; state.engines.push(e); state.engHist[key] = []; }
    Object.assign(e, { up: t.up ?? e.up, queue: t.queue ?? e.queue, rates: t.rates ?? e.rates, mtp: t.mtp ?? e.mtp });
    if (t.active !== undefined) e.active = t.active;
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
  if (evSeen.size > 1000) evSeen.delete(evSeen.values().next().value);
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
      src.onopen = () => { es = src; state.feed = 'sse'; feed.lastTick = performance.now(); if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } };
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
  state.router = { nodes: [{ id: 'run:sim-model', kind: 'model', label: 'sim-model', engine: 'llama', backend: '127.0.0.1:5803', up: true }], runs: [] };
  state.reasoning = { t: 0, requests: 0, thinking_tokens: 0, thinking_lines: 0, mtp_acc: 0, mtp_tot: 0, mtp_accept_pct: null, ttft_wave: [], tpot_wave: [] };
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
  const rs = state.reasoning;
  rs.requests += 1;
  rs.thinking_tokens += Math.floor(40 + R() * 320);
  rs.thinking_lines += R() < 0.4 ? 1 : 0;
  rs.mtp_acc += R() < 0.71 ? 1 : 0;
  rs.mtp_tot += 1;
  rs.mtp_accept_pct = round1(100 * rs.mtp_acc / rs.mtp_tot);
  rs.t += 1;
  pushHist(rs.ttft_wave, d.ttft, 300);
  pushHist(rs.tpot_wave, d.tpot, 300);
  feed.lastTick = performance.now();
  refreshDerived();
}

/* --- render (DOM, throttled) ---------------------------------------------- */
function round1(v) { return Math.round(v * 10) / 10; }
function fmtBig(v) {
  if (v == null || !isFinite(v)) return '—';
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
  if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
  return String(Math.round(v));
}
function cableEngines() {
  const nodes = (state.router.nodes || []).filter(n => n && n.kind === 'model');
  if (!nodes.length) return state.engines;
  return nodes.slice(0, 8).map(n => {
    const e = state.engines.find(x => (x.label || x.key) === n.label) || {};
    const lr = state.requests.find(r => (r.model || '') === n.label && r.decode_tps != null);
    return { key: n.label, label: n.label, up: n.up !== false && e.up !== false, rates: e.rates || { decode_tps: 0 }, backend: n.backend || null,
      active: e.active === true,
      lastTps: lr ? lr.decode_tps : null,
      lastAgeS: lr && lr.t ? Math.max(0, Math.round(Date.now() / 1000 - lr.t)) : null };
  });
}
function pill(label, val, s) {
  return '<span class="pill" data-s="' + s + '"><span class="dot"></span>' + label + ' · ' + val + '</span>';
}
function tempSeverity(t) {
  if (t == null || !isFinite(t)) return 'warn';
  if (t >= 85) return 'crit';
  if (t >= 70) return 'warn';
  return 'live';
}
function renderPills() {
  const bar = $('#pills');
  const up = state.engines.filter(e => e.up).length;
  const modeS = state.mode === 'live' ? 'live' : state.mode === 'demo' ? 'live' : state.mode === 'offline' ? 'crit' : 'warn';
  const q = state.kpi.queue || 0;
  const age = feed.lastTick ? performance.now() - feed.lastTick : 1e9;
  const stale = age > 8000;
  const feedS = (state.feed === 'sse' || state.feed === 'sim') && !stale ? 'live' : 'warn';
  const feedVal = state.feed + (stale ? ' · stale' : '');
  const tp = state.gpu ? state.gpu.temp : null;
  const tpVal = tp != null && isFinite(tp) ? Math.round(tp) + 'C' + (state.mode === 'demo' ? ' sim' : '') : '—';
  bar.innerHTML = '<span class="brand">HEX-LAB <small>field monitor</small></span>'
    + pill('mode', state.mode, modeS)
    + pill('feed', feedVal, feedS)
    + pill('engines', up + '/' + state.engines.length, up ? 'ok' : 'crit')
    + pill('tps', Math.round(state.kpi.tps || 0), 'live')
    + pill('temp', tpVal, tempSeverity(tp))
    + pill('queue', Math.round(q), q >= 10 ? 'crit' : q >= 4 ? 'warn' : 'ok')
    + pill('vram', (state.kpi.vram != null ? state.kpi.vram.toFixed(1) : '—') + 'G', 'live')
    + pill('nodes', (state.router.nodes || []).length, 'live')
    + pill('mtp-acc', state.reasoning && state.reasoning.mtp_accept_pct != null ? state.reasoning.mtp_accept_pct.toFixed(1) + '%' : '—', 'live')
    + pill('think', state.reasoning && state.reasoning.thinking_tokens != null ? fmtBig(state.reasoning.thinking_tokens) : '—', 'live');
}
const KPI_FMT = {
  tps: v => Math.round(v), rpm: v => Math.round(v), queue: v => Math.round(v),
  ttft: v => (v / 1000).toFixed(2) + 's', tpot: v => Math.round(v) + 'ms', p95: v => (v / 1000).toFixed(1) + 's',
  cache: v => v.toFixed(1) + '%', reingest: v => v.toFixed(1) + '%', mtp: v => v.toFixed(1) + '%', vram: v => v.toFixed(1) + 'G',
};
const KPI_PRIMARY = { tps: 1, queue: 1, vram: 1, p95: 1 };
function renderKpis() {
  $('#kpis').innerHTML = KPI_KEYS.map(k => {
    const v = state.kpi[k];
    const cls = KPI_PRIMARY[k] ? 'kpi primary' : 'kpi';
    return '<div class="' + cls + '"><div class="k">' + k + '</div><div class="v">' + (v != null && isFinite(v) ? KPI_FMT[k](v) : '—') + '</div></div>';
  }).join('');
}
function wellClass(f, i) {
  if (f >= 0.85) return 'slot well-alert' + (i === 5 ? ' hl' : '');
  if (f >= 0.6) return 'slot well-warn';
  if (f > 0.02) return 'slot well-ok';
  return 'slot well-off';
}
function renderCohort() {
  const box = $('#cohort');
  if (!box) return;
  const rows = state.sessions.slice(0, 32);
  const TOTAL = 32;
  if (!rows.length) { box.innerHTML = '<div class="slot well-off"><div>EMPTY</div></div>'; return; }
  let html = rows.map((s, i) => {
    const f = s.window ? Math.min(1, (s.used || 0) / s.window) : 0;
    const id = String(s.id || ('W' + (i + 1))).slice(0, 8).toUpperCase();
    return '<div class="' + wellClass(f, i) + '" title="' + id + ' ' + (s.used || 0) + '/' + (s.window || '?') + '"><div>' + id + '</div>'
      + '<div class="bar"><i style="width:' + (f * 100).toFixed(1) + '%"></i></div></div>';
  }).join('');
  for (let i = rows.length; i < TOTAL; i++) html += '<div class="slot well-off"><div>—</div></div>';
  box.innerHTML = html;
  const cm = $('#cohort-meta');
  if (cm) {
    const hot = rows.filter(s => s.window && (s.used || 0) / s.window >= 0.85).length;
    cm.innerHTML = '<span>PLATE 03 · <span class="m-cool">B5 FLAGGED</span></span><span>N ' + rows.length + ' · HOT ' + hot + '</span>';
  }
}
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').slice(0, 90); }
function renderLogs() {
  const ev = $('#events');
  if (ev) ev.innerHTML = state.events.slice(0, 18).map(e => '<li class="' + esc(e.level || '') + '">' + esc(e.t ? new Date(e.t * 1000).toLocaleTimeString() : '--:--:--') + ' · ' + esc(e.msg || '') + '</li>').join('');
  const rq = $('#requests');
  if (rq) rq.innerHTML = state.requests.slice(0, 12).map(r => '<li>' + esc(r.id || '?') + ' · ' + esc(r.model || '') + ' · ' + Math.round(r.decode_tps || r.tps || 0) + ' tok/s</li>').join('');
  const foot = $('#foot');
  if (foot) foot.innerHTML = '<span><span class="ft-acc">MEN_FHW</span> · MODE ' + esc(state.mode) + ' · FEED ' + esc(state.feed) + '</span><span class="ft-right">12A · ' + esc(new Date().toLocaleTimeString()) + '</span>';
  renderChrome();
}
function tcCell(k, v, cls) { return '<div class="tc-cell' + (cls ? ' ' + cls : '') + '"><span class="tc-k">' + k + '</span><span class="tc-v">' + v + '</span></div>'; }
function renderChrome() {
  const tc = $('#timecode');
  if (tc) {
    const t = new Date();
    const pad2 = n => String(n).padStart(2, '0');
    const code = pad2(t.getHours()) + ':' + pad2(t.getMinutes()) + ':' + pad2(t.getSeconds());
    const tp = state.gpu ? state.gpu.temp : null;
    const tpS = tp != null && isFinite(tp) ? Math.round(tp) + 'C' : '—';
    const tpCls = tp != null && isFinite(tp) && tp >= 85 ? 'cool' : tp != null && isFinite(tp) && tp >= 70 ? 'data' : '';
    tc.innerHTML = tcCell('TC', code) + tcCell('TPS', Math.round(state.kpi.tps || 0)) + tcCell('QUE', Math.round(state.kpi.queue || 0), 'data') + tcCell('TMP', tpS, tpCls) + tcCell('VRAM', state.kpi.vram != null ? state.kpi.vram.toFixed(1) + 'G' : '—', 'cool') + tcCell('MTP', state.reasoning && state.reasoning.mtp_accept_pct != null ? state.reasoning.mtp_accept_pct.toFixed(1) + '%' : '—') + tcCell('ENG', state.engines.filter(e => e.up).length + '/' + state.engines.length) + tcCell('FEED', state.feed, 'data');
  }
  const db = $('#databand');
  if (db) {
    const cells = KPI_KEYS.map((k, i) => {
      const v = state.kpi[k];
      const cls = i % 4 === 2 ? 'data' : i % 4 === 3 ? 'cool' : '';
      return '<div class="db-cell' + (cls ? ' ' + cls : '') + '"><span class="db-k">' + k + '</span><span class="db-v">' + (v != null && isFinite(v) ? KPI_FMT[k](v) : '—') + '</span></div>';
    });
    while (cells.length < 14) cells.push('<div class="db-cell"><span class="db-k">AUX' + cells.length + '</span><span class="db-v">—</span></div>');
    db.innerHTML = cells.slice(0, 14).join('');
  }
  const km = $('#kpi-meta');
  if (km) km.innerHTML = '<span>PEAK <span class="m-acc">' + Math.round(Math.max(1, ...((state.kpiHist.tps || [0]).slice(-120)))) + '</span> TPS</span><span>μ ' + (state.kpi.tps != null ? Math.round(state.kpi.tps) : '—') + ' · σ LOAD</span>';
  const tm = $('#terrain-meta');
  if (tm) tm.innerHTML = '<span>88 FS CC · <span class="m-acc">TERRAIN</span></span><span>ALM 01</span>';
  const hm = $('#helix-meta');
  if (hm) hm.innerHTML = '<span>ACC <span class="m-data">' + (state.reasoning && state.reasoning.mtp_accept_pct != null ? state.reasoning.mtp_accept_pct.toFixed(1) + '%' : '—') + '</span></span><span>THINK ' + (state.reasoning && state.reasoning.thinking_tokens != null ? fmtBig(state.reasoning.thinking_tokens) : '—') + '</span>';
  const gm = $('#gauge-meta');
  if (gm) {
    const u = state.gpu ? state.gpu.util : null, tp = state.gpu ? state.gpu.temp : null;
    const tCls = tp != null && isFinite(tp) && tp >= 85 ? 'm-cool' : tp != null && isFinite(tp) && tp >= 70 ? 'm-data' : 'm-acc';
    const sim = state.mode === 'demo' ? ' SIM' : '';
    gm.innerHTML = '<span>GPU <span class="m-cool">' + (u != null ? Math.round(u) + '%' : '—') + '</span></span><span>TMP <span class="' + tCls + '">' + (tp != null ? Math.round(tp) + 'C' : '—') + '</span>' + sim + '</span>';
  }
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
      if (c) {
        c.style.display = box.checked ? '' : 'none';
        const row = c.closest('.layer-row');
        if (row) row.style.opacity = box.checked ? '' : '0.35';
      }
    });
  }
}

/* --- main loop: single rAF drives all canvases; DOM at ~2 Hz --------------- */
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
let hidden = document.hidden;
document.addEventListener('visibilitychange', () => { hidden = document.hidden; });
const terrainEl = () => $('#terrain');
const helixEl = () => $('#helix');
const gaugesEl = () => $('#gauges');
let lastDom = 0, lastSim = 0, rafId = 0;
function frame(now) {
  if (!hidden) {
    if (state.mode === 'demo' && now - lastSim > 1000) { lastSim = now; demoStep(); }
    const step = REDUCED ? Math.floor(now / 500) * 500 : now;
    const hist = state.kpiHist.tps && state.kpiHist.tps.length ? state.kpiHist.tps : state.engHist[Object.keys(state.engHist)[0]] || [0];
    paintTerrain(terrainEl(), hist, step);
    const maxTps = Math.max(1, ...(hist.slice(-60)));
    paintHelix(helixEl(), (state.kpi.tps || 0) / Math.max(maxTps, state.kpi.tps || 1), state.sessions, step);
    const util = state.gpu && state.gpu.util != null ? state.gpu.util / 100 : (state.kpi.tps || 0) / Math.max(maxTps, 1);
    const tmp = state.gpu && state.gpu.temp != null ? Math.min(1, state.gpu.temp / 95) : Math.min(1, (state.kpi.p95 || 300) / 900);
    paintGauges(gaugesEl(), util, tmp, step);
    if (layerFlags.declination) paintBackdrop($('#backdrop'), state.kpiHist.tps, step);
    if (layerFlags.scopeOmega) paintScatter($('#scatter'), state.kpiHist, state.alerts, state.events, step);
    if (layerFlags.loom9) paintCables($('#cables'), cableEngines(), state.requests, step);
    if (layerFlags.safehouse) paintScopeStrip($('#scope'), state.sessions, step);
    if (now - lastDom > 500) { lastDom = now; renderText(); }
  }
  rafId = requestAnimationFrame(frame);
}

if (DEMO) initDemo(); else bootLive();
bindLayerToggles();
renderText();
requestAnimationFrame(frame);

/* layers.js — toggleable HEX-LAB field layers (Canvas 2D + rAF only, no deps).
   Each painter owns one canvas; app.js calls them from the rAF loop when
   the matching toggle in web/index.html is on. All inputs come from the
   same /api/snapshot panels as the base visual (see docs/VISUAL-MAP.md).
*/

import { fit } from './field.js';

/* Toggle flags shared with app.js (checkboxes flip these live). */
export const layerFlags = {
  declination: true, // DECLINATION field backdrop
  scopeOmega: true,  // SCOPE-OMEGA anomaly scatter
  loom9: true,       // LOOM-9 router cables
  safehouse: true,   // SAFEHOUSE scoped helix view
};

function seriesOf(v, cap = 240) {
  const a = Array.isArray(v) ? v.slice(-cap) : [];
  return a.map(x => (isFinite(x) ? x : 0));
}
function mean(a) {
  if (!a.length) return 0;
  let s = 0;
  for (const x of a) s += x;
  return s / a.length;
}
function sd(a, m) {
  if (a.length < 2) return 0;
  let s = 0;
  for (const x of a) s += (x - m) * (x - m);
  return Math.sqrt(s / (a.length - 1));
}

/* DECLINATION — ambient field wash from tps history (gpu/host baselines
   feed the same brainwave-terrain panels; wash renders drift, not traces).
   Falls back gracefully when history is empty (offline / no NVIDIA box). */
export function paintBackdrop(canvas, tpsHist, now) {
  if (!canvas) return;
  const { ctx, w, h } = fit(canvas);
  ctx.clearRect(0, 0, w, h);
  const data = seriesOf(tpsHist);
  const m = mean(data) || 1;
  const mx = Math.max(m, ...data, 1);

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0b1322');
  g.addColorStop(1, '#0d1a2b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // slow drift bands; brightness follows normalized tps level
  const bands = 5;
  for (let b = 0; b < bands; b++) {
    const f = 0.25 + 0.75 * (m / mx);
    ctx.beginPath();
    for (let i = 0; i <= 90; i++) {
      const x = (i / 90) * w;
      const v = data.length ? data[Math.floor((i / 90) * (data.length - 1))] / mx : 0.3;
      const y = h * (0.2 + 0.15 * b)
        - Math.sin(i * 0.12 + now / 1400 + b * 1.9) * h * 0.05
        - v * h * 0.10;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = b % 2 ? 'rgba(157,140,255,0.35)' : 'rgba(95,214,255,0.35)';
    ctx.globalAlpha = 0.25 + 0.45 * f * (1 - b / (bands + 1));
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/* SCOPE-OMEGA — anomaly scatter: KPI excursions (queue, vram, p95, ttft)
   as dots over recent history, fired alerts as top-row diamonds, and
   warn/err/alert events as bottom ticks. */
const SCATTER_KEYS = [
  { k: 'queue', c: '#f7c76a' },
  { k: 'vram', c: '#ff8a7a' },
  { k: 'p95', c: '#9d8cff' },
  { k: 'ttft', c: '#5fd6ff' },
];
export function paintScatter(canvas, kpiHist, alerts, events, now) {
  if (!canvas) return;
  const { ctx, w, h } = fit(canvas);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0b1322';
  ctx.fillRect(0, 0, w, h);

  const N = 60, pad = 14;
  const iw = w - pad * 2, ih = h - pad * 2 - 22; // room for alert/event rails
  const top = pad + 10, bot = top + ih;
  for (const { k, c } of SCATTER_KEYS) {
    const data = seriesOf(kpiHist ? kpiHist[k] : null, N);
    if (!data.length) continue;
    const m = mean(data), s = sd(data, m) || Math.max(Math.abs(m) * 0.05, 1e-6);
    const lo = Math.min(...data, m - 3 * s), hi = Math.max(...data, m + 3 * s);
    const span = Math.max(hi - lo, 1e-6);
    data.forEach((v, i) => {
      const z = (v - m) / s;
      const hot = Math.abs(z) > 2;
      const x = pad + (i / Math.max(N - 1, 1)) * iw;
      const y = bot - ((v - lo) / span) * ih;
      const pulse = hot ? 1 + 0.25 * Math.sin(now / 240 + i) : 0;
      ctx.beginPath();
      ctx.arc(x, y, (hot ? 3.4 : 1.8) * pulse, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.globalAlpha = hot ? 0.95 : 0.45;
      ctx.fill();
      if (hot) {
        ctx.beginPath();
        ctx.arc(x, y, 6 * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = c;
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
  }

  // alerts rail: one diamond per fired alert (top)
  const al = Array.isArray(alerts) ? alerts.slice(0, 24) : [];
  al.forEach((a, i) => {
    const x = pad + (i / Math.max(al.length - 1, 1)) * iw;
    const y = 7, r = 4;
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
    ctx.closePath();
    const s = String(a && a.severity ? a.severity : a || '');
    ctx.fillStyle = /crit|err|vram|temp/i.test(s) ? '#ff8a7a' : '#f7c76a';
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(now / 300 + i * 1.3);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // events rail: warn/err/alert ticks (bottom)
  const evs = (Array.isArray(events) ? events : [])
    .filter(e => e && /warn|err|alert/i.test(e.level || ''))
    .slice(0, 40);
  evs.forEach((e, i) => {
    const x = pad + (i / Math.max(evs.length - 1, 1)) * iw;
    ctx.fillStyle = /err|alert/i.test(e.level || '') ? '#ff8a7a' : '#f7c76a';
    ctx.globalAlpha = 0.8;
    ctx.fillRect(x, h - 6, 2, 4);
    ctx.globalAlpha = 1;
  });
}

/* LOOM-9 — router cables: left router/engine nodes to a right cohort
   grid. One cable per engine; thickness from decode rate, label from
   engine/model name; recent requests pulse the matching cable. */
export function paintCables(canvas, engines, requests, now) {
  if (!canvas) return;
  const { ctx, w, h } = fit(canvas);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0b1322';
  ctx.fillRect(0, 0, w, h);

  const engs = (Array.isArray(engines) ? engines : []).slice(0, 8);
  const reqs = Array.isArray(requests) ? requests.slice(0, 12) : [];
  if (!engs.length) {
    ctx.fillStyle = '#5fd6ff';
    ctx.globalAlpha = 0.7;
    ctx.font = '12px monospace';
    ctx.fillText('loom-9 · no engines claimed', 12, 20);
    ctx.globalAlpha = 1;
    return;
  }
  const lx = 90, rx = w - 70;
  const maxRate = Math.max(1, ...engs.map(e => (e.rates && e.rates.decode_tps) || e.rate || 0));
  const cols = ['#5fd6ff', '#9d8cff', '#6fe7ad', '#f7c76a'];
  engs.forEach((e, i) => {
    const y1 = 18 + (i / Math.max(engs.length - 1, 1)) * (h - 36);
    const rate = (e.rates && e.rates.decode_tps) || e.rate || 0;
    const thick = 1 + 4 * (rate / maxRate);
    const hits = reqs.filter(r => (r.model || r.engine || '') === (e.label || e.key)).length;
    // grid slots on the right: 3 per engine
    for (let sIdx = 0; sIdx < 3; sIdx++) {
      const y2 = Math.min(h - 12, Math.max(12, y1 + (sIdx - 1) * 12));
      const mx = (lx + rx) / 2;
      ctx.beginPath();
      ctx.moveTo(lx, y1);
      ctx.bezierCurveTo(mx, y1, mx, y2, rx, y2);
      ctx.strokeStyle = cols[i % cols.length];
      ctx.globalAlpha = e.up === false ? 0.15 : 0.35 + 0.4 * (rate / maxRate);
      ctx.lineWidth = thick * (sIdx === 1 ? 1 : 0.5);
      ctx.setLineDash(sIdx === 1 && hits ? [6, 4] : []);
      ctx.lineDashOffset = -now / 60;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = cols[i % cols.length];
      ctx.fillRect(rx - 3, y2 - 3, 14, 6);
    }
    // router node
    ctx.beginPath();
    ctx.arc(lx - 14, y1, 7, 0, Math.PI * 2);
    ctx.fillStyle = e.up === false ? '#3a4a5a' : cols[i % cols.length];
    ctx.globalAlpha = e.up === false ? 0.6 : 0.95;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#c9d6e2';
    ctx.font = '11px monospace';
    ctx.fillText(String(e.label || e.key || 'engine').slice(0, 18), 4, y1 - 11);
    ctx.fillStyle = '#7d8fa3';
    ctx.fillText(Math.round(rate) + ' t/s', lx - 14 - 16, y1 + 20);
  });
}

/* SAFEHOUSE — scoped helix view from sessions: same engines/strata
   panels as helix/cohort, rendered as an isolated dimmed "room" with a
   muted palette so scoped reasoning stays visually separate. */
export function paintScopeStrip(canvas, sessions, now) {
  if (!canvas) return;
  const { ctx, w, h } = fit(canvas);
  ctx.clearRect(0, 0, w, h);
  // dimmed room
  ctx.fillStyle = '#0e141d';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(125,143,163,0.5)';
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 5]);
  ctx.strokeRect(4.5, 4.5, w - 9, h - 9);
  ctx.setLineDash([]);
  ctx.fillStyle = '#7d8fa3';
  ctx.font = '11px monospace';
  ctx.fillText('safehouse · scoped view', 12, 20);

  const rows = (Array.isArray(sessions) ? sessions : []).slice(0, 10);
  if (!rows.length) {
    ctx.fillStyle = '#3a4a5a';
    ctx.font = '12px monospace';
    ctx.fillText('scoped · no sessions', 12, h / 2);
    return;
  }
  const y0 = 32, rh = Math.min(26, (h - y0 - 10) / rows.length);
  rows.forEach((s, i) => {
    const y = y0 + i * rh;
    const f = s.window ? Math.max(0, Math.min(1, (s.used || 0) / s.window)) : 0;
    const sway = 0.5 + 0.5 * Math.sin(now / 800 + i * 0.9);
    // mini rung
    ctx.strokeStyle = 'rgba(125,143,163,' + (0.25 + 0.35 * sway * f).toFixed(2) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(12, y + rh / 2);
    ctx.lineTo(12 + 26 * (0.4 + 0.6 * sway), y + rh / 2);
    ctx.stroke();
    // muted usage bar
    ctx.fillStyle = '#232f3d';
    ctx.fillRect(46, y + 3, w - 46 - 90, rh - 8);
    ctx.fillStyle = i % 2 ? '#4a5a73' : '#3f6b7a';
    ctx.globalAlpha = 0.75;
    ctx.fillRect(46, y + 3, (w - 46 - 90) * f, rh - 8);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#7d8fa3';
    ctx.font = '10px monospace';
    ctx.fillText(String(s.id || 'sess').slice(0, 16), w - 82, y + rh / 2 + 3);
  });
}

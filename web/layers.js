/* layers.js — toggleable HEX-LAB field layers (Canvas 2D + rAF only, no deps). */

import { fit } from './field.js';

export const layerFlags = {
  declination: true,
  scopeOmega: true,
  loom9: true,
  safehouse: true,
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

/* DECLINATION — ambient drift wash in lab teal, brightness from tps level. */
export function paintBackdrop(canvas, tpsHist, now) {
  if (!canvas) return;
  const { ctx, w, h } = fit(canvas);
  ctx.clearRect(0, 0, w, h);
  const data = seriesOf(tpsHist);
  const m = mean(data) || 1;
  const mx = Math.max(m, ...data, 1);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0a2632');
  g.addColorStop(1, '#051820');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(0,224,224,0.10)';
  ctx.lineWidth = 1;
  for (let gx = 0; gx < w; gx += 16) {
    ctx.beginPath(); ctx.moveTo(gx + 0.5, 0); ctx.lineTo(gx + 0.5, h); ctx.stroke();
  }
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
    ctx.strokeStyle = b % 2 ? 'rgba(255,64,192,0.35)' : 'rgba(0,224,224,0.45)';
    ctx.globalAlpha = 0.25 + 0.45 * f * (1 - b / (bands + 1));
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = 'rgba(0,224,224,0.8)';
  ctx.font = '8px monospace';
  ctx.fillText('DECL · μ ' + m.toFixed(0), 8, 12);
}

/* SCOPE-OMEGA — anomaly scatter in cyan/amber/pink/purple coding. */
const SCATTER_KEYS = [
  { k: 'queue', c: '#f0dc50' },
  { k: 'vram', c: '#ff8a7a' },
  { k: 'p95', c: '#c040e0' },
  { k: 'ttft', c: '#00e0e0' },
];
export function paintScatter(canvas, kpiHist, alerts, events, now) {
  if (!canvas) return;
  const { ctx, w, h } = fit(canvas);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#071b24';
  ctx.fillRect(0, 0, w, h);
  const N = 60, pad = 14;
  const iw = w - pad * 2, ih = h - pad * 2 - 22;
  const top = pad + 10, bot = top + ih;
  ctx.strokeStyle = 'rgba(0,224,224,0.12)';
  ctx.lineWidth = 1;
  for (let r = 0; r <= 3; r++) {
    const y = top + (r / 3) * ih;
    ctx.beginPath(); ctx.moveTo(pad, y + 0.5); ctx.lineTo(w - pad, y + 0.5); ctx.stroke();
  }
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
      ctx.arc(x, y, (hot ? 3.4 : 2.1) * Math.max(pulse, 0.6), 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.globalAlpha = hot ? 0.95 : 0.62;
      ctx.fill();
      if (hot) {
        ctx.beginPath();
        ctx.arc(x, y, 6 * Math.max(pulse, 0.6), 0, Math.PI * 2);
        ctx.strokeStyle = c;
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
    ctx.globalAlpha = 1;
  }
  const al = Array.isArray(alerts) ? alerts.slice(0, 24) : [];
  al.forEach((a, i) => {
    const x = pad + (i / Math.max(al.length - 1, 1)) * iw;
    const y = 7, r = 4;
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
    ctx.closePath();
    const s = String(a && a.severity ? a.severity : a || '');
    ctx.fillStyle = /crit|err|vram|temp/i.test(s) ? '#ff8a7a' : '#f0dc50';
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(now / 300 + i * 1.3);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
  const evs = (Array.isArray(events) ? events : [])
    .filter(e => e && /warn|err|alert/i.test(e.level || ''))
    .slice(0, 40);
  evs.forEach((e, i) => {
    const x = pad + (i / Math.max(evs.length - 1, 1)) * iw;
    ctx.fillStyle = /err|alert/i.test(e.level || '') ? '#ff40c0' : '#f0dc50';
    ctx.globalAlpha = 0.8;
    ctx.fillRect(x, h - 6, 2, 4);
    ctx.globalAlpha = 1;
  });
  ctx.fillStyle = 'rgba(0,224,224,0.8)';
  ctx.font = '8px monospace';
  ctx.fillText('Ω SCATTER', 8, h - 9);
}

/* LOOM-9 — router cables: source rail left, bundle spine mid, target rail right.
   One lane record per engine keeps geometry stable across frames. Dots ride
   the primary trace so live flow reads without extra particles. */
export function paintCables(canvas, engines, requests, now) {
  if (!canvas) return;
  const { ctx, w, h } = fit(canvas);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#071b24';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(0,224,224,0.08)';
  ctx.lineWidth = 1;
  for (let gx = 12; gx < w - 8; gx += 18) {
    ctx.beginPath(); ctx.moveTo(gx + 0.5, 8); ctx.lineTo(gx + 0.5, h - 8); ctx.stroke();
  }
  const engs = (Array.isArray(engines) ? engines : []).slice(0, 8);
  const reqs = Array.isArray(requests) ? requests.slice(0, 24) : [];
  const pad = 16, top = 24, bot = h - 22;
  const lx = Math.max(84, Math.min(110, w * 0.16));
  const rx = w - Math.max(64, Math.min(96, w * 0.14));
  const mx = (lx + rx) / 2;
  const cols = ['#00e0e0', '#ff40c0', '#6fe7ad', '#f0dc50'];
  ctx.fillStyle = 'rgba(0,224,224,0.8)';
  ctx.font = '8px monospace';
  ctx.fillText('LOOM-9 · ' + engs.length + ' CABLES', 8, 12);
  if (!engs.length) {
    ctx.strokeStyle = 'rgba(0,224,224,0.25)';
    ctx.setLineDash([6, 5]);
    ctx.strokeRect(lx, top, rx - lx, Math.max(20, bot - top));
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(0,224,224,0.7)';
    ctx.font = '11px monospace';
    ctx.fillText('loom-9 · no engines claimed', 12, top + 18);
    ctx.fillStyle = '#5a8488';
    ctx.font = '8px monospace';
    ctx.fillText('EMPTY · WAITING FOR ROUTER NODES', 12, top + 32);
    return;
  }
  const maxRate = Math.max(1, ...engs.map(e => (e.rates && e.rates.decode_tps) || e.rate || 0));
  ctx.strokeStyle = 'rgba(216,240,240,0.22)';
  ctx.lineWidth = 1;
  [lx, mx, rx].forEach(x => {
    ctx.beginPath(); ctx.moveTo(x + 0.5, top - 6); ctx.lineTo(x + 0.5, bot + 6); ctx.stroke();
  });
  ctx.fillStyle = '#5a8488';
  ctx.font = '8px monospace';
  ctx.fillText('SRC', lx - 10, top - 9);
  ctx.fillText('BUNDLE', mx - 20, top - 9);
  ctx.fillText('DST', rx - 6, top - 9);
  const laneY = i => top + (engs.length < 2 ? 0.5 : i / (engs.length - 1)) * (bot - top);
  engs.forEach((e, i) => {
    const col = cols[i % cols.length];
    const rate = (e.rates && e.rates.decode_tps) || e.rate || 0;
    const frac = rate / maxRate;
    const down = e.up === false;
    const y1 = laneY(i);
    const hits = reqs.filter(r => (r.model || r.engine || '') === (e.label || e.key)).length;
    const lanes = engs.length < 3 ? 3 : 2;
    const spread = Math.min(26, (bot - top) / Math.max(engs.length * 2, 4));
    for (let s = 0; s < lanes; s++) {
      const primary = s === 0;
      const off = (s - (lanes - 1) / 2) * spread * 0.9;
      const y2 = Math.min(bot, Math.max(top, y1 + off));
      const by = y1 + off * 0.35;
      ctx.beginPath();
      ctx.moveTo(lx, y1);
      ctx.bezierCurveTo((lx + mx) / 2, y1, (lx + mx) / 2, by, mx, by);
      ctx.bezierCurveTo((mx + rx) / 2, by, (mx + rx) / 2, y2, rx, y2);
      ctx.strokeStyle = col;
      ctx.globalAlpha = down ? 0.12 : primary ? 0.55 + 0.4 * frac : 0.22 + 0.18 * frac;
      ctx.lineWidth = primary ? 1.4 + 2.4 * frac : 1;
      ctx.setLineDash(!primary && hits ? [5, 5] : []);
      ctx.lineDashOffset = -now / 70;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      if (primary) {
        ctx.fillStyle = col;
        ctx.globalAlpha = down ? 0.4 : 0.9;
        ctx.fillRect(rx - 2, y2 - 4, 12, 8);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(5,24,32,0.9)';
        ctx.lineWidth = 1;
        ctx.strokeRect(rx - 2.5, y2 - 4.5, 13, 9);
      }
    }
    ctx.beginPath();
    ctx.arc(lx - 16, y1, 7, 0, Math.PI * 2);
    ctx.fillStyle = down ? '#3a4a5a' : col;
    ctx.globalAlpha = down ? 0.55 : 0.95;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(5,24,32,0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (!down) {
      ctx.beginPath();
      ctx.arc(lx - 16, y1, 10 + Math.sin(now / 500 + i * 1.7) * 1.2, 0, Math.PI * 2);
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (!down && rate > 0) {
      const p = ((now / (1400 - Math.min(1100, frac * 1100))) + i * 0.37) % 1;
      const bx = (1 - p) * (1 - p) * (1 - p) * lx + 3 * (1 - p) * (1 - p) * p * ((lx + mx) / 2) + 3 * (1 - p) * p * p * ((mx + rx) / 2) + p * p * p * rx;
      const byy = (1 - p) * (1 - p) * (1 - p) * y1 + 3 * (1 - p) * (1 - p) * p * y1 + 3 * (1 - p) * p * p * y1 + p * p * p * y1;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(bx, byy, 2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#d8f0f0';
    ctx.font = '10px monospace';
    ctx.fillText(String(e.label || e.key || 'engine').slice(0, 16), 4, Math.max(10, y1 - 12));
    ctx.fillStyle = down ? '#3a4a5a' : '#5a8488';
    ctx.font = '8px monospace';
    ctx.fillText(down ? 'DOWN' : Math.round(rate) + ' t/s' + (hits ? ' · ' + hits + ' req' : ''), lx - 34, Math.min(h - 4, y1 + 20));
    const dst = String(e.backend || e.label || e.key || '').split('/').pop().slice(-14);
    if (dst) {
      ctx.fillStyle = '#5a8488';
      ctx.fillText(dst, rx - 8, Math.min(h - 4, Math.min(bot, Math.max(top, y1)) + 18));
    }
  });
}

/* SAFEHOUSE — scoped dimmed room, muted teal/grey palette. */
export function paintScopeStrip(canvas, sessions, now) {
  if (!canvas) return;
  const { ctx, w, h } = fit(canvas);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#08141b';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(90,132,136,0.5)';
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 5]);
  ctx.strokeRect(4.5, 4.5, w - 9, h - 9);
  ctx.setLineDash([]);
  ctx.fillStyle = '#5a8488';
  ctx.font = '10px monospace';
  ctx.fillText('safehouse · scoped view', 12, 20);
  const rows = (Array.isArray(sessions) ? sessions : []).slice(0, 10);
  if (!rows.length) {
    ctx.fillStyle = '#3a4a5a';
    ctx.font = '11px monospace';
    ctx.fillText('scoped · no sessions', 12, h / 2);
    return;
  }
  const y0 = 32, rh = Math.min(26, (h - y0 - 10) / rows.length);
  rows.forEach((s, i) => {
    const y = y0 + i * rh;
    const f = s.window ? Math.max(0, Math.min(1, (s.used || 0) / s.window)) : 0;
    const sway = 0.5 + 0.5 * Math.sin(now / 800 + i * 0.9);
    ctx.strokeStyle = 'rgba(0,224,224,' + (0.25 + 0.35 * sway * f).toFixed(2) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(12, y + rh / 2);
    ctx.lineTo(12 + 26 * (0.4 + 0.6 * sway), y + rh / 2);
    ctx.stroke();
    ctx.fillStyle = '#14202a';
    ctx.fillRect(46, y + 3, w - 46 - 90, rh - 8);
    ctx.fillStyle = i % 2 ? '#4a5a73' : '#1c6b74';
    ctx.globalAlpha = 0.8;
    ctx.fillRect(46, y + 3, (w - 46 - 90) * f, rh - 8);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#5a8488';
    ctx.font = '9px monospace';
    ctx.fillText(String(s.id || 'sess').slice(0, 16), w - 82, y + rh / 2 + 3);
  });
}

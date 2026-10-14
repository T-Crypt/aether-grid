/* field.js — Canvas 2D painters for HEX-LAB. rAF-driven, no deps. */

export function fit(c) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = c.clientWidth || 600, h = c.clientHeight || 220;
  const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

/* Skin palette: brand hues come from CSS vars so each skin repaints the
   canvases. Refreshed about once a second; severity hues stay absolute. */
let palCache = null, palN = 0;
let morph = null;
function parseTriple(str) {
  if (!str) return null;
  const p = String(str).trim().split(/[\s,]+/).map(x => parseInt(x, 10));
  if (p.length < 3) return null;
  const t = [p[0], p[1], p[2]];
  for (let i = 0; i < 3; i++) if (!isFinite(t[i])) return null;
  return t;
}
export function morphPal(from, duration) {
  const parsed = { acc: parseTriple(from.acc), dat: parseTriple(from.dat), col: parseTriple(from.col) };
  morph = duration > 0 ? { from: parsed, t0: performance.now(), dur: duration } : null;
  palCache = null;
}
export function pal() {
  if (morph) {
    const now = performance.now();
    const k = morph.dur ? Math.min(1, (now - morph.t0) / morph.dur) : 1;
    const g = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const to = { acc: parseTriple(g('--acc')), dat: parseTriple(g('--dat')), col: parseTriple(g('--col')) };
    const rgba = (t, a) => 'rgb(' + (t || '0 224 224') + ' / ' + a + ')';
    const mix = (f, t) => {
      if (f && t) return k >= 1 ? t.join(' ') : f.map((c, i) => Math.round(c + (t[i] - c) * k)).join(' ');
      return t ? t.join(' ') : null;
    };
    palCache = {
      accent: g('--p-accent') || '#8f7bff', data: g('--p-data') || '#6fe7ad',
      cool: g('--p-cool') || '#ff5c8a', mint: g('--ser-3') || '#6fe7ad',
      text: g('--p-text') || '#dce6ff', dim: g('--p-dim') || '#647294',
      panel: g('--p-panel') || '#0c1226', bg: g('--p-bg') || '#060a14',
      acc: a => rgba(mix(morph.from.acc, to.acc), a),
      dat: a => rgba(mix(morph.from.dat, to.dat), a),
      col: a => rgba(mix(morph.from.col, to.col), a),
    };
    if (k >= 1) morph = null;
    return palCache;
  }
  if (palCache && (palN++ % 60)) return palCache;
  const g = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const acc = g('--acc'), dat = g('--dat'), col = g('--col');
  const rgba = (t, a) => 'rgb(' + (t || '0 224 224') + ' / ' + a + ')';
  palCache = {
    accent: g('--p-accent') || '#8f7bff', data: g('--p-data') || '#6fe7ad',
    cool: g('--p-cool') || '#ff5c8a', mint: g('--ser-3') || '#6fe7ad',
    text: g('--p-text') || '#dce6ff', dim: g('--p-dim') || '#647294',
    panel: g('--p-panel') || '#0c1226', bg: g('--p-bg') || '#060a14',
    acc: a => rgba(acc, a), dat: a => rgba(dat, a), col: a => rgba(col, a),
  };
  return palCache;
}

/* Brainwave terrain: tilted wireframe mesh, z from history + slow phase.
   History drives elevation so live telemetry reads in the surface. */
export function paintTerrain(canvas, series, t) {
  if (!canvas) return;
  const { ctx, w, h } = fit(canvas);
  const P = pal();
  ctx.clearRect(0, 0, w, h);
  const data = (Array.isArray(series) && series.length ? series : [0]).slice(-240);
  const max = Math.max(1, ...data);
  const COLS = 16, ROWS = 11;
  const phase = t / 2600;
  const padX = 14, padY = 12;
  const meshW = w - padX * 2, meshH = h - padY * 2;
  const pts = [];
  for (let j = 0; j < ROWS; j++) {
    const row = [];
    for (let i = 0; i < COLS; i++) {
      const u = i / (COLS - 1), v = j / (ROWS - 1);
      const di = Math.floor(u * (data.length - 1));
      const dv = data.length ? (data[di] || 0) / max : 0.3;
      const z = dv * 0.55
        + Math.sin(u * Math.PI * 2 + phase * Math.PI * 2) * 0.10
        + Math.cos(v * Math.PI * 1.6 + phase * Math.PI) * 0.08
        + Math.sin((u + v) * Math.PI * 2 + phase * 2.2) * 0.06;
      const skew = -0.30 * meshW;
      const x = padX + u * meshW + (v - 0.5) * skew;
      const y = padY + (1 - v) * meshH * 0.12 + (1 - v) * meshH * 0.62 - z * meshH * 0.42;
      row.push([x, y, z]);
    }
    pts.push(row);
  }
  ctx.lineWidth = 1;
  for (let j = 0; j < ROWS; j++) {
    ctx.beginPath();
    for (let i = 0; i < COLS; i++) {
      const [x, y] = pts[j][i];
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    const front = j === ROWS - 1;
    ctx.lineWidth = front ? 1.5 : 1;
    ctx.strokeStyle = front ? P.acc(0.95) : P.acc(0.42);
    ctx.stroke();
  }
  ctx.strokeStyle = P.acc(0.30);
  for (let i = 0; i < COLS; i++) {
    ctx.beginPath();
    for (let j = 0; j < ROWS; j++) {
      const [x, y] = pts[j][i];
      if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const fx = pts[ROWS - 1][Math.floor(COLS * 0.62)];
  ctx.fillStyle = P.data;
  ctx.beginPath(); ctx.arc(fx[0], fx[1], 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(216,240,240,0.55)';
  ctx.font = '8px monospace';
  ctx.fillText('PK ' + max.toFixed(0), Math.min(w - 52, fx[0] + 6), Math.max(10, fx[1] - 6));
}

/* Helix reasoning: coiled double strand in pink/yellow, rungs follow load. */
export function paintHelix(canvas, load, sessions, t) {
  if (!canvas) return;
  const { ctx, w, h } = fit(canvas);
  const P = pal();
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, amp = Math.min(w * 0.30, 150);
  const rungs = Math.max(8, Math.min(22, (sessions && sessions.length) || 12));
  const l = Math.max(0, Math.min(1, load || 0));
  const ft = t / 900;
  for (let i = 0; i < rungs; i++) {
    const y = 14 + (i / (rungs - 1)) * (h - 28);
    const p = ft + i * 0.48;
    const x1 = cx + Math.sin(p) * amp, x2 = cx - Math.sin(p) * amp;
    const front = Math.cos(p) > 0;
    const glow = 0.25 + 0.75 * (0.35 + 0.65 * l) * (0.5 + 0.5 * Math.sin(p * 2));
    ctx.strokeStyle = front ? P.col(glow.toFixed(2)) : P.dat((glow * 0.8).toFixed(2));
    ctx.lineWidth = front ? 1.6 : 1;
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
    ctx.fillStyle = front ? P.cool : P.data;
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(x1, y, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x2, y, 2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  const strands = [[0, P.cool, 2.2], [Math.PI, P.data, 2.2]];
  for (const [s, col, lw] of strands) {
    ctx.beginPath();
    for (let i = 0; i <= 90; i++) {
      const y = 14 + (i / 90) * (h - 28);
      const x = cx + Math.sin(ft + (i / 90) * (rungs - 1) * 0.48 + s) * amp;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.globalAlpha = 0.9; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = 'rgba(90,132,136,0.9)';
  ctx.font = '8px monospace';
  ctx.fillText('LD ' + (l * 100).toFixed(0) + '% · N ' + rungs, 8, 12);
  ctx.fillStyle = P.dat(0.85);
  ctx.fillText('SHE_10N', w - 52, h - 8);
}

/* Gauges: two triangular sweep gauges for temp/psi style readings. */
export function paintGauges(canvas, a, b, t) {
  if (!canvas) return;
  const { ctx, w, h } = fit(canvas);
  const P = pal();
  ctx.clearRect(0, 0, w, h);
  const cells = [
    { label: 'TMP', frac: b, col: P.accent, unit: 'C', scale: 95 },
    { label: 'PSI', frac: a, col: P.data, unit: '%', scale: 100 },
  ];
  const cw = w / 2;
  cells.forEach((g, idx) => {
    const x0 = idx * cw + cw / 2, y0 = h - 40;
    const R = Math.min(cw * 0.36, 52);
    const f = Math.max(0, Math.min(1, g.frac == null ? 0.4 : g.frac));
    const col = g.label === 'TMP'
      ? (f * 95 >= 85 ? '#ff5c7a' : f * 95 >= 70 ? '#f0dc50' : P.accent)
      : g.col;
    ctx.strokeStyle = 'rgba(216,240,240,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0 - R, y0); ctx.lineTo(x0, y0 - R * 1.15); ctx.lineTo(x0 + R, y0); ctx.closePath(); ctx.stroke();
    const segs = 12;
    for (let i = 0; i < segs; i++) {
      const on = i / segs < f;
      const a0 = Math.PI + (i / segs) * Math.PI;
      const a1 = Math.PI + ((i + 0.8) / segs) * Math.PI;
      ctx.strokeStyle = on ? col : 'rgba(90,132,136,0.30)';
      ctx.globalAlpha = on ? 0.95 : 1;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(x0, y0, R * 0.72, a0, a1);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const na = Math.PI + f * Math.PI + Math.sin(t / 700 + idx * 2) * 0.03;
    ctx.strokeStyle = '#d8f0f0'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + Math.cos(na) * R * 0.72, y0 + Math.sin(na) * R * 0.72); ctx.stroke();
    ctx.fillStyle = col; ctx.font = '8px monospace';
    ctx.fillText(g.label, x0 - 10, h - 26);
    ctx.fillStyle = '#f2fafa';
    ctx.font = 'bold 13px monospace';
    const big = g.label === 'TMP' ? Math.round(f * 95) + 'C' : Math.round(f * 100) + '%';
    ctx.fillText(big, x0 - 14, h - 11);
  });
}

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

/* Brainwave terrain: layered ridgelines from a 1 Hz history series. */
export function paintTerrain(canvas, series, t) {
  const { ctx, w, h } = fit(canvas);
  ctx.clearRect(0, 0, w, h);
  const layers = 4;
  const cols = ['#5fd6ff', '#9d8cff', '#6fe7ad', '#f7c76a'];
  const data = (Array.isArray(series) && series.length ? series : [0]).slice(-240);
  const max = Math.max(1, ...data);
  for (let L = 0; L < layers; L++) {
    const yBase = h * (0.30 + 0.20 * L);
    const amp = h * (0.16 - 0.025 * L);
    ctx.beginPath();
    const n = 120;
    for (let i = 0; i <= n; i++) {
      const di = Math.floor((i / n) * (data.length - 1));
      const v = (data[di] || 0) / max;
      const x = (i / n) * w;
      const wob = Math.sin(i * 0.35 + t / 500 + L * 1.7) * 0.5 + Math.sin(i * 0.11 - t / 900 + L) * 0.5;
      const y = yBase - v * amp * 1.6 - wob * amp * 0.35;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = cols[L % cols.length];
    ctx.globalAlpha = 0.9 - L * 0.18;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.globalAlpha = 0.10 - L * 0.015;
    ctx.fillStyle = cols[L % cols.length];
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/* Helix reasoning: double-helix ladder; rung brightness follows load 0..1. */
export function paintHelix(canvas, load, sessions, t) {
  const { ctx, w, h } = fit(canvas);
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, amp = Math.min(w * 0.30, 150);
  const rungs = Math.max(6, Math.min(24, (sessions && sessions.length) || 12));
  const l = Math.max(0, Math.min(1, load || 0));
  const ft = t / 700;
  // rungs
  for (let i = 0; i < rungs; i++) {
    const y = 12 + (i / (rungs - 1)) * (h - 24);
    const p = ft + i * 0.45;
    const x1 = cx + Math.sin(p) * amp, x2 = cx - Math.sin(p) * amp;
    const glow = 0.25 + 0.75 * l * (0.5 + 0.5 * Math.sin(p * 2));
    ctx.strokeStyle = 'rgba(95,214,255,' + glow.toFixed(2) + ')';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  }
  // strands
  for (const s of [0, Math.PI]) {
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) {
      const y = 12 + (i / 80) * (h - 24);
      const x = cx + Math.sin(ft + (i / 80) * (rungs - 1) * 0.45 + s) * amp;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = s === 0 ? '#9d8cff' : '#6fe7ad';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

import * as THREE from 'three';

export const BRUSH_FONT = '"Ma Shan Zheng","STKaiti","Kaiti SC","KaiTi","BiauKai",serif';

function cv(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
function tex(c, srgb) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

// Ensō-like brush ring, white on transparent
export function brushRingCanvas(S = 256, seed = 7, o = {}) {
  const [c, g] = cv(S, S); const R = rng(seed);
  const cx = S / 2, cy = S / 2, rad = S * (o.rad ?? 0.37);
  const a0 = o.a0 ?? -2.3, sweep = o.sweep ?? 5.7;
  const W = S * (o.w ?? 0.075);
  const N = 520, B = 22, br = [];
  for (let b = 0; b < B; b++) br.push({ o: b / (B - 1) - 0.5, ink: 0.55 + R() * 0.45, dry: 0.42 + R() * 0.58, r: 0.6 + R() * 0.7 });
  g.fillStyle = '#fff';
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const a = a0 + sweep * t;
    const press = Math.min(1, t * 10) * (1 - 0.72 * Math.pow(t, 2.4));
    const w = W * (0.32 + 0.68 * press);
    const rr = rad + Math.sin(t * 7 + 1) * S * 0.008;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    const nx = Math.cos(a), ny = Math.sin(a);
    for (const b of br) {
      if (t > b.dry && R() < (t - b.dry) * 3.2) continue;
      g.globalAlpha = 0.17 * b.ink;
      g.beginPath(); g.arc(x + nx * b.o * w, y + ny * b.o * w, Math.max(0.7, w * 0.055 * b.r + 0.6), 0, 6.2832); g.fill();
    }
  }
  g.globalAlpha = 1;
  return c;
}
export function brushRingTexture(seed) { return tex(brushRingCanvas(256, seed)); }

// 2x2 atlas of ink splats (white on transparent)
export function inkSplatTexture() {
  const S = 512, H = 256; const [c, g] = cv(S, S); const R = rng(91);
  g.fillStyle = '#fff';
  const circ = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); };
  for (let k = 0; k < 4; k++) {
    const cx = (k % 2) * H + H / 2, cy = Math.floor(k / 2) * H + H / 2;
    const base = 40 + R() * 18;
    g.globalAlpha = 0.85;
    for (let i = 0; i < 28; i++) { const a = R() * 6.2832, d = R() * base * 0.55; circ(cx + Math.cos(a) * d, cy + Math.sin(a) * d, base * (0.3 + R() * 0.42)); }
    g.globalAlpha = 1;
    for (let i = 0; i < 16; i++) {
      const a = R() * 6.2832; let d = base * (0.85 + R() * 0.5); let r = 3 + R() * 6.5;
      const n = 1 + Math.floor(R() * 3);
      for (let j = 0; j < n && d < 112; j++) { circ(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r); d += r * 2.4 + R() * 7; r *= 0.62; }
    }
    for (let i = 0; i < 5; i++) {
      const a = R() * 6.2832, d = base * 0.75;
      g.save(); g.translate(cx + Math.cos(a) * d, cy + Math.sin(a) * d); g.rotate(a);
      g.beginPath(); g.ellipse(14, 0, 20 + R() * 22, 3 + R() * 4, 0, 0, 6.2832); g.fill(); g.restore();
    }
  }
  return tex(c);
}

// 2 cumulus puffs, rgb = lighting (1 lit, 0 shade), a = coverage
export function cloudTexture() {
  const W = 512, H = 256; const [c, g] = cv(W, H); const R = rng(17);
  for (let v = 0; v < 2; v++) {
    const cx = v * 256 + 128, cy = 158;
    for (let i = 0; i < 46; i++) {
      const sx = (R() - 0.5) * 2;
      const x = cx + sx * 92 * (0.6 + R() * 0.4);
      const y = cy - Math.pow(R(), 1.4) * 70 * (1 - Math.abs(sx) * 0.55) + 6;
      const r = (24 + R() * 40) * (1 - Math.abs(sx) * 0.35);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)');
      gr.addColorStop(0.55, 'rgba(255,255,255,0.32)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
    }
  }
  g.globalCompositeOperation = 'source-atop';
  const lg = g.createLinearGradient(0, 70, 0, 220);
  lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.75)');
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  return tex(c);
}

// Talisman atlas: 3 strips of 128x384 in a 384x384 canvas
export function talismanTexture() {
  const S = 384; const [c, g] = cv(S, S); const R = rng(5);
  const glyphs = [['敕', '令', '鬼'], ['镇', '邪', '魂'], ['幽', '冥', '煞']];
  for (let v = 0; v < 3; v++) {
    const x0 = v * 128;
    g.save(); g.beginPath();
    const pts = [];
    for (let i = 0; i <= 12; i++) pts.push([x0 + 6 + i * (116 / 12), 4 + R() * 4]);
    for (let i = 0; i <= 30; i++) pts.push([x0 + 120 + (R() - 0.5) * 3, 6 + i * (372 / 30)]);
    for (let i = 12; i >= 0; i--) pts.push([x0 + 6 + i * (116 / 12), 378 - R() * 5]);
    for (let i = 30; i >= 0; i--) pts.push([x0 + 7 + (R() - 0.5) * 3, 6 + i * (372 / 30)]);
    g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); g.closePath();
    g.fillStyle = '#e2bd5f'; g.fill(); g.clip();
    for (let i = 0; i < 260; i++) {
      g.fillStyle = R() < 0.5 ? 'rgba(120,80,20,0.07)' : 'rgba(255,240,190,0.08)';
      g.fillRect(x0 + R() * 128, R() * 384, 1 + R() * 3, 6 + R() * 30);
    }
    const vg = g.createRadialGradient(x0 + 64, 192, 40, x0 + 64, 192, 230);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(90,50,10,0.45)');
    g.fillStyle = vg; g.fillRect(x0, 0, 128, 384);
    g.strokeStyle = '#b12a1c'; g.lineWidth = 3; g.strokeRect(x0 + 12, 12, 104, 360);
    g.lineWidth = 1.2; g.strokeRect(x0 + 17, 17, 94, 350);
    g.fillStyle = '#b12a1c'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `52px ${BRUSH_FONT}`;
    g.fillText(glyphs[v][0], x0 + 64, 58);
    g.fillText(glyphs[v][1], x0 + 64, 116);
    // talisman script squiggle
    g.lineCap = 'round'; g.lineJoin = 'round';
    let y = 152, x = x0 + 64;
    g.beginPath(); g.moveTo(x, y);
    for (let i = 0; i < 7; i++) {
      const nx = x0 + 64 + (R() - 0.5) * 60, ny = y + 18 + R() * 8;
      g.bezierCurveTo(x + (R() - 0.5) * 70, y + 6, nx + (R() - 0.5) * 70, ny - 6, nx, ny);
      x = nx; y = ny;
    }
    g.lineWidth = 4.2; g.stroke();
    g.beginPath(); g.arc(x0 + 64, 316, 22, 0, 6.2832); g.lineWidth = 3; g.stroke();
    g.font = `30px ${BRUSH_FONT}`; g.fillText(glyphs[v][2], x0 + 64, 318);
    g.restore();
  }
  return tex(c, true);
}

// Lantern paper wrap 512x128
export function lanternTexture() {
  const W = 512, H = 128; const [c, g] = cv(W, H); const R = rng(23);
  const lg = g.createLinearGradient(0, 0, 0, H);
  lg.addColorStop(0, '#5a0d0a'); lg.addColorStop(0.25, '#c42a19'); lg.addColorStop(0.5, '#f05a2a'); lg.addColorStop(0.75, '#c42a19'); lg.addColorStop(1, '#5a0d0a');
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,${180 + R() * 60 | 0},120,${0.03 + R() * 0.05})`; g.fillRect(R() * W, R() * H, 2 + R() * 6, 1 + R() * 2); }
  g.fillStyle = 'rgba(40,5,5,0.55)';
  for (let i = 0; i < 16; i++) g.fillRect(i * 32 - 1, 0, 2.5, H);
  g.fillStyle = 'rgba(20,4,4,0.92)'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `70px ${BRUSH_FONT}`;
  g.fillText('冥', 128, 68); g.fillText('鬼', 384, 68);
  return tex(c, true);
}

// Red sigil (for boss seals) white glyph on red disc; alpha = coverage
export function sigilTexture(ch = '封') {
  const S = 256; const [c, g] = cv(S, S); const R = rng(31);
  g.translate(S / 2, S / 2);
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#ffffff';
  g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 112, 0, 6.2832); g.stroke();
  g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, 98, 0, 6.2832); g.stroke();
  for (let i = 0; i < 24; i++) {
    g.save(); g.rotate(i / 24 * 6.2832); g.fillRect(-2, -110, 4, i % 2 ? 9 : 16); g.restore();
  }
  for (let i = 0; i < 8; i++) {
    g.save(); g.rotate(i / 8 * 6.2832 + 0.2);
    g.beginPath(); g.moveTo(0, -94); g.lineTo(9, -78); g.lineTo(0, -70); g.lineTo(-9, -78); g.closePath(); g.fill(); g.restore();
  }
  g.font = `128px ${BRUSH_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(ch, 0, 8);
  return tex(c);
}

// Seal stamp into an existing canvas (UI)
export function drawSeal(canvas, chars, o = {}) {
  const S = canvas.width; const g = canvas.getContext('2d'); const R = rng(o.seed || 11);
  g.clearRect(0, 0, S, S);
  const red = o.color || '#b8321f';
  const pad = S * 0.07, rr = S * 0.1;
  g.fillStyle = red;
  g.beginPath();
  g.moveTo(pad + rr, pad); g.lineTo(S - pad - rr, pad); g.quadraticCurveTo(S - pad, pad, S - pad, pad + rr);
  g.lineTo(S - pad, S - pad - rr); g.quadraticCurveTo(S - pad, S - pad, S - pad - rr, S - pad);
  g.lineTo(pad + rr, S - pad); g.quadraticCurveTo(pad, S - pad, pad, S - pad - rr);
  g.lineTo(pad, pad + rr); g.quadraticCurveTo(pad, pad, pad + rr, pad); g.closePath(); g.fill();
  g.fillStyle = o.ink || '#f6efe3'; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (chars.length === 1) {
    g.font = `${Math.round(S * 0.66)}px ${BRUSH_FONT}`; g.fillText(chars, S / 2, S * 0.53);
  } else if (chars.length === 2) {
    g.font = `${Math.round(S * 0.4)}px ${BRUSH_FONT}`;
    g.fillText(chars[0], S / 2, S * 0.3); g.fillText(chars[1], S / 2, S * 0.72);
  } else {
    g.font = `${Math.round(S * 0.36)}px ${BRUSH_FONT}`;
    g.fillText(chars[0], S * 0.69, S * 0.3); g.fillText(chars[1], S * 0.69, S * 0.72);
    g.fillText(chars[2], S * 0.31, S * 0.3); if (chars[3]) g.fillText(chars[3], S * 0.31, S * 0.72);
  }
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < S * 1.4; i++) { g.globalAlpha = 0.25 + R() * 0.6; g.beginPath(); g.arc(R() * S, R() * S, R() * S * 0.012 + 0.3, 0, 6.2832); g.fill(); }
  for (let i = 0; i < 14; i++) {
    const side = Math.floor(R() * 4), p = R() * S, r = S * (0.015 + R() * 0.03);
    const x = side === 0 ? p : side === 1 ? S - pad : side === 2 ? p : pad;
    const y = side === 0 ? pad : side === 1 ? p : side === 2 ? S - pad : p;
    g.globalAlpha = 1; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

// Dry brush stroke (button background) -> dataURL
export function brushStrokeURL(w = 440, h = 150, seed = 3, color = '#15181d') {
  const [c, g] = cv(w, h); const R = rng(seed);
  const B = 46, br = [];
  for (let b = 0; b < B; b++) br.push({ o: b / (B - 1) - 0.5, ink: 0.5 + R() * 0.5, dry: 0.55 + R() * 0.45, r: 0.6 + R() * 0.8 });
  g.fillStyle = color;
  const N = 380;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const x = w * 0.05 + t * w * 0.9;
    const y = h * 0.52 + Math.sin(t * 3.1 + 0.4) * h * 0.04;
    const press = Math.min(1, t * 7) * (1 - 0.45 * Math.pow(t, 3));
    const ww = h * 0.62 * (0.55 + 0.45 * press);
    for (const b of br) {
      if (t > b.dry && R() < (t - b.dry) * 4) continue;
      g.globalAlpha = 0.2 * b.ink;
      g.beginPath(); g.arc(x + (R() - 0.5) * 2, y + b.o * ww, Math.max(0.8, ww * 0.03 * b.r + 1), 0, 6.2832); g.fill();
    }
  }
  g.globalAlpha = 1;
  return c.toDataURL('image/png');
}

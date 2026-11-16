import { AudioEngine } from './audio.js';
import { STEP } from './config.js';

async function render(sections, extraSfx) {
  const sr = 44100;
  const total = sections.reduce((a, s) => a + s.bars * 16 * STEP, 0) + 3;
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * total), sr);
  const A = new AudioEngine();
  A.init(ctx);
  A.bus = A.makeBus(A.musicFilter);
  let T = 0.05;
  const marks = [];
  for (const sec of sections) {
    A.song = [[0, sec.id]]; A.override = null; A.mel = null; A.lastRoot = null;
    marks.push([sec.id, T]);
    for (let st = 0; st < sec.bars * 16; st++) A.doStep(st, T + st * STEP);
    if (extraSfx) {
      for (let k = 0; k < sec.bars; k++) {
        const base = T + k * 2.0 + 0.5;
        A.now = () => base;
        for (let i = 0; i < 8; i++) { A.now = () => base + i * 0.08; A.lock(i, 0); }
        for (let i = 0; i < 8; i++) A.launch(base + 0.8 + i * STEP, i, (i - 4) / 6);
        for (let i = 0; i < 8; i++) { A.now = () => base + 1.2 + i * STEP; A.impact(['talisman', 'fish', 'lantern', 'disc', 'wisp', 'fish', 'talisman', 'orb'][i], 0); }
      }
    }
    T += sec.bars * 16 * STEP;
  }
  const buf = await ctx.startRendering();
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  let peak = 0; const rms = [];
  for (let s = 0; s < Math.floor(buf.duration); s++) {
    let acc = 0, pk = 0;
    for (let i = s * sr; i < (s + 1) * sr && i < L.length; i++) { const v = Math.max(Math.abs(L[i]), Math.abs(R[i])); acc += L[i] * L[i]; if (v > pk) pk = v; }
    rms.push([+Math.sqrt(acc / sr).toFixed(3), +pk.toFixed(3)]); if (pk > peak) peak = pk;
  }
  // 16-bit wav
  const n = L.length; const wav = new DataView(new ArrayBuffer(44 + n * 4));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) wav.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); wav.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 2, true);
  wav.setUint32(24, sr, true); wav.setUint32(28, sr * 4, true); wav.setUint16(32, 4, true); wav.setUint16(34, 16, true); w(36, 'data'); wav.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) { wav.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); wav.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
  const bytes = new Uint8Array(wav.buffer); let bin = '';
  for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
  return { peak, rms, marks, wav: btoa(bin) };
}
window.__renderAudio = render;
window.__ready = true;
window.__pitchTest = async (midis) => {
  const sr = 44100; const out = [];
  for (const m of midis) {
    const ctx = new OfflineAudioContext(1, sr * 1.0, sr);
    const A = new AudioEngine(); A.init(ctx); A.bus = A.makeBus(A.musicFilter);
    A.zheng(m, 0.0, 0.5, { rev: 0, dly: 0, bus: A.bus });
    const buf = await ctx.startRendering(); const x = buf.getChannelData(0);
    // autocorrelation pitch on 0.1..0.6s
    const s0 = Math.floor(0.1 * sr), N = Math.floor(0.4 * sr);
    const f0 = 440 * Math.pow(2, (m - 69) / 12);
    const lagE = sr / f0; let best = 0, bl = 0;
    for (let lag = Math.floor(lagE * 0.9); lag <= Math.ceil(lagE * 1.1); lag++) {
      let acc = 0; for (let i = 0; i < N; i++) acc += x[s0 + i] * x[s0 + i + lag];
      if (acc > best) { best = acc; bl = lag; }
    }
    // parabolic interpolation
    const ac = l => { let a = 0; for (let i = 0; i < N; i++) a += x[s0 + i] * x[s0 + i + l]; return a; };
    const y0 = ac(bl - 1), y1 = ac(bl), y2 = ac(bl + 1);
    const d = (y0 - y2) / (2 * (y0 - 2 * y1 + y2));
    const f = sr / (bl + d);
    out.push([m, +f0.toFixed(2), +f.toFixed(2), +(1200 * Math.log2(f / f0)).toFixed(1)]);
  }
  return out;
};

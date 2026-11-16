import { STEP, BEAT, BAR, setTempo } from './config.js';

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const PENT = [11, 2, 4, 6, 9]; // B minor pentatonic (zheng tuned in D)
export const LADDER = [];
for (let m = 35; m <= 100; m++) if (PENT.includes(m % 12)) LADDER.push(m);
function lidx(m) { let b = 0; for (let i = 0; i < LADDER.length; i++) if (LADDER[i] <= m) b = i; return b; }

const ROOTS = {
  B: { bass: 35, anchor: 59, pad: [59, 62, 66, 71] },
  G: { bass: 31, anchor: 59, pad: [55, 59, 62, 66] },
  D: { bass: 38, anchor: 62, pad: [57, 62, 66, 69] },
  A: { bass: 33, anchor: 57, pad: [57, 64, 69, 71] },
  E: { bass: 40, anchor: 64, pad: [59, 64, 67, 71] },
  'F#': { bass: 42, anchor: 66, pad: [54, 57, 61, 66] },
};
const R1 = ['B', 'B', 'G', 'G', 'D', 'D', 'A', 'A'];
const R2 = ['D', 'D', 'B', 'B', 'G', 'G', 'A', 'A'];
const R3 = ['B', 'B', 'G', 'G', 'E', 'E', 'F#', 'F#'];
const RB = ['B', 'B', 'G', 'A', 'B', 'B', 'E', 'F#'];
const RB2 = ['B', 'G', 'E', 'F#'];
const RE = ['D', 'D', 'A', 'A', 'B', 'B', 'G', 'G', 'D', 'D', 'D', 'D'];

const PAT = {
  taikoA: [1, 0, 0, 0, 0, 0, 0, 0, .75, 0, 0, 0, 0, 0, 0, 0],
  taikoB: [1, 0, 0, 0, 0, 0, .45, 0, .8, 0, 0, 0, 0, 0, .4, 0],
  taikoC: [1, 0, 0, .4, 0, 0, .7, 0, .9, 0, 0, .45, 0, .3, .6, 0],
  taikoD: [1, 0, .3, 0, .6, 0, .3, 0, .95, 0, .3, 0, .6, 0, .4, .5],
  shimeA: [0, 0, 0, 0, .6, 0, 0, 0, 0, 0, 0, 0, .6, 0, 0, .25],
  shimeB: [0, 0, .2, 0, .7, 0, .2, .2, 0, .2, .2, 0, .7, 0, .3, .3],
  woodA: [0, 0, .5, 0, 0, 0, .5, 0, 0, 0, .5, 0, 0, 0, .5, 0],
  woodB: [.6, .2, .4, .2, .6, .2, .4, .2, .6, .2, .4, .2, .6, .3, .5, .3],
  heart: [1, 0, 0, .6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  pulse: [.55, 0, 0, 0, .3, 0, 0, 0, .4, 0, 0, 0, .3, 0, 0, 0],
  tick: [.7, 0, 0, 0, .5, 0, 0, 0, .6, 0, 0, 0, .5, 0, 0, 0],
};
const ZH = {
  sparse: [[0, 0], [6, 2], [10, 4], [13, 3]],
  arp8: [[0, 0], [2, 2], [4, 4], [6, 5], [8, 4], [10, 2], [12, 3], [14, 1]],
  arp16: [[0, 0], [1, 2], [2, 4], [3, 2], [4, 5], [5, 4], [6, 2], [7, 4], [8, 0], [9, 2], [10, 4], [11, 7], [12, 5], [13, 4], [14, 2], [15, 1]],
  ost: [[0, 0], [1, 0], [2, 3], [3, 0], [4, 0], [5, 2], [6, 0], [7, 4], [8, 0], [9, 0], [10, 3], [11, 0], [12, 5], [13, 4], [14, 2], [15, 1]],
};
const BASS = {
  s1: [[0, 1], [6, .6], [10, .7]],
  s2: [[0, 1], [3, .6], [6, .8], [8, .9], [11, .6], [14, .7]],
  drive: [[0, 1], [2, .55], [4, .8], [6, .55], [8, 1], [10, .55], [12, .8], [14, .7]],
  long: [[0, 1]],
};
const MEL = {
  intro: [[0, 78, 8], [8, 76, 4], [12, 74, 4], [16, 71, 12], [28, 69, 4], [32, 74, 8], [40, 76, 4], [44, 78, 4], [48, 81, 16], [64, 83, 8], [72, 81, 4], [76, 78, 4], [80, 76, 8], [88, 74, 8], [96, 76, 6], [102, 78, 2], [104, 76, 4], [108, 74, 4], [112, 71, 16]],
  s2: [[0, 81, 4], [4, 83, 4], [8, 81, 4], [12, 78, 4], [16, 76, 8], [24, 74, 8], [32, 76, 4], [36, 78, 4], [40, 81, 4], [44, 83, 4], [48, 86, 16], [64, 83, 4], [68, 81, 4], [72, 78, 8], [80, 76, 4], [84, 78, 4], [88, 76, 4], [92, 74, 4], [96, 71, 8], [104, 74, 8], [112, 76, 16]],
  s3: [[0, 71, 4], [4, 74, 4], [8, 76, 8], [16, 78, 12], [28, 76, 4], [32, 74, 8], [40, 71, 8], [48, 69, 12], [60, 71, 4], [64, 74, 4], [68, 76, 4], [72, 78, 8], [80, 81, 8], [88, 78, 8], [96, 76, 8], [104, 74, 4], [108, 76, 4], [112, 78, 16]],
  ending: [[0, 81, 8], [8, 83, 4], [12, 81, 4], [16, 78, 8], [24, 76, 4], [28, 74, 4], [32, 76, 8], [40, 78, 4], [44, 81, 4], [48, 83, 16], [64, 86, 8], [72, 83, 4], [76, 81, 4], [80, 78, 6], [86, 81, 2], [88, 76, 8], [96, 74, 16], [112, 74, 24]],
  fail: [[0, 71, 8], [8, 69, 8], [16, 66, 16], [32, 64, 12], [44, 66, 4], [48, 59, 28]],
};

const SEC = {
  title: { roots: R1, pad: .1, bass: 'long', bassVel: .2, zheng: 'sparse', zvel: .2, melody: 'intro', melAt: 4, melEvery: 16 },
  tutor: { roots: R1, pad: .09, bass: 'long', bassVel: .2, taiko: 'pulse', tvel: .5, wood: 'tick', zheng: 'sparse', zvel: .1, melody: 'intro', melAt: 8, melEvery: 16 },
  intro: { roots: R1, pad: .1, bass: 'long', bassVel: .24, zheng: 'sparse', zvel: .22, melody: 'intro', melAt: 0, custom: (lb, st, t, M) => { if (lb === 3 && st === 0) M.riser(t, BAR, 0.16); if (lb === 3 && st >= 8) M.taiko(t, 0.2 + (st - 8) * 0.08, { f: 120, decay: 0.3 }); } },
  s1a: { roots: R1, pad: .08, bass: 's1', bassVel: .38, taiko: 'taikoA', wood: 'woodA', zheng: 'arp8', zvel: .13, crash: true },
  s1b: { roots: R1, pad: .08, bass: 's1', bassVel: .4, taiko: 'taikoB', shime: 'shimeA', wood: 'woodA', zheng: 'arp8', zvel: .14, crash: true },
  s1c: { roots: R1, pad: .08, bass: 's1', bassVel: .4, taiko: 'taikoB', shime: 'shimeB', wood: 'woodB', zheng: 'arp16', zvel: .11, custom: (lb, st, t, M) => { if (lb === 3) M.roll(st, t); if (lb === 3 && st === 0) M.riser(t, BAR, 0.18); } },
  s2i: { roots: R2, pad: .11, bass: 'long', bassVel: .28, zheng: 'sparse', zvel: .24, melody: 's2', melAt: 0, crash: true, gongAt0: true },
  s2: { roots: R2, pad: .07, bass: 's2', bassVel: .4, taiko: 'taikoC', shime: 'shimeB', wood: 'woodB', zheng: 'arp16', zvel: .1, crash: true, melody: 's2', melAt: 8, melEvery: 16 },
  s2c: { roots: R2, pad: .08, bass: 's2', bassVel: .4, taiko: 'taikoC', shime: 'shimeB', wood: 'woodB', zheng: 'arp16', zvel: .11, custom: (lb, st, t, M) => { M.tremolo(lb, st, t); if (lb === 3) M.roll(st, t); if (lb === 3 && st === 0) M.riser(t, BAR, 0.2); } },
  s3i: { roots: R3, pad: .12, bass: 'long', bassVel: .3, zheng: 'sparse', zvel: .2, melody: 's3', melAt: 0, gongAt0: true },
  s3: { roots: R3, pad: .08, bass: 'drive', bassVel: .38, taiko: 'taikoD', shime: 'shimeB', wood: 'woodB', zheng: 'ost', zvel: .1, crash: true, gongEvery: 8, melody: 's3', melAt: 8, melEvery: 16 },
  pre: { roots: ['B', 'B', 'B', 'B'], pad: .1, bass: 'long', bassVel: .34, heart: true, custom: (lb, st, t, M) => { if (st === 0 && lb === 0) M.longyin(t, 0.16, M.bus); if (lb === 3) M.roll(st, t); if (lb === 3 && st === 0) M.riser(t, BAR, 0.22); } },
  boss: { roots: RB, pad: .07, bass: 'drive', bassVel: .42, taiko: 'taikoD', shime: 'shimeB', wood: 'woodB', zheng: 'ost', zvel: .11, crash: true, gongEvery: 4 },
  boss2: { roots: RB2, pad: .08, bass: 'drive', bassVel: .45, taiko: 'taikoD', shime: 'shimeB', wood: 'woodB', zheng: 'arp16', zvel: .11, crash: true, gongEvery: 2, custom: (lb, st, t, M) => { if (st % 2 === 1) M.taiko(t, 0.18, { f: 140, decay: 0.15 }); } },
  ending: { roots: RE, pad: .12, bass: 'long', bassVel: .28, zheng: 'arp8', zvel: .18, taiko: 'taikoA', tvel: .45, melody: 'ending', melAt: 0, gongAt0: true },
  fail: { roots: ['B', 'G', 'B', 'B'], pad: .09, bass: 'long', bassVel: .22, melody: 'fail', melAt: 0 },
};
// A song is a list of segments [startBar, slot]. A slot plays its recorded track when one is loaded,
// otherwise the procedural sections listed in FALLBACK (or the SEC section of the same name).
const PLANS = {
  title: [[0, 'calm']],
  tutor: [[0, 'tutor']],
  game: [[0, 'stage1'], [48, 'stage3'], [68, 'pre'], [72, 'boss']],
  ending: [[0, 'ending']],
  fail: [[0, 'fail']],
};
const FALLBACK = {
  calm: [[0, 'title']], tutor: [[0, 'tutor']],
  stage1: [[0, 'intro'], [4, 's1a'], [12, 's1b'], [20, 's1c'], [24, 's2i'], [28, 's2'], [44, 's2c']],
  stage2: [[0, 's2i'], [4, 's2'], [20, 's2c']],
  stage3: [[0, 's3i'], [4, 's3']],
  boss: [[0, 'boss']], ending: [[0, 'ending']], fail: [[0, 'fail']],
};

export class AudioEngine {
  constructor() {
    this.ctx = null; this.muted = false; this.events = []; this.song = null; this.songId = 0;
    this.override = null; this.ks = new Map(); this.root = 'B'; this.timer = null;
    this.slots = {}; this.segs = null; this.curSeg = null; this.track = null; this.transpose = 0;
    this.fbBase = performance.now(); this.fbPaused = 0; this.fbPauseAt = 0; this.paused = false;
  }
  now() {
    if (this.ctx && !this.fallback) return this.ctx.currentTime;
    const p = this.paused ? this.fbPauseAt : performance.now();
    return (p - this.fbBase - this.fbPaused) / 1000;
  }
  latency() { return this.ctx && !this.fallback ? (this.ctx.outputLatency || this.ctx.baseLatency || 0) : 0; }
  // if the audio clock is stuck (blocked autoplay), keep the game running on a JS clock
  useFallbackClock() {
    if (this.fallback) return;
    const t = this.ctx ? this.ctx.currentTime : this.now();
    this.fallback = true; this.paused = false; this.fbPaused = 0;
    this.fbBase = performance.now() - t * 1000;
  }
  watch(realMs, playing) {
    if (this.fallback || !this.ctx || this.paused || !playing) { this.wLast = null; return; }
    const t = this.ctx.currentTime;
    if (this.wLast == null || t !== this.wT) { this.wLast = realMs; this.wT = t; return; }
    if (realMs - this.wLast > 900) this.useFallbackClock();
  }

  init(offline) {
    if (this.ctx) { if (this.ctx.state !== 'running' && !this.offline) this.ctx.resume().catch(() => {}); return; }
    let ctx = offline;
    if (!ctx) {
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* ignore */ }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { return; } }
    }
    this.ctx = ctx; this.offline = !!offline;
    if (!offline) {
      try { const b = ctx.createBuffer(1, 1, 22050); const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) { /* ignore */ }
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
    }
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.musicFilter = ctx.createBiquadFilter(); this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 20000; this.musicFilter.Q.value = 0.6;
    this.musicGain = ctx.createGain(); this.musicGain.gain.value = 0.8;
    this.musicFilter.connect(this.musicGain); this.musicGain.connect(this.master);
    this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(3.4, 2.4);
    this.verbIn = ctx.createGain(); this.verbIn.connect(this.verb);
    const vOut = ctx.createGain(); vOut.gain.value = 0.5; this.verb.connect(vOut); vOut.connect(this.master);
    this.dly = ctx.createDelay(1.5); this.dly.delayTime.value = BEAT * 0.75;
    const fbk = ctx.createGain(); fbk.gain.value = 0.3;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
    this.dlyIn = ctx.createGain(); this.dlyIn.connect(this.dly); this.dly.connect(dlp); dlp.connect(fbk); fbk.connect(this.dly);
    const dOut = ctx.createGain(); dOut.gain.value = 0.32; dlp.connect(dOut); dOut.connect(this.master);
    this.sfx = this.makeBus(this.master, 1);
    this.noiseBuf = this.makeNoise(2.5);
    const imag = new Float32Array([0, 1, 0.42, 0.55, 0.18, 0.3, 0.08, 0.15, 0.05, 0.08, 0.03]);
    this.reed = ctx.createPeriodicWave(new Float32Array(imag.length), imag);
    // pre-render plucked strings in small chunks
    const todo = [];
    for (const m of LADDER) if (m >= 47 && m <= 95) todo.push(m);
    for (const m of [31, 33, 35, 38, 40, 42, 43, 45]) todo.push(m);
    const work = () => { for (let k = 0; k < 3 && todo.length; k++) this.ksBuf(todo.shift()); if (todo.length) setTimeout(work, 0); };
    if (!offline) setTimeout(work, 0);
  }

  makeNoise(sec) {
    const ctx = this.ctx; const len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(1, len, ctx.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  impulse(sec, decay) {
    const ctx = this.ctx; const sr = ctx.sampleRate, len = Math.floor(sr * sec);
    const b = ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < len; i++) {
        const k = i / len;
        const x = (Math.random() * 2 - 1) * Math.pow(1 - k, decay);
        lp += (x - lp) * (0.85 - 0.75 * k);
        d[i] = i < sr * 0.012 ? 0 : lp;
      }
    }
    return b;
  }
  makeBus(dest, g = 1) {
    const ctx = this.ctx;
    const dry = ctx.createGain(); dry.gain.value = g; dry.connect(dest);
    const rev = ctx.createGain(); rev.gain.value = g; rev.connect(this.verbIn);
    const dly = ctx.createGain(); dly.gain.value = g; dly.connect(this.dlyIn);
    return { dry, rev, dly };
  }
  fadeBus(bus, t, dur = 0.4) {
    for (const k of ['dry', 'rev', 'dly']) { bus[k].gain.cancelScheduledValues(t); bus[k].gain.setTargetAtTime(0, t, dur / 3); }
    setTimeout(() => { try { bus.dry.disconnect(); bus.rev.disconnect(); bus.dly.disconnect(); } catch (e) { /* ignore */ } }, (dur + 8) * 1000);
  }
  out(node, bus, pan = 0, rev = 0.2, dly = 0) {
    const ctx = this.ctx; let n = node;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); n.connect(p); n = p; }
    n.connect(bus.dry);
    if (rev > 0) { const g = ctx.createGain(); g.gain.value = rev; n.connect(g); g.connect(bus.rev); }
    if (dly > 0) { const g = ctx.createGain(); g.gain.value = dly; n.connect(g); g.connect(bus.dly); }
  }
  noise(t, dur) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const off = Math.random() * Math.max(0, this.noiseBuf.duration - dur - 0.05);
    s.start(t, off, dur + 0.02);
    return s;
  }

  // ------------------------------------------------ instruments
  ksBuf(m) {
    m = Math.round(m);
    let b = this.ks.get(m); if (b) return b;
    const ctx = this.ctx; const sr = ctx.sampleRate; const f = mtof(m);
    const dur = Math.min(3.6, 0.9 + 130 / f);
    const len = Math.floor(sr * dur);
    b = ctx.createBuffer(1, len, sr); const o = b.getChannelData(0);
    const S = 0.36; const D = sr / f - S; const Di = Math.floor(D), fr = D - Di; const N = Di + 2;
    let lp = 0, mean = 0;
    for (let i = 0; i < N && i < len; i++) { const x = Math.random() * 2 - 1; lp += (x - lp) * 0.6; o[i] = lp; mean += lp; }
    mean /= N; for (let i = 0; i < N && i < len; i++) o[i] -= mean;
    const T60 = Math.max(0.6, Math.min(4.2, 2.7 * Math.pow(220 / f, 0.5)));
    const rho = Math.pow(0.001, 1 / (f * T60));
    for (let i = N; i < len; i++) {
      const a = o[i - Di] * (1 - fr) + o[i - Di - 1] * fr;
      const c = o[i - Di - 1] * (1 - fr) + o[i - Di - 2] * fr;
      o[i] = rho * ((1 - S) * a + S * c);
    }
    let pk = 0; for (let i = 0; i < len; i++) { const v = Math.abs(o[i]); if (v > pk) pk = v; }
    const g = 0.8 / (pk || 1);
    for (let i = 0; i < len; i++) o[i] *= g;
    for (let i = 0; i < 24 && i < len; i++) o[i] *= i / 24;
    const fo = Math.min(len, Math.floor(sr * 0.06)); for (let i = 0; i < fo; i++) o[len - 1 - i] *= i / fo;
    this.ks.set(m, b);
    return b;
  }
  zheng(m, t, vel = 0.3, o = {}) {
    const ctx = this.ctx; if (!ctx || this.fallback) return;
    const buf = this.ksBuf(m);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = vel;
    let end = t + buf.duration;
    if (o.dur) { g.gain.setValueAtTime(vel, t + o.dur); g.gain.setTargetAtTime(0, t + o.dur, 0.07); end = Math.min(end, t + o.dur + 0.45); }
    if (o.bend) { src.playbackRate.setValueAtTime(Math.pow(2, -o.bend / 12), t); src.playbackRate.setTargetAtTime(1, t + 0.01, 0.035); }
    if (o.vib) {
      const l = ctx.createOscillator(); l.frequency.value = 5.2; const lg = ctx.createGain();
      lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(o.vib, t + 0.4); l.connect(lg); lg.connect(src.playbackRate); l.start(t); l.stop(end);
    }
    let node = src;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; src.connect(f); node = f; }
    node.connect(g);
    this.out(g, o.bus || this.bus || this.sfx, o.pan || 0, o.rev ?? 0.22, o.dly ?? 0);
    src.start(t); src.stop(end);
  }
  taiko(t, vel = 0.8, o = {}) {
    const ctx = this.ctx; if (!ctx || this.fallback) return;
    const f0 = o.f || 92, dec = o.decay || 0.9, bus = o.bus || this.bus || this.sfx;
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(f0 * 2.2, t); osc.frequency.exponentialRampToValueAtTime(f0, t + 0.035); osc.frequency.exponentialRampToValueAtTime(f0 * 0.72, t + dec);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    osc.connect(g);
    const o2 = ctx.createOscillator(); o2.type = 'triangle';
    o2.frequency.setValueAtTime(f0 * 2.6, t); o2.frequency.exponentialRampToValueAtTime(f0 * 1.5, t + 0.2);
    const g2 = ctx.createGain(); g2.gain.setValueAtTime(vel * 0.3, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); o2.connect(g2);
    const n = this.noise(t, 0.09); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = o.slap || 1100; bp.Q.value = 0.8;
    const g3 = ctx.createGain(); g3.gain.setValueAtTime(vel * 0.5, t); g3.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    n.connect(bp); bp.connect(g3);
    const mix = ctx.createGain(); g.connect(mix); g2.connect(mix); g3.connect(mix);
    this.out(mix, bus, o.pan || 0, o.rev ?? 0.26, 0);
    osc.start(t); osc.stop(t + dec + 0.05); o2.start(t); o2.stop(t + 0.25);
  }
  wood(t, vel = 0.3, o = {}) {
    const ctx = this.ctx; if (!ctx || this.fallback) return;
    const f = o.f || 1150;
    const osc = ctx.createOscillator(); osc.frequency.setValueAtTime(f * 1.1, t); osc.frequency.exponentialRampToValueAtTime(f, t + 0.012);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    const o2 = ctx.createOscillator(); o2.frequency.value = f * 1.58;
    const g2 = ctx.createGain(); g2.gain.setValueAtTime(vel * 0.4, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    osc.connect(g); o2.connect(g2); const mix = ctx.createGain(); g.connect(mix); g2.connect(mix);
    this.out(mix, o.bus || this.bus || this.sfx, o.pan ?? (Math.random() * 0.5 - 0.25), o.rev ?? 0.12, 0);
    osc.start(t); osc.stop(t + 0.1); o2.start(t); o2.stop(t + 0.05);
  }
  cymbal(t, vel = 0.2, dur = 1.8, o = {}) {
    const ctx = this.ctx; if (!ctx || this.fallback) return;
    const n = this.noise(t, dur);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
    const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 8500; pk.gain.value = 6;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(hp); hp.connect(pk); pk.connect(g);
    this.out(g, o.bus || this.bus || this.sfx, o.pan || 0, 0.35, 0);
  }
  gong(t, vel = 0.4, o = {}) {
    const ctx = this.ctx; if (!ctx || this.fallback) return;
    const f = o.f || 92, dur = o.dur || 4.5;
    const ratios = [1, 1.47, 1.98, 2.44, 2.97, 3.63, 4.2], amps = [1, .55, .45, .32, .22, .15, .1];
    const mix = ctx.createGain(); mix.gain.value = vel;
    ratios.forEach((r, i) => {
      const osc = ctx.createOscillator(); const fr = f * r;
      osc.frequency.setValueAtTime(fr * (o.up ? 0.96 : 1.03), t); osc.frequency.exponentialRampToValueAtTime(fr, t + 1.3);
      const g = ctx.createGain(); const d = dur * (1 - i * 0.1);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amps[i], t + 0.012 + i * 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      osc.connect(g); g.connect(mix); osc.start(t); osc.stop(t + d + 0.05);
    });
    const n = this.noise(t, 0.3); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.35, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    n.connect(lp); lp.connect(ng); ng.connect(mix);
    this.out(mix, o.bus || this.bus || this.sfx, o.pan || 0, o.rev ?? 0.55, 0);
  }
  bell(m, t, vel = 0.12, o = {}) {
    const ctx = this.ctx; if (!ctx || this.fallback) return;
    const f = mtof(m), dur = o.dur || 1.3;
    const car = ctx.createOscillator(); car.frequency.value = f;
    const mod = ctx.createOscillator(); mod.frequency.value = f * 3.5;
    const mg = ctx.createGain(); mg.gain.setValueAtTime(f * 2.0, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.6);
    mod.connect(mg); mg.connect(car.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(g);
    this.out(g, o.bus || this.sfx, o.pan || 0, o.rev ?? 0.3, o.dly ?? 0.12);
    car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
  }
  flute(m, t, dur, vel = 0.1, o = {}) {
    const ctx = this.ctx; if (!ctx || this.fallback) return;
    const f = mtof(m), bus = o.bus || this.bus || this.sfx;
    const osc = ctx.createOscillator();
    const grace = o.grace ?? (Math.random() < 0.35);
    if (grace) { osc.frequency.setValueAtTime(f * 0.89, t); osc.frequency.exponentialRampToValueAtTime(f, t + 0.06); } else osc.frequency.setValueAtTime(f, t);
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.setValueAtTime(f * 2, t);
    const g2 = ctx.createGain(); g2.gain.value = 0.16;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.3;
    const lg = ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.0065, t + Math.min(0.45, dur * 0.6));
    lfo.connect(lg); lg.connect(osc.frequency);
    const lg2 = ctx.createGain(); lg2.gain.value = 2; lg.connect(lg2); lg2.connect(o2.frequency);
    const n = this.noise(t, dur + 0.25);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(9000, f * 2.2); bp.Q.value = 2.5;
    const ng = ctx.createGain(); ng.gain.value = 0.22; n.connect(bp); bp.connect(ng);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(vel, t + 0.07);
    env.gain.setValueAtTime(vel, t + Math.max(0.08, dur - 0.08)); env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
    osc.connect(env); o2.connect(g2); g2.connect(env); ng.connect(env);
    this.out(env, bus, o.pan || 0, o.rev ?? 0.45, o.dly ?? 0.16);
    const end = t + dur + 0.25;
    osc.start(t); o2.start(t); lfo.start(t); osc.stop(end); o2.stop(end); lfo.stop(end);
  }
  pad(midis, t, dur, vel = 0.08, o = {}) {
    const ctx = this.ctx; if (!ctx || this.fallback) return;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(560, t); lp.frequency.linearRampToValueAtTime(1150, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(700, t + dur);
    const env = ctx.createGain();
    vel *= 0.62;
    env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(vel, t + 0.6);
    env.gain.setValueAtTime(vel, t + Math.max(0.7, dur - 0.4)); env.gain.linearRampToValueAtTime(0.0001, t + dur + 0.9);
    lp.connect(env);
    for (const m of midis) for (const d of [-6, 6]) {
      const osc = ctx.createOscillator(); osc.setPeriodicWave(this.reed); osc.frequency.value = mtof(m); osc.detune.value = d;
      osc.connect(lp); osc.start(t); osc.stop(t + dur + 1);
    }
    this.out(env, o.bus || this.bus || this.sfx, 0, o.rev ?? 0.35, 0);
  }
  bass(m, t, dur, vel = 0.4, o = {}) {
    const ctx = this.ctx; if (!ctx || this.fallback) return;
    this.zheng(m, t, vel * 0.9, { bus: o.bus, rev: 0.1, lp: 900, dur: Math.max(dur, 0.3) });
    this.zheng(m + 12, t, vel * 0.35, { bus: o.bus, rev: 0.1, lp: 1600, dur: Math.max(dur, 0.25) });
    const osc = ctx.createOscillator(); osc.frequency.value = mtof(m);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * 0.7, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.35, dur));
    osc.connect(g); this.out(g, o.bus || this.bus || this.sfx, 0, 0, 0); osc.start(t); osc.stop(t + Math.max(0.35, dur) + 0.1);
  }
  riser(t, dur = 2, vel = 0.18, bus) {
    const ctx = this.ctx; if (!ctx || this.fallback) return;
    const n = this.noise(t, dur);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.5;
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(6500, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + dur * 0.95); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    n.connect(bp); bp.connect(g); this.out(g, bus || this.bus || this.sfx, 0, 0.3, 0);
  }
  whoosh(t, dur = 0.6, f0 = 400, f1 = 3000, vel = 0.2) {
    const ctx = this.ctx; if (!ctx || this.fallback) return;
    const n = this.noise(t, dur);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp); bp.connect(g); this.out(g, this.sfx, 0, 0.25, 0);
  }
  roll(st, t) { this.taiko(t, 0.15 + st / 15 * 0.65, { f: 105 + st * 3, decay: 0.28, rev: 0.2 }); }
  tremolo(lb, st, t) {
    const ai = lidx(ROOTS[this.root].anchor) + 4 + Math.floor(lb / 2);
    const m = LADDER[Math.min(LADDER.length - 1, ai)];
    this.zheng(m, t, 0.08 + st * 0.004, { rev: 0.15 }); this.zheng(m, t + STEP / 2, 0.06 + st * 0.004, { rev: 0.15 });
  }
  whale(t, vel = 0.18, bus) {
    const ctx = this.ctx; if (!ctx || this.fallback) return;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(170, t); osc.frequency.exponentialRampToValueAtTime(320, t + 1.4); osc.frequency.exponentialRampToValueAtTime(130, t + 3.2);
    const o2 = ctx.createOscillator(); o2.type = 'triangle';
    o2.frequency.setValueAtTime(255, t); o2.frequency.exponentialRampToValueAtTime(480, t + 1.4); o2.frequency.exponentialRampToValueAtTime(195, t + 3.2);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 6; const lg = ctx.createGain(); lg.gain.value = 5;
    lfo.connect(lg); lg.connect(osc.frequency); lg.connect(o2.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.8); g.gain.setValueAtTime(vel, t + 2.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
    const g2 = ctx.createGain(); g2.gain.value = 0.3;
    osc.connect(g); o2.connect(g2); g2.connect(g);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300; g.connect(lp);
    this.out(lp, bus || this.sfx, 0, 0.9, 0.2);
    for (const o of [osc, o2, lfo]) { o.start(t); o.stop(t + 3.5); }
  }
  // 龙吟: the dragon's call — a deep voice that swells and rises, vowel formants sweeping, a growl underneath
  // and a singing overtone above, rolling away into the reverb
  longyin(t, vel = 0.22, bus) {
    const ctx = this.ctx; if (!ctx || this.fallback) return;
    const D = 3.4;
    const f0 = ctx.createOscillator(); f0.type = 'sawtooth';
    f0.frequency.setValueAtTime(58, t); f0.frequency.exponentialRampToValueAtTime(84, t + 1.3); f0.frequency.exponentialRampToValueAtTime(52, t + D);
    const vib = ctx.createOscillator(); vib.frequency.setValueAtTime(4.2, t); vib.frequency.linearRampToValueAtTime(6.2, t + D);
    const vg = ctx.createGain(); vg.gain.setValueAtTime(0.5, t); vg.gain.linearRampToValueAtTime(3.2, t + 1.6);
    vib.connect(vg); vg.connect(f0.frequency);
    const voice = ctx.createGain(); voice.gain.value = 0;
    // two formants: "oo" opening to "ah", closing to "o"
    const fA = ctx.createBiquadFilter(); fA.type = 'bandpass'; fA.Q.value = 5;
    fA.frequency.setValueAtTime(320, t); fA.frequency.exponentialRampToValueAtTime(760, t + 1.2); fA.frequency.exponentialRampToValueAtTime(420, t + D);
    const fB = ctx.createBiquadFilter(); fB.type = 'bandpass'; fB.Q.value = 7;
    fB.frequency.setValueAtTime(820, t); fB.frequency.exponentialRampToValueAtTime(1250, t + 1.2); fB.frequency.exponentialRampToValueAtTime(900, t + D);
    const gA = ctx.createGain(); gA.gain.value = 1.0; const gB = ctx.createGain(); gB.gain.value = 0.55;
    f0.connect(fA); f0.connect(fB); fA.connect(gA); fB.connect(gB); gA.connect(voice); gB.connect(voice);
    const lowp = ctx.createBiquadFilter(); lowp.type = 'lowpass'; lowp.frequency.value = 260; f0.connect(lowp);
    const gL = ctx.createGain(); gL.gain.value = 0.7; lowp.connect(gL); gL.connect(voice);
    // growl: band-limited noise, rumbled at ~30 Hz
    const n = this.noise(t, D + 0.2);
    const nb = ctx.createBiquadFilter(); nb.type = 'bandpass'; nb.Q.value = 2.2; nb.frequency.setValueAtTime(200, t); nb.frequency.exponentialRampToValueAtTime(320, t + 1.2); nb.frequency.exponentialRampToValueAtTime(170, t + D);
    const am = ctx.createGain(); am.gain.value = 0.35;
    const rum = ctx.createOscillator(); rum.frequency.value = 31; const rg = ctx.createGain(); rg.gain.value = 0.3; rum.connect(rg); rg.connect(am.gain);
    n.connect(nb); nb.connect(am); am.connect(voice);
    // the singing overtone (吟)
    const hi = ctx.createOscillator(); hi.type = 'triangle';
    hi.frequency.setValueAtTime(232, t); hi.frequency.exponentialRampToValueAtTime(352, t + 1.3); hi.frequency.exponentialRampToValueAtTime(208, t + D);
    vg.connect(hi.frequency);
    const hg = ctx.createGain(); hg.gain.setValueAtTime(0.0001, t); hg.gain.exponentialRampToValueAtTime(0.16, t + 1.1); hg.gain.exponentialRampToValueAtTime(0.0001, t + D);
    hi.connect(hg); hg.connect(voice);
    voice.gain.setValueAtTime(0.0001, t); voice.gain.exponentialRampToValueAtTime(vel, t + 0.55); voice.gain.setValueAtTime(vel, t + 1.9); voice.gain.exponentialRampToValueAtTime(0.0001, t + D);
    this.out(voice, bus || this.sfx, 0, 0.95, 0.25);
    for (const o of [f0, vib, rum, hi]) { o.start(t); o.stop(t + D + 0.1); }
  }
  roar(t, vel = 0.32) {
    const ctx = this.ctx; if (!ctx || this.fallback) return;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, t); osc.frequency.exponentialRampToValueAtTime(52, t + 1.6);
    const n = this.noise(t, 1.8); const mix = ctx.createGain(); osc.connect(mix);
    const ng = ctx.createGain(); ng.gain.value = 0.5; n.connect(ng); ng.connect(mix);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 3.5;
    f1.frequency.setValueAtTime(520, t); f1.frequency.exponentialRampToValueAtTime(240, t + 1.6);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    mix.connect(f1); f1.connect(g); this.out(g, this.sfx, 0, 0.6, 0);
    osc.start(t); osc.stop(t + 1.9);
  }

  // ------------------------------------------------ gameplay sfx
  noteFor(i) { const r = ROOTS[this.root] || ROOTS.B; return LADDER[Math.max(0, Math.min(LADDER.length - 1, lidx(r.anchor) + 5 + i))] + this.transpose; }
  // the note the player plays when a strike lands; judgement colours the timbre
  key(step, j, pan = 0, when = 0) {
    if (!this.ctx || this.fallback) return; const t = Math.max(this.now() + 0.004, when || 0);
    const m = this.noteFor(step);
    if (j >= 3) { this.zheng(m, t, 0.34, { bus: this.sfx, pan, rev: 0.32, dly: 0.14 }); this.bell(m + 12, t, 0.05, { pan, dur: 0.9 }); }
    else if (j === 2) this.zheng(m, t, 0.28, { bus: this.sfx, pan, rev: 0.26, dly: 0.08 });
    else this.zheng(m, t, 0.2, { bus: this.sfx, pan, rev: 0.18, lp: 1300 });
  }
  // the brush seals a spirit: a dry woodblock tick on the next sixteenth (sweeps become a roll)
  seal(pan = 0, n = 0) {
    if (!this.ctx || this.fallback) return;
    const t = this.nextStepTime(0.004);
    if (t === this.lastSealT) return; this.lastSealT = t;
    this.wood(t, 0.16, { f: 1900 + (n % 3) * 260, bus: this.sfx, pan });
  }
  miss() {
    if (!this.ctx || this.fallback) return; const t = this.now() + 0.004;
    this.taiko(t, 0.22, { f: 74, decay: 0.22, bus: this.sfx, slap: 500, rev: 0.1 });
  }
  lock(i, pan = 0) {
    if (!this.ctx || this.fallback) return; const t = this.now() + 0.005;
    this.zheng(this.noteFor(i), t, 0.24, { bus: this.sfx, pan, rev: 0.25, dly: 0.1 });
    this.bell(this.noteFor(i) + 12, t, 0.025, { pan, dur: 0.5 });
  }
  launch(t, i, pan = 0, withNote = false) {
    const ctx = this.ctx; if (!ctx || this.fallback) return;
    const n = this.noise(t, 0.16);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(2200, t); bp.frequency.exponentialRampToValueAtTime(9000, t + 0.13);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.13, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    n.connect(bp); bp.connect(g); this.out(g, this.sfx, pan, 0.15, 0);
    for (const [fr, a] of [[3150, 0.025], [4720, 0.018]]) {
      const o = ctx.createOscillator(); o.frequency.value = fr * (1 + i * 0.01);
      const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(a, t + 0.005); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(og); this.out(og, this.sfx, pan, 0.2, 0); o.start(t); o.stop(t + 0.4);
    }
    if (withNote) this.zheng(this.noteFor(i), t, 0.3, { bus: this.sfx, pan, rev: 0.3, dly: 0.12, bend: i % 3 === 2 ? 1 : 0 });
  }
  impact(kind, pan = 0, big = false) {
    const ctx = this.ctx; if (!ctx || this.fallback) return; const t = this.now() + 0.004;
    const r = ROOTS[this.root] || ROOTS.B;
    switch (kind) {
      case 'talisman': this.wood(t, 0.3, { f: 1300, bus: this.sfx, pan }); this.whoosh(t, 0.3, 1800, 500, 0.12); break;
      case 'fish': case 'orb': case 'head': this.taiko(t, 0.5, { f: 150, decay: 0.32, bus: this.sfx, pan, rev: 0.2 }); this.whoosh(t, 0.35, 2500, 300, 0.14); break;
      case 'lantern': this.taiko(t, 0.65, { f: 110, decay: 0.5, bus: this.sfx, pan }); this.whoosh(t, 0.5, 500, 2500, 0.14); break;
      case 'disc': this.gong(t, 0.16, { f: 340, dur: 1.4, bus: this.sfx, pan }); this.bell(r.anchor + 24, t, 0.05, { pan }); break;
      case 'wisp': this.bell(r.anchor + 31, t, 0.05, { pan, dur: 0.6 }); break;
      case 'jade': case 'soul': [0, 2, 4, 7].forEach((d, k) => this.bell(LADDER[lidx(r.anchor) + 7 + d], t + k * 0.07, 0.07, { pan })); break;
      case 'seal': this.gong(t, 0.35, { f: 120, dur: 3, bus: this.sfx }); this.taiko(t, 0.9, { f: 70, decay: 1.2, bus: this.sfx }); break;
      default: this.wood(t, 0.25, { bus: this.sfx, pan });
    }
    if (big) this.zheng(r.bass + 12, t, 0.3, { bus: this.sfx, rev: 0.3 });
  }
  hitTick(pan = 0) { if (!this.ctx || this.fallback) return; this.wood(this.now() + 0.004, 0.2, { f: 1700, bus: this.sfx, pan }); }
  hurt() {
    const ctx = this.ctx; if (!ctx || this.fallback) return; const t = this.now() + 0.004;
    this.taiko(t, 1.0, { f: 52, decay: 1.0, bus: this.sfx, rev: 0.3 });
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.5);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(lp); lp.connect(g); this.out(g, this.sfx, 0, 0.2, 0); o.start(t); o.stop(t + 0.6);
    this.whoosh(t, 0.5, 3000, 200, 0.2);
    this.musicFilter.frequency.cancelScheduledValues(t);
    this.musicFilter.frequency.setTargetAtTime(420, t, 0.03);
    this.musicFilter.frequency.setTargetAtTime(20000, t + 0.7, 0.35);
  }
  gliss(t, up = true, n = 12, span = 0.45, vel = 0.16) {
    if (!this.ctx || this.fallback) return;
    const r = ROOTS[this.root] || ROOTS.B; const b = lidx(r.anchor);
    for (let k = 0; k < n; k++) {
      const idx = up ? b + k : b + n + 2 - k;
      this.zheng(LADDER[Math.max(0, Math.min(LADDER.length - 1, idx))] + this.transpose, t + k * span / n, vel * (0.7 + 0.3 * k / n), { bus: this.sfx, rev: 0.35, pan: (k / n - 0.5) * 0.8 });
    }
  }
  bonus() { if (!this.ctx || this.fallback) return; const t = this.now() + 0.01; this.gliss(t, false, 12, 0.36, 0.18); this.gong(t, 0.2, { f: 150, dur: 2.5, bus: this.sfx }); }
  od() { if (!this.ctx || this.fallback) return; const t = this.now() + 0.01; this.gong(t, 0.5, { f: 78, dur: 5, bus: this.sfx }); this.gliss(t, true, 16, 0.7, 0.2); this.whoosh(t, 1.2, 300, 6000, 0.22); this.taiko(t, 1, { f: 60, decay: 1.4, bus: this.sfx }); }
  heal() { if (!this.ctx || this.fallback) return; const t = this.now() + 0.01; [0, 2, 4, 5].forEach((d, k) => this.bell(LADDER[lidx(62) + 5 + d] + this.transpose, t + k * 0.08, 0.08)); }
  card() { if (!this.ctx || this.fallback) return; const t = this.now() + 0.01; this.gong(t, 0.28, { f: 86, dur: 5, bus: this.sfx }); }
  ui() { if (!this.ctx || this.fallback) return; this.bell(83, this.now() + 0.005, 0.06, { dur: 0.8 }); }
  stamp() { if (!this.ctx || this.fallback) return; const t = this.now() + 0.005; this.taiko(t, 0.8, { f: 140, decay: 0.3, bus: this.sfx, slap: 700 }); }
  boom(vel = 1) { if (!this.ctx || this.fallback) return; const t = this.now() + 0.005; this.taiko(t, vel, { f: 46, decay: 1.8, bus: this.sfx, rev: 0.4 }); this.gong(t, 0.45 * vel, { f: 62, dur: 6, bus: this.sfx }); this.whoosh(t, 1.6, 4000, 120, 0.3 * vel); }

  // ------------------------------------------------ recorded tracks
  // manifest entries: { slot, url, bpm, offset (s to the first downbeat), loop: [fromBar, toBar], first, th, gain, transpose, acc }
  registerTracks(list) {
    for (const m of list) if (!m.alias) this.slots[m.slot] = { meta: m, state: 'idle', used: 0 };
    for (const m of list) if (m.alias && this.slots[m.alias]) this.slots[m.slot] = this.slots[m.alias];
  }
  slotMeta(k) { const s = this.slots[k]; return s && s.state !== 'error' ? s.meta : null; }
  fetchSlot(k) {
    const s = this.slots[k]; if (!s) return Promise.resolve(null);
    if (!s.fetching) {
      // the single-file build carries the music inline (base64), so it plays from any host with no extra files
      const inl = typeof window !== 'undefined' && window.__MUSIC && window.__MUSIC[s.meta.url];
      const get = inl ? Promise.resolve().then(() => { const b = atob(inl), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a.buffer; })
        : fetch(s.meta.url).then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.arrayBuffer(); });
      s.fetching = get
        .catch(e => { s.state = 'error'; s.err = String(e && e.message || e); console.warn('[track]', k, e); return null; });
    }
    return s.fetching;
  }
  decoder() {
    // always decode at 44.1 kHz in an offline context: works before the first tap, and keeps buffers small
    if (!this._dec) { const O = window.OfflineAudioContext || window.webkitOfflineAudioContext; try { this._dec = O ? new O(2, 1, 44100) : null; } catch (e) { this._dec = null; } }
    return this._dec || (this.ctx && !this.offline ? this.ctx : null);
  }
  decodeSlot(k) {
    const s = this.slots[k]; if (!s || s.state === 'error') return Promise.resolve(null);
    s.used = performance.now();
    if (s.buf) return Promise.resolve(s.buf);
    if (s.decoding) return s.decoding;
    s.decoding = this.fetchSlot(k).then(ab => {
      const dc = this.decoder();
      if (!ab || !dc) return null;
      // decoding detaches the bytes; keep the original so an evicted track can be decoded again
      return new Promise((res, rej) => { const p = dc.decodeAudioData(ab.slice(0), res, rej); if (p && p.then) p.then(res, rej); });
    }).then(buf => {
      s.decoding = null;
      if (!buf) return null;
      s.buf = buf; s.shift = this.measureShift(buf, s.meta); s.state = 'ready';
      this.evict(k);
      if (this.onTrackReady) this.onTrackReady(k);
      return buf;
    }).catch(e => { s.decoding = null; s.state = 'error'; console.warn('[track decode]', k, e); return null; });
    return s.decoding;
  }
  // MP3 decoders differ in how much encoder padding they keep (Safari keeps some, Chrome trims it).
  // Cross-correlate a stored amplitude-envelope fingerprint with the decoded audio to find that offset.
  measureShift(buf, m) {
    const mk = m.mark; if (!mk || !mk.env) return 0;
    const A = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const sr = buf.sampleRate, W = Math.max(1, Math.round(mk.w * sr)), N = mk.env.length, L = 75;
    const c0 = buf.getChannelData(0), c1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : c0;
    const start = Math.round(mk.t * sr) - L * W;
    const env = new Float32Array(N + 2 * L);
    for (let k = 0; k < env.length; k++) {
      let mx = 0; const i0 = start + k * W;
      for (let i = Math.max(0, i0); i < Math.min(c0.length, i0 + W); i++) { const v = Math.max(Math.abs(c0[i]), Math.abs(c1[i])); if (v > mx) mx = v; }
      env[k] = mx;
    }
    const ref = new Float32Array(N); let rm = 0;
    for (let k = 0; k < N; k++) { ref[k] = A.indexOf(mk.env[k]) / 61; rm += ref[k]; }
    rm /= N; let rs = 0; for (let k = 0; k < N; k++) { ref[k] -= rm; rs += ref[k] * ref[k]; } rs = Math.sqrt(rs / N) || 1;
    const sc = [];
    for (let lag = -L; lag <= L; lag++) {
      let mu = 0; for (let k = 0; k < N; k++) mu += env[lag + L + k]; mu /= N;
      let sd = 0, dot = 0;
      for (let k = 0; k < N; k++) { const v = env[lag + L + k] - mu; sd += v * v; dot += ref[k] * v; }
      sc.push(dot / ((Math.sqrt(sd / N) || 1) * rs));
    }
    let k = 0; for (let i = 1; i < sc.length; i++) if (sc[i] > sc[k]) k = i;
    let fr = 0;
    if (k > 0 && k < sc.length - 1) { const y0 = sc[k - 1], y1 = sc[k], y2 = sc[k + 1], den = y0 - 2 * y1 + y2; if (Math.abs(den) > 1e-12) fr = 0.5 * (y0 - y2) / den; }
    const shift = (k - L + fr) * W / sr;
    return Math.abs(shift) < 0.14 ? shift : 0;
  }
  // keep at most two decoded tracks besides the one playing (a decoded minute is ~20 MB, phones are tight)
  evict(keep) {
    const playing = this.curSeg && this.slots[this.curSeg.slot];
    const uniq = [...new Set(Object.values(this.slots))].filter(s => s.buf);
    const live = uniq.filter(s => s !== this.slots[keep] && s !== playing);
    live.sort((a, b) => a.used - b.used);
    for (let i = 0, n = uniq.length; n > 2 && i < live.length; i++, n--) { live[i].buf = null; live[i].state = 'idle'; }
  }
  ready(k, ms = 4000) {
    const s = this.slots[k]; if (!s || s.state === 'error') return Promise.resolve(false);
    if (s.buf) return Promise.resolve(true);
    return Promise.race([this.decodeSlot(k).then(b => !!b), new Promise(r => setTimeout(() => r(false), ms))]);
  }
  // barsIn: how many bars of this track have already gone by (0 = from its first downbeat)
  startTrack(seg, sl, t, barsIn = 0) {
    const m = sl.meta, buf = sl.buf, ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = m.gain ?? 1;
    src.connect(g); g.connect(this.bus ? this.bus.dry : this.musicFilter);
    const bar0 = m.offset + (sl.shift || 0), barLen = 4 * seg.beat;
    let pos = bar0 + barsIn * barLen;
    if (m.loop) {
      const ls = bar0 + m.loop[0] * barLen, le = Math.min(buf.duration - 0.01, bar0 + m.loop[1] * barLen);
      if (le - ls > barLen) { src.loop = true; src.loopStart = ls; src.loopEnd = le; if (pos >= le) pos = ls + ((pos - ls) % (le - ls)); }
    }
    const now = ctx.currentTime, when = Math.max(t, now + 0.005);
    try { src.start(when, Math.max(0, pos + (when - t))); } catch (e) { return false; }
    this.track = { src, g, slot: seg.slot };
    sl.used = performance.now();
    if (window.__trackLog) window.__trackLog.push({ slot: seg.slot, when, pos: pos + (when - t), bar0, beat: seg.beat, segT: seg.t, segBar: seg.bar, t, shift: sl.shift || 0, loop: src.loop ? [src.loopStart, src.loopEnd] : null });
    return true;
  }
  stopTrack(t, fade = 0.3) {
    const tr = this.track; if (!tr || !this.ctx) return; this.track = null;
    try {
      const g = tr.g.gain; t = Math.max(t, this.ctx.currentTime);
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.0001, t + fade);
      tr.src.stop(t + fade + 0.05);
    } catch (e) { /* already stopped */ }
  }

  // ------------------------------------------------ sequencer: a tempo map of segments
  heard() { return this.now() - this.latency(); }
  segAtStep(k) { const S = this.segs; let s = S[0]; for (const x of S) if (x.step0 <= k) s = x; return s; }
  segAtBeat(b) { const S = this.segs; let s = S[0]; for (const x of S) if (x.bar * 4 <= b + 1e-9) s = x; return s; }
  segAtTime(t) { const S = this.segs; let s = S[0]; for (const x of S) if (x.t <= t + 1e-9) s = x; return s; }
  stepTime(k) { const s = this.segAtStep(k); return s.t + (k - s.step0) * s.beat / 4; }
  beatTime(b) { if (!this.segs) return 0; const s = this.segAtBeat(b); return s.t + (b - s.bar * 4) * s.beat; }
  beatAt(t) { if (!this.segs) return 0; const s = this.segAtTime(t); return s.bar * 4 + (t - s.t) / s.beat; }
  beatLenAt(t) { return this.segs ? this.segAtTime(t).beat : BEAT; }
  gridAfter(t, div = 2) { return this.beatTime(Math.ceil(this.beatAt(t) * div - 1e-6) / div); }
  nextBarTime(after = 0.05) { return this.beatTime(Math.ceil(this.beatAt(this.now() + after) / 4 - 1e-6) * 4); }
  nextStepTime(off = 0.012) { return this.gridAfter(this.now() + off, 4); }
  currentBar() { return Math.floor(this.beatAt(this.now()) / 4); }
  playSong(name, delay = 0.06, startBar = 0) {
    const now = this.now();
    if (this.ctx) {
      if (this.bus) this.fadeBus(this.bus, now, 0.6);
      this.bus = this.makeBus(this.musicFilter);
      this.musicFilter.frequency.cancelScheduledValues(now);
      this.musicFilter.frequency.setValueAtTime(20000, now);
    }
    this.stopTrack(now, 0.6);
    const plan = PLANS[name] || [[0, name]];
    const segs = plan.map(([bar, slot]) => { const m = this.slotMeta(slot); return { bar, slot, beat: 60 / (m ? m.bpm : 120), step0: bar * 16, mode: null }; });
    let rel = 0; segs[0].rel = 0;
    for (let i = 1; i < segs.length; i++) segs[i].rel = rel = rel + (segs[i].bar - segs[i - 1].bar) * 4 * segs[i - 1].beat;
    this.segs = segs.map(x => Object.assign(x, { t: x.rel }));
    const base = now + delay - this.beatTime(startBar * 4);
    for (const x of this.segs) x.t = x.rel + base;
    this.song = plan; this.songName = name; this.songId++; this.override = null; this.curSeg = null; this.transpose = 0;
    this.step = startBar * 16; this.nextT = this.stepTime(this.step); this.mel = null; this.lastRoot = null;
    this.t0 = this.beatTime(0);
    this.events.length = 0;
    setTempo(60 / this.segAtStep(this.step).beat);
    // the segment we start in (and the one after it) should be decoding already
    const cur = this.segAtStep(this.step), nx = this.segs[this.segs.indexOf(cur) + 1];
    this.decodeSlot(cur.slot); if (nx) this.decodeSlot(nx.slot);
    if (!this.timer) this.timer = setInterval(() => this.tick(), 25);
    this.tick();
  }
  stopSong() { if (this.ctx && this.bus) this.fadeBus(this.bus, this.now(), 1.2); this.stopTrack(this.now(), 1.2); this.bus = null; this.song = null; }
  setOverride(id, fromBar) { this.override = { id, bar: fromBar }; }
  tick() {
    if (!this.song || this.paused) return;
    const ahead = this.now() + 0.14;
    let guard = 0;
    while (this.nextT < ahead && guard++ < 64) { this.doStep(this.step, this.nextT); this.step++; this.nextT = this.stepTime(this.step); }
  }
  enterSeg(seg, t) {
    const prev = this.curSeg; this.curSeg = seg;
    if (prev && this.track) this.stopTrack(t, Math.min(0.35, seg.beat * 0.75));
    const sl = this.slots[seg.slot];
    seg.mode = 'proc'; this.transpose = 0;
    // a song that starts inside a segment starts its track from the top (on a bar line, so the grid still holds)
    seg.entryBar = Math.round(this.beatAt(t) / 4); seg.fresh = !prev;
    if (sl && sl.buf && this.ctx && !this.fallback && this.startTrack(seg, sl, t, seg.fresh ? 0 : seg.entryBar - seg.bar)) { seg.mode = 'track'; this.transpose = sl.meta.transpose || 0; this.root = 'B'; }
    const nx = this.segs[this.segs.indexOf(seg) + 1];
    if (nx) this.decodeSlot(nx.slot);
  }
  procSection(seg, bar) {
    const fb = FALLBACK[seg.slot] || [[0, seg.slot]];
    const off = bar - seg.bar; let id = fb[0][1], start = fb[0][0];
    for (const [o, x] of fb) if (off >= o) { id = x; start = o; }
    if (this.override && bar >= this.override.bar) return { id: this.override.id, lb: bar - this.override.bar };
    return { id: SEC[id] ? id : 'title', lb: off - start };
  }
  doStep(step, t) {
    const seg = this.segAtStep(step);
    if (seg !== this.curSeg) this.enterSeg(seg, t);
    const bar = Math.floor(step / 16), st = step % 16;
    // the recording finished decoding late: take over from the synthesized stand-in on the next bar line
    if (seg.mode === 'proc' && st === 0 && this.ctx && !this.fallback) {
      const sl = this.slots[seg.slot];
      if (sl && sl.buf && this.startTrack(seg, sl, t, bar - (seg.fresh ? seg.entryBar : seg.bar))) { seg.mode = 'track'; this.transpose = sl.meta.transpose || 0; this.root = 'B'; this.mel = null; }
    }
    if (seg.mode === 'track') {
      const m = this.slots[seg.slot].meta, lb = bar - seg.bar;
      let accent = 0;
      if (m.acc && st % 4 === 0) {
        // per-beat drum strength from analysis (0..9), looping with the track
        let b = lb * 4 + st / 4; const L = m.acc.length;
        if (m.loop && b >= m.loop[1] * 4) b = m.loop[0] * 4 + ((b - m.loop[0] * 4) % ((m.loop[1] - m.loop[0]) * 4));
        accent = (+m.acc[b % L] || 0) / 9;
      } else if (!m.acc && !m.free) accent = st === 0 ? 1 : 0;
      this.events.push({ t, step, bar, st, lb, sec: seg.slot, root: this.root, accent, song: this.songId, beat: seg.beat });
      if (this.events.length > 400) this.events.splice(0, this.events.length - 400);
      return;
    }
    const sec = this.procSection(seg, bar); const S = SEC[sec.id]; const lb = sec.lb;
    const SB = 4 * seg.beat, SS = seg.beat / 4;
    const root = S.roots[lb % S.roots.length];
    let accent = 0;
    if (st === 0) this.root = root;
    if (this.ctx && this.bus && !this.fallback) {
      if (st === 0) {
        if (lb === 0 && S.crash) this.cymbal(t, 0.14, 2.2);
        if (lb === 0 && S.gongAt0) this.gong(t, 0.28, { f: 82 });
        if (S.gongEvery && lb % S.gongEvery === 0 && lb > 0) this.gong(t, 0.2, { f: 98 });
        if (S.pad && (root !== this.lastRoot || lb === 0)) {
          let n = 1; while (n < 4 && S.roots[(lb + n) % S.roots.length] === root) n++;
          this.pad(ROOTS[root].pad, t, n * SB, S.pad);
        }
        if (S.melody && lb >= (S.melAt || 0) && ((lb - (S.melAt || 0)) % (S.melEvery || 9999)) === 0) this.mel = { notes: MEL[S.melody], start: step };
      }
      if (S.taiko) { const v = PAT[S.taiko][st]; if (v) { this.taiko(t, v * (S.tvel || 0.85)); if (v >= 0.7) accent = 1; } }
      if (S.shime) { const v = PAT[S.shime][st]; if (v) { this.taiko(t, v * 0.45, { f: 230, decay: 0.16, slap: 2600, rev: 0.15 }); if (!accent) accent = 0.35; } }
      if (S.wood) { const v = PAT[S.wood][st]; if (v) this.wood(t, v * 0.2); }
      if (S.heart) { const v = PAT.heart[st]; if (v) { this.taiko(t, v * 0.75, { f: 58, decay: 0.5 }); accent = v; } }
      if (S.bass) for (const [s2, v] of BASS[S.bass]) if (s2 === st) this.bass(ROOTS[root].bass, t, S.bass === 'long' ? SB * 0.95 : SS * 3, v * S.bassVel);
      if (S.zheng) {
        const ai = lidx(ROOTS[root].anchor);
        for (const [s2, d] of ZH[S.zheng]) if (s2 === st) this.zheng(LADDER[Math.min(LADDER.length - 1, ai + d)], t, S.zvel * (st % 4 === 0 ? 1 : 0.75), { pan: (Math.random() - 0.5) * 0.5, rev: 0.25, dly: S.zheng === 'sparse' ? 0.3 : 0.06 });
      }
      if (this.mel) {
        const off = step - this.mel.start;
        for (const [s2, m, d] of this.mel.notes) if (s2 === off) this.flute(m, t, d * SS * 0.95, 0.09);
        if (off > 150) this.mel = null;
      }
      if (S.custom) S.custom(lb, st, t, this);
    } else if (S.taiko && PAT[S.taiko][st] >= 0.7) accent = 1;
    if (st === 0) this.lastRoot = root;
    this.events.push({ t, step, bar, st, lb, sec: sec.id, root, accent, song: this.songId, beat: seg.beat });
    if (this.events.length > 400) this.events.splice(0, this.events.length - 400);
  }
  drain(fn) {
    const now = this.now() - this.latency();
    while (this.events.length && this.events[0].t <= now) {
      const e = this.events.shift();
      if (e.song !== this.songId) continue;
      if (e.beat && Math.abs(e.beat - BEAT) > 1e-6) setTempo(60 / e.beat);
      fn(e);
    }
  }

  suspend() {
    if (this.paused) return;
    this.paused = true;
    if (this.ctx) this.ctx.suspend().catch(() => {});
    if (!this.ctx || this.fallback) this.fbPauseAt = performance.now();
  }
  resume() {
    if (this.ctx) this.ctx.resume().catch(() => {});
    if ((!this.ctx || this.fallback) && this.paused) this.fbPaused += performance.now() - this.fbPauseAt;
    this.paused = false;
  }
  setMuted(m) {
    this.muted = m;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }
}

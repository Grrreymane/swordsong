// Formations are musical phrases: every spirit is a note that lands on the beat.
// x,y in screen-normalized units (-1..1), d = depth units. Note offsets are in beats from the bar downbeat.
export function kp(keys) {
  const n = keys.length;
  const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
  return (tau, out) => {
    if (tau >= keys[n - 1][0]) { out.set(keys[n - 1][1], keys[n - 1][2], keys[n - 1][3]); return false; }
    if (tau <= keys[0][0]) { out.set(keys[0][1], keys[0][2], keys[0][3]); return true; }
    let i = 0; while (i < n - 2 && tau >= keys[i + 1][0]) i++;
    const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n - 1, i + 2)];
    const u = (tau - k1[0]) / (k2[0] - k1[0]);
    out.set(cr(k0[1], k1[1], k2[1], k3[1], u), cr(k0[2], k1[2], k2[2], k3[2], u), cr(k0[3], k1[3], k2[3], k3[3], u));
    return true;
  };
}
const delayed = (p, d, ox = 0, oy = 0, oz = 0) => (t, out) => { const ok = p(Math.max(0, t - d), out); out.x += ox; out.y += oy; out.z += oz; return ok; };

// melodic shapes (steps on the pentatonic ladder)
const M = {
  up: [0, 1, 2, 3, 4, 5, 6, 7],
  vee: [4, 3, 2, 1, 2, 3, 4, 5],
  arp: [0, 2, 4, 5, 7, 5, 4, 2],
  run: [7, 6, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4],
  rise: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 8, 7],
  zig: [0, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8],
  rain: [5, 3, 6, 2, 4, 1, 3, 0, 2, 4, 1, 5],
};

export const W = {
  talismanLine(g, n, y = 0.35, spread = 0.7, d = 56) {
    const ph = g.phrase(n);
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? 0 : -spread + 2 * spread * i / (n - 1);
      const p = kp([[0, x * 0.3, y + 0.7, 200], [2.4, x, y, d], [7.6, x + 0.06, y - 0.06, d - 4], [10, x * 1.6, y + 1.7, d + 40]]);
      g.spawn('talisman', delayed(p, i * 0.14), { nt: [g.nb(5 + i)], pitch: [M.up[i % 8]], phrase: ph });
    }
  },
  talismanV(g, n = 7, d = 58) {
    const c = (n - 1) / 2, ph = g.phrase(n);
    for (let i = 0; i < n; i++) {
      const x = (i - c) * 0.24, y = 0.5 - Math.abs(i - c) * 0.1;
      g.spawn('talisman', delayed(kp([[0, x * 0.15, 0.55, 210], [2.6, x, y, d], [7.0, x * 1.1, y - 0.06, d - 8], [9.2, x * 2.6, y - 0.5, d - 34]]), Math.abs(i - c) * 0.12),
        { nt: [g.nb(6 + i * 0.5)], pitch: [M.vee[i % 8]], phrase: ph });
    }
  },
  talismanRing(g, n = 8, d = 60, dur = 9.5) {
    const asp = g.aspect;
    const ry = Math.max(0.3, Math.min(0.55, 0.78 * asp)), rx = Math.min(0.78, 0.55 / Math.max(asp, 0.5) * 0.9 + 0.2);
    const ph = g.phrase(n);
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2;
      g.spawn('talisman', (t, out) => {
        const ap = Math.min(1, t / 2.4), e = 1 - Math.pow(1 - ap, 3);
        const lv = Math.max(0, t - (dur - 2.2)) / 2.2;
        const a = a0 + t * 0.45;
        const r = (0.25 + 0.75 * e) * (1 + lv * 1.8);
        out.set(Math.cos(a) * rx * r, Math.sin(a) * ry * r + 0.22, d + (1 - e) * 150 + lv * 30);
        return t < dur;
      }, { nt: [g.nb(5 + i * 0.5)], pitch: [M.arp[i % 8]], phrase: ph });
    }
  },
  talismanRain(g, n = 8, d = 54, dur = 7) {
    const ph = g.phrase(n);
    for (let i = 0; i < n; i++) {
      const x = -0.75 + 1.5 * (i / (n - 1)); const ord = (i * 3) % n;
      g.spawn('talisman', delayed(kp([[0, x, 1.7, d], [dur * 0.5, x + 0.1, 0.3, d - 6], [dur, x - 0.1, -1.7, d - 14]]), ord * 0.5),
        { nt: [g.nb(dur + ord)], pitch: [M.rain[ord % 12]], phrase: ph });
    }
  },
  // a school is a chain: strike the first fish on the beat, keep the finger down and the rest flow through it
  fishSchool(g, n, dir = 1, y = 0.25, d = 54, dur = 7.5, o = {}, step = 1) {
    const lead = kp([[0, -1.8 * dir, y + 0.3, d + 22], [dur * 0.3, -0.45 * dir, y - 0.18, d], [dur * 0.62, 0.42 * dir, y + 0.2, d - 6], [dur, 1.9 * dir, y - 0.1, d + 16]]);
    const ph = g.phrase(n), ch = g.chain();
    const mel = dir > 0 ? M.rise : M.run;
    for (let i = 0; i < n; i++) {
      const oy = (i % 2 ? 1 : -1) * 0.035 * Math.ceil(i / 2), oz = ((i % 3) - 1) * 2.5;
      g.spawn('fish', delayed(lead, i * step * 0.5, 0, oy, oz), { ...o, nt: [g.nb(7 + i * step)], pitch: [mel[i % 12]], phrase: ph, chain: ch });
    }
  },
  fishRing(g, n = 8, d = 56, dur = 9.5, o = {}) {
    const ry = Math.max(0.3, Math.min(0.5, 0.75 * g.aspect)), rx = 0.72;
    const ph = g.phrase(n);
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2;
      g.spawn('fish', (t, out) => {
        const ap = Math.min(1, t / 2.2), e = 1 - Math.pow(1 - ap, 3);
        const lv = Math.max(0, t - (dur - 2)) / 2;
        const a = a0 - t * 0.6;
        const r = (1.7 - 0.7 * e) * (1 + lv * 1.5);
        out.set(Math.cos(a) * rx * r, Math.sin(a) * ry * r + 0.25, d + (1 - e) * 60 + lv * 25);
        return t < dur;
      }, { ...o, nt: [g.nb(5 + i * 0.5)], pitch: [M.arp[(i + 3) % 8]], phrase: ph });
    }
  },
  // lanterns are held notes: two beats each; they also spit ghost fire on the beat
  lanterns(g, xs, y = 0.38, d = 58, hold = 9) {
    xs.forEach((x, i) => {
      const ph = g.phrase(2);
      g.spawn('lantern', kp([[0, x, -1.7, d + 12], [2.6, x, y + (i % 2) * 0.12, d], [2.6 + hold, x + 0.06, y + 0.1, d - 3], [5.6 + hold, x * 0.8, 1.9, d + 20]]),
        { fireDelay: 3 + i * 2, nt: [g.nb(6 + i * 2), g.nb(7 + i * 2)], pitch: [i, i + 4], phrase: ph, chain: g.chain() });
    });
  },
  // a lantern that answers: it spits ghost fire on the beat (cut each ember), then asks to be held
  ember(g, x = 0.35, y = 0.42, d = 56, wb = [6, 7, 8], hb = [10, 11]) {
    const end = hb[hb.length - 1] * 0.5;
    const e = g.spawn('lantern', kp([[0, x, -1.7, d + 12], [2.6, x, y, d], [end + 1.4, x + 0.04, y + 0.08, d - 3], [end + 4.4, x * 0.8, 1.9, d + 20]]),
      { fireDelay: 999, nt: hb.map(b => g.nb(b)), pitch: [2, 6], phrase: g.phrase(hb.length), chain: g.chain() });
    wb.forEach((b, i) => {
      const t = g.nb(b); g.resv.push(t);
      g.later(g.nb(b - 2), () => {
        if (!e.alive) return;
        const n = g.worldToNorm(e.pos);
        g.spawnWispAt(n.x + (i % 2 ? 0.05 : -0.05), n.y - 0.06, n.z, (2.9 + i * 0.1) * g.tk(), t);
      });
    });
  },
  disc(g, y = 0.3, dir = 1, d = 50, dur = 10.5) {
    g.spawn('disc', kp([[0, -1.6 * dir, y, d + 12], [dur * 0.5, 0, y + 0.1, d], [dur, 1.65 * dir, y - 0.05, d + 10]]),
      { nt: [g.nb(10), g.nb(10.5), g.nb(11)], pitch: [7, 7, 9], phrase: g.phrase(3), chain: g.chain() });
  },
  serpent(g, n = 10, dir = 1, d = 60, dur = 10.5) {
    const lead = (t, out) => { const u = t / dur; out.set(dir * (1.6 - 3.2 * u), 0.32 + Math.sin(u * Math.PI * 3) * 0.32, d + Math.sin(u * Math.PI * 2) * 12); return u < 1; };
    const ph = g.phrase(n), ch = g.chain();
    for (let i = 0; i < n; i++) g.spawn(i === 0 ? 'head' : 'orb', delayed(lead, i * 0.5), { scale: i === 0 ? 1.15 : 1 - i * 0.025, nt: [g.nb(10.5 + i)], pitch: [M.zig[i % 14]], phrase: ph, chain: ch });
  },
  pickup(g, kind, dir = 1, y = 0.12, d = 42, dur = 8.5) {
    g.spawn(kind, kp([[0, -1.5 * dir, y + 0.25, d], [dur * 0.5, 0, y, d - 4], [dur, 1.5 * dir, y + 0.3, d]]), { nt: [g.nb(dur)], pitch: [9] });
  },
};

const KOI = { koi: 1, koiColor: [0.85, 0.5, 0.08] };
const KOI_RED = { koi: 1, koiColor: [0.8, 0.12, 0.05] };

export function buildScript() {
  const S = [];
  const at = (bar, fn) => S.push([bar, fn]);
  // One lane: formations never sound at the same moment (beat ranges noted; bar = 4 beats).
  // ----- stage 1: 云海 (quarter notes, gentle)
  at(0, g => { g.stageCard(0); });
  at(1, g => W.talismanLine(g, 3, 0.32, 0.45));          //  9 – 11
  at(3, g => W.talismanLine(g, 4, 0.5, 0.65));           // 17 – 20
  at(5, g => W.fishSchool(g, 5, 1, 0.28));               // 27 – 31
  at(7, g => W.talismanV(g, 5));                         // 34 – 36
  at(9, g => W.fishSchool(g, 6, -1, 0.38));              // 43 – 48
  at(11, g => W.lanterns(g, [-0.42, 0.42]));             // 50 – 53
  at(13, g => W.talismanRing(g, 8));                     // 57 – 60.5
  at(15, g => W.fishSchool(g, 6, 1, 0.12));              // 67 – 72
  at(17, g => W.talismanLine(g, 4, 0.62, 0.6));          // 73 – 76
  at(18, g => W.pickup(g, 'soul', 1));                   // 80.5
  at(20, g => W.lanterns(g, [-0.6, 0, 0.6]));            // 86 – 91
  at(22, g => W.fishRing(g, 6));                         // 93 – 95.5
  // ----- stage 2: 青绿 (eighths appear)
  at(24, g => { g.stageCard(1); W.fishSchool(g, 8, 1, 0.3, 54, 7.5, KOI); });   // 103 – 110
  at(27, g => W.talismanV(g, 7));                        // 114 – 117
  at(28, g => W.serpent(g, 8, 1));                       // 122.5 – 129.5
  at(32, g => W.ember(g, 0.38, 0.42));                   // 134 – 136 fire · 138 – 139 hold
  at(34, g => W.fishRing(g, 8, 56, 9.5, KOI));           // 141 – 144.5
  at(35, g => { W.pickup(g, 'jade', -1); W.disc(g, 0.22, -1); });   // 148.5 · 150 – 151
  at(36, g => W.disc(g, 0.56, 1));                       // 154 – 155
  at(38, g => W.talismanRain(g, 8));                     // 159 – 166
  at(40, g => W.fishSchool(g, 8, -1, 0.2, 54, 7.5, KOI_RED, 0.5));   // 167 – 170.5
  at(41, g => { W.pickup(g, 'soul', 1); W.serpent(g, 8, -1); });     // 172.5 · 174.5 – 181.5
  at(45, g => W.lanterns(g, [-0.6, 0, 0.6], 0.45));      // 186 – 191
  at(47, g => W.talismanRing(g, 8));                     // 193 – 196.5
  // ----- stage 3: 灯海 (streams)
  at(48, g => { g.stageCard(2); W.fishSchool(g, 5, -1, 0.3, 58, 9); });  // 199 – 203
  at(50, g => W.talismanRing(g, 8));                     // 205 – 208.5
  at(52, g => W.lanterns(g, [-0.7, -0.35, 0, 0.35, 0.7], 0.4));  // 214 – 223
  at(55, g => W.serpent(g, 10, 1));                      // 230.5 – 239.5
  at(58, g => W.pickup(g, 'jade', 1));                   // 240.5
  at(59, g => W.fishSchool(g, 8, 1, 0.15, 54, 7.5, KOI_RED, 0.5));   // 243 – 246.5
  at(60, g => W.pickup(g, 'soul', -1, 0.4));             // 248.5
  at(61, g => W.ember(g, -0.4, 0.5, 56, [6, 6.5, 7, 7.5], [9, 10]));   // 250 – 251.5 fire · 253 – 254 hold
  at(62, g => W.talismanRain(g, 10));                    // 255 – 264
  at(65, g => W.fishRing(g, 10));                        // 265 – 269.5
  // ----- prelude
  at(68, g => g.preBoss());
  at(70, g => g.hud.warn());
  at(72, g => g.startBoss());
  return S;
}

export class Level {
  constructor(game) { this.g = game; this.script = buildScript(); this.n = 0; }
  reset() { this.n = 0; }
  onBar(bar) {
    for (const [b, fn] of this.script) if (b === bar) fn(this.g);
  }
  summon() {
    const g = this.g; this.n++;
    const r = this.n % 4;
    if (r === 0) W.fishSchool(g, 6, this.n % 2 ? 1 : -1, 0.15, 54, 7.5, KOI_RED, 0.5);
    else if (r === 1) W.talismanRing(g, 8, 62);
    else if (r === 2) { W.lanterns(g, [-0.55, 0.55], 0.55); if (this.n % 3 === 0) W.pickup(g, 'jade', 1, 0.0); }
    else { W.talismanV(g, 7, 62); if (this.n % 2) W.pickup(g, 'soul', -1, 0.05); }
  }
}

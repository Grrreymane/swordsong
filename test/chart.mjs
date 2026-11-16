import { buildScript, W } from '../src/level.js';
const BEAT = 0.5, BAR = 2;
const notes = []; let uid = 0;
const g = {
  aspect: 390 / 844, noteBase: 0, resv: [], later() {},
  nb(b) { return this.noteBase + Math.round(b * 2) / 2 * BEAT; },
  phrase(n) { return { n }; }, chain() { return { id: ++uid }; },
  spawn(kind, path, o = {}) { const id = ++uid; (o.nt || []).forEach((t, i) => notes.push({ t, kind, id, chain: o.chain ? o.chain.id : null, bar: this.bar })); return {}; },
  stageCard() {}, preBoss() {}, hud: { warn() {} }, startBoss() {},
};
for (const [bar, fn] of buildScript()) { g.bar = bar; g.noteBase = bar * BAR; const r0 = g.resv.length; fn(g); for (const t of g.resv.slice(r0)) notes.push({ t, kind: 'wisp', id: ++uid, chain: null, bar }); }
notes.sort((a, b) => a.t - b.t);
let conflicts = [];
for (let i = 1; i < notes.length; i++) {
  for (let j = i - 1; j >= 0 && notes[i].t - notes[j].t < 0.2; j--) {
    const a = notes[j], b = notes[i];
    if (a.id === b.id) continue;
    if (a.chain && a.chain === b.chain) continue;
    conflicts.push([+a.t.toFixed(2), a.kind, a.bar, b.kind, b.bar, +(b.t - a.t).toFixed(3)]);
  }
}
console.log('notes', notes.length, 'span', notes[0].t, notes[notes.length - 1].t);
console.log('conflicts (non-chained notes < 0.2s apart):', conflicts.length);
for (const c of conflicts) console.log(JSON.stringify(c));
// density per 4 bars
const dens = {}; for (const n of notes) { const k = Math.floor(n.t / 8); dens[k] = (dens[k] || 0) + 1; }
console.log('notes per 8s:', Object.entries(dens).map(([k, v]) => `${k * 8}s:${v}`).join(' '));
const gaps = [];
for (let i = 1; i < notes.length; i++) if (notes[i].bar !== notes[i - 1].bar || (notes[i].chain !== notes[i-1].chain && notes[i].kind !== notes[i-1].kind)) gaps.push([+(notes[i].t - notes[i - 1].t).toFixed(2), notes[i - 1].kind + '@' + notes[i - 1].bar, notes[i].kind + '@' + notes[i].bar]);
gaps.sort((a, b) => a[0] - b[0]);
console.log('tightest cross-formation gaps:', JSON.stringify(gaps.slice(0, 8)));

// 龙 — a Chinese dragon: serpent body that follows its head's path, deer antlers, long whiskers,
// a flame mane, five-clawed legs, a crest of fins and a plumed tail, chasing a flaming pearl.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { uni, NOISE, SKY, FOG, DISSOLVE } from './glsl.js';

export const DL = 280;          // body length, world units
const NS = 96;                  // spine samples
const RAD = [[0, 4.3], [0.05, 5.0], [0.16, 6.2], [0.38, 6.5], [0.58, 5.5], [0.78, 3.7], [0.92, 2.1], [1.0, 0.7]];
export function drad(u) {
  u = Math.min(1, Math.max(0, u));
  for (let i = 1; i < RAD.length; i++) if (u <= RAD[i][0]) {
    const [u0, r0] = RAD[i - 1], [u1, r1] = RAD[i]; const k = (u - u0) / (u1 - u0); const s = k * k * (3 - 2 * k);
    return r0 + (r1 - r0) * s;
  }
  return RAD[RAD.length - 1][1];
}

// part ids (shader switches on these)
const BODY = 0, HEAD = 1, JAW = 2, TOOTH = 3, EYE = 4, HORN = 5, WHISK = 6, HAIR = 7, FIN = 8, LEG = 9, CLAW = 10, LTOOTH = 11, LHAIR = 12, NOSE = 13, EAR = 14;

// ---------------------------------------------------------------- geometry helpers
function mk(pos, nrm, uv, part, u, ex) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (nrm) g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const n = pos.length / 3;
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(n).fill(part), 1));
  g.setAttribute('aU', new THREE.Float32BufferAttribute(u || new Float32Array(n), 1));
  g.setAttribute('aEx', new THREE.Float32BufferAttribute(ex || new Float32Array(n * 4), 4));
  return g;
}
// a surface from a (s, t) -> [x, y, z] function; t wraps when closed
function surf(ns, nt, fn, part, closed = false) {
  const pos = [], uv = [], idx = [];
  const nt1 = closed ? nt : nt + 1;
  for (let i = 0; i <= ns; i++) for (let j = 0; j < nt1; j++) {
    const s = i / ns, t = j / nt; const p = fn(s, t); pos.push(p[0], p[1], p[2]); uv.push(s, t);
  }
  for (let i = 0; i < ns; i++) for (let j = 0; j < nt; j++) {
    const a = i * nt1 + j, b = i * nt1 + (closed ? (j + 1) % nt : j + 1), c = a + nt1, d = b + nt1;
    idx.push(a, c, b, b, c, d);
  }
  const g = mk(pos, null, uv, part);
  g.setIndex(idx); g.computeVertexNormals();
  return g.toNonIndexed();
}
const lerp = (a, b, k) => a + (b - a) * k;
function curve(pts, s) {   // Catmull-Rom through pts at s in [0,1]
  const n = pts.length - 1, x = Math.min(n - 1e-6, Math.max(0, s * n)), i = Math.floor(x), f = x - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[Math.min(n, i + 1)], p3 = pts[Math.min(n, i + 2)];
  const f2 = f * f, f3 = f2 * f;
  return [0, 1, 2].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * f + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * f3));
}
// tube along a polyline/curve with radius profile
function tube(pts, r0, r1, ns, nt, part) {
  const frames = [];
  let prevN = null;
  for (let i = 0; i <= ns; i++) {
    const s = i / ns, p = curve(pts, s), q = curve(pts, Math.min(1, s + 0.01)), q0 = curve(pts, Math.max(0, s - 0.01));
    const T = new THREE.Vector3(q[0] - q0[0], q[1] - q0[1], q[2] - q0[2]).normalize();
    let N = prevN ? prevN.clone() : (Math.abs(T.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0));
    N.sub(T.clone().multiplyScalar(N.dot(T))).normalize();
    const B = new THREE.Vector3().crossVectors(T, N);
    prevN = N; frames.push({ p, N, B });
  }
  return surf(ns, nt, (s, t) => {
    const f = frames[Math.round(s * ns)], a = t * Math.PI * 2, r = lerp(r0, r1, Math.pow(s, 0.9));
    return [f.p[0] + (f.N.x * Math.cos(a) + f.B.x * Math.sin(a)) * r, f.p[1] + (f.N.y * Math.cos(a) + f.B.y * Math.sin(a)) * r, f.p[2] + (f.N.z * Math.cos(a) + f.B.z * Math.sin(a)) * r];
  }, part, true);
}
// a flat flame-shaped ribbon along a curve; width profile w(s); ex: [s, phase, amp] for sway
function ribbon(pts, w, ns, part, up = [0, 1, 0], phase = 0, amp = 2) {
  const g = surf(ns, 2, (s, t) => {
    const p = curve(pts, s), q = curve(pts, Math.min(1, s + 0.02)), q0 = curve(pts, Math.max(0, s - 0.02));
    const T = new THREE.Vector3(q[0] - q0[0], q[1] - q0[1], q[2] - q0[2]).normalize();
    const side = new THREE.Vector3().crossVectors(T, new THREE.Vector3(...up)).normalize();
    if (side.lengthSq() < 0.5) side.set(1, 0, 0);
    const k = (t - 0.5) * 2 * w(s);
    return [p[0] + side.x * k, p[1] + side.y * k, p[2] + side.z * k];
  }, part, false);
  const n = g.attributes.position.count, ex = new Float32Array(n * 4), uvA = g.attributes.uv;
  for (let i = 0; i < n; i++) { ex[i * 4] = uvA.getX(i); ex[i * 4 + 1] = phase; ex[i * 4 + 2] = amp; }
  g.setAttribute('aEx', new THREE.Float32BufferAttribute(ex, 4));
  return g;
}
function setEx(g, fn) {
  const n = g.attributes.position.count, ex = new Float32Array(n * 4), P = g.attributes.position, uvA = g.attributes.uv;
  for (let i = 0; i < n; i++) { const e = fn(P.getX(i), P.getY(i), P.getZ(i), uvA.getX(i), uvA.getY(i)); ex.set(e, i * 4); }
  g.setAttribute('aEx', new THREE.Float32BufferAttribute(ex, 4));
  return g;
}
// parts that trail behind the head follow the neck: a vertex z units behind the head anchors to the spine there
function flow(g, minR = 0) {
  const P = g.attributes.position, U = g.attributes.aU, n = P.count;
  for (let i = 0; i < n; i++) {
    const z = P.getZ(i);
    if (z >= 0) continue;
    const u = Math.min(1, -z / DL); let x = P.getX(i), y = P.getY(i);
    const r = Math.hypot(x, y), rr = drad(u) + minR;
    if (minR > 0 && r < rr) { const k = rr / Math.max(r, 1e-3); x *= k; y *= k; }
    P.setXYZ(i, x, y, 0); U.setX(i, u);
  }
  return g;
}
function anchor(g, u) { g.attributes.aU.array.fill(u); return g; }

// ---------------------------------------------------------------- the model
function bodyGeo() {
  const NR = 22, pos = [], nrm = [], uv = [], uu = [], idx = [];
  for (let i = 0; i < NS; i++) {
    const u = i / (NS - 1), r = drad(u);
    for (let j = 0; j <= NR; j++) {
      const a = j / NR * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(c * r, s * r * 0.96, 0); nrm.push(c, s, 0); uv.push(u, j / NR); uu.push(u);
    }
  }
  for (let i = 0; i < NS - 1; i++) for (let j = 0; j < NR; j++) {
    const a = i * (NR + 1) + j, b = a + 1, c = a + NR + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = mk(pos, nrm, uv, BODY, new Float32Array(uu));
  g.setIndex(idx);
  return g.toNonIndexed();
}

// head: local frame x lateral, y up, z forward (snout), anchored at the spine's head end.
// Built at unit scale, then scaled by HS. Classic proportions: camel's head, deer's antlers, ox's ears,
// a big upturned nose, heavy curled brows over bulging eyes, whiskers from the lip, a long beard.
export const HS = 1.3;
function headGeo() {
  const parts = [], flows = [];
  const sec = (arr, s) => { const x = s * (arr.length - 1), i = Math.min(arr.length - 2, Math.floor(x)), f = x - i, k = f * f * (3 - 2 * f); return lerp(arr[i], arr[i + 1], k); };
  // skull + snout: a loft of rounded sections closing in a blunt muzzle
  const Z = [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5, 10.0, 12.5, 14.6, 16.2, 17.2, 17.7];
  const W = [4.3, 5.3, 5.8, 5.4, 4.5, 3.9, 3.8, 4.15, 4.0, 3.1, 1.9, 0.2];
  const TOP = [4.3, 5.6, 6.0, 5.2, 4.0, 3.4, 3.35, 3.9, 4.1, 3.5, 2.7, 1.7];
  const BOT = [-3.3, -2.9, -2.4, -2.1, -1.95, -1.85, -1.75, -1.65, -1.45, -1.0, -0.2, 1.2];
  const skull = surf(34, 28, (s, t) => {
    const z = sec(Z, s), w = sec(W, s), top = sec(TOP, s), bot = sec(BOT, s);
    const a = t * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
    const yc = (top + bot) / 2, hh = (top - bot) / 2;
    let px = Math.sign(c) * Math.pow(Math.abs(c), 0.75) * w;
    let py = yc + Math.sign(sn) * Math.pow(Math.abs(sn), sn > 0 ? 0.8 : 0.45) * hh;
    // brow ridges over the eyes, a raised crown between them
    const up = Math.max(0, sn);
    const brow = Math.exp(-Math.pow((z - 1.6) / 2.3, 2)) * Math.exp(-Math.pow((Math.abs(px) - 3.3) / 1.5, 2)) * up * 1.5;
    const crown = Math.exp(-Math.pow((z + 1.5) / 3.5, 2)) * Math.exp(-Math.pow(px / 1.6, 2)) * up * 0.7;
    // cheekbones flare below and behind the eyes
    const cheek = Math.exp(-Math.pow((z + 2.5) / 2.6, 2)) * Math.exp(-Math.pow((py - 0.4) / 1.8, 2)) * 0.9;
    px *= 1 + cheek * 0.18 / Math.max(1, w * 0.2);
    return [px, py + brow + crown, z];
  }, HEAD, true);
  // masks: x = cream (lip band, snout underside), y = mouth (roof of the mouth)
  setEx(skull, (x, y, z, s, t) => {
    const a = t * Math.PI * 2, sn = Math.sin(a), c = Math.cos(a);
    const lowSide = sn < 0 ? 1 : 0;
    const roof = lowSide * Math.max(0, Math.min(1, (0.55 - Math.abs(c)) * 5)) * (z > -4 && z < 15.4 ? 1 : 0);
    const lip = Math.max(0, Math.min(1, (-0.3 - sn) * 3.5)) * (1 - roof) * Math.max(0, Math.min(1, (z + 1) / 4));
    return [lip, roof, 0, 0];
  });
  parts.push(skull);
  // the nose: two broad bulbs turned up at the muzzle, nostrils flaring forward
  for (const sd of [-1, 1]) {
    const g = new THREE.SphereGeometry(1.7, 16, 12); g.scale(1.0, 0.86, 1.0); g.translate(sd * 1.55, 3.55, 15.2);
    const e = prep(g, NOSE); setEx(e, () => [sd * 1.55, 3.55, 15.2, sd]); parts.push(e);
  }
  { const g = new THREE.SphereGeometry(1.25, 12, 10); g.scale(1.0, 0.8, 1.6); g.translate(0, 4.15, 13.4); parts.push(prep(g, HEAD)); }
  // lip ridge: the upper lip curls up into a scroll at its corner (where the whiskers spring from)
  for (const sd of [-1, 1]) {
    const pts = [[sd * 2.4, 0.05, 16.4], [sd * 3.7, -0.2, 13.4], [sd * 3.95, -0.6, 9.5], [sd * 4.25, -0.2, 6.6], [sd * 4.6, 1.2, 5.4], [sd * 4.75, 2.3, 6.4], [sd * 4.6, 1.8, 7.3]];
    const g = tube(pts, 0.62, 0.3, 30, 7, HEAD); setEx(g, () => [1, 0, 0, 0]); parts.push(g);
  }
  // lower jaw (hinged in the shader)
  const JZ = [-5, -1.5, 2, 6, 9.5, 12.0, 13.4, 14.0], JW = [4.0, 3.9, 3.5, 3.0, 2.6, 2.3, 1.4, 0.2], JT = [-1.8, -2.0, -2.0, -1.9, -1.8, -1.7, -1.65, -1.9], JB = [-4.6, -4.5, -4.0, -3.5, -3.1, -2.9, -2.5, -2.1];
  const jaw = surf(22, 20, (s, t) => {
    const z = sec(JZ, s), w = sec(JW, s), top = sec(JT, s), bot = sec(JB, s);
    const a = t * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
    return [Math.sign(c) * Math.pow(Math.abs(c), 0.75) * w, (top + bot) / 2 + Math.sign(sn) * Math.pow(Math.abs(sn), sn > 0 ? 0.5 : 0.85) * (top - bot) / 2, z];
  }, JAW, true);
  setEx(jaw, (x, y, z, s, t) => {
    const sn = Math.sin(t * Math.PI * 2), c = Math.cos(t * Math.PI * 2);
    const tongue = sn > 0 ? Math.max(0, Math.min(1, (0.85 - Math.abs(c)) * 4)) : 0;
    const chin = sn < 0 ? Math.max(0, Math.min(1, (-sn - 0.2) * 2.5)) : 0;
    return [chin, tongue, 0, 0];
  });
  parts.push(jaw);
  // fangs and teeth
  const cone = (x, y, z, len, r, dir, part, tilt = 0) => { const g = new THREE.ConeGeometry(r, len, 8); g.translate(0, len / 2, 0); if (dir < 0) g.rotateX(Math.PI); g.rotateX(tilt); g.translate(x, y, z); return prep(g, part); };
  for (const sd of [-1, 1]) {
    parts.push(cone(sd * 2.55, -1.3, 13.0, 3.6, 0.62, -1, TOOTH, 0.25));
    parts.push(cone(sd * 1.95, -1.9, 11.6, 2.8, 0.52, 1, LTOOTH, -0.2));
    for (let k = 0; k < 5; k++) {
      const z = 3.4 + k * 1.75;
      parts.push(cone(sd * (sec(W, (z + 7.5) / 25.2) - 0.55), -1.55, z, 1.0, 0.27, -1, TOOTH));
      parts.push(cone(sd * (sec(JW, (z + 5) / 19) - 0.45), -1.95, z - 0.7, 0.85, 0.24, 1, LTOOTH));
    }
  }
  // eyes: big and bulging, under the brows
  for (const sd of [-1, 1]) {
    const g = new THREE.SphereGeometry(1.75, 18, 14); g.translate(sd * 4.25, 3.15, 2.3);
    const e = prep(g, EYE); setEx(e, () => [sd * 4.25, 3.15, 2.3, sd]); parts.push(e);
  }
  // heavy brows: a ridge arching over each eye and curling back into a scroll
  for (const sd of [-1, 1]) {
    const pts = [[sd * 1.5, 6.3, 4.9], [sd * 3.6, 6.25, 4.0], [sd * 5.3, 5.3, 2.4], [sd * 6.2, 5.0, 0.0], [sd * 6.7, 5.9, -2.6], [sd * 6.5, 7.2, -3.6], [sd * 6.1, 7.6, -2.6]];
    parts.push(tube(pts, 0.95, 0.3, 30, 8, HEAD));
  }
  // flame brows streaming back from the scrolls
  for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) {
    const r0 = [sd * (6.0 - k * 0.4), 6.6 + k * 0.4, -2.0 - k * 0.6];
    parts.push(ribbon([r0, [r0[0] + sd * 1.6, r0[1] + 2.0, r0[2] - 3.0], [r0[0] + sd * 2.2, r0[1] + 3.6 - k * 0.6, r0[2] - 7.0 + k], [r0[0] + sd * 1.6, r0[1] + 5.2 - k, r0[2] - 9.5 + k]], s => 0.95 * Math.sin(Math.PI * Math.pow(s, 0.6)) * (1 - s * 0.35), 10, HAIR, [sd, 0.25, 0], k * 1.3, 0.8));
  }
  // antlers: deer-like, sweeping up and back, three tines each
  for (const sd of [-1, 1]) {
    const b = [sd * 2.4, 6.0, -1.4];
    const beam = [b, [b[0] + sd * 0.9, b[1] + 4.2, b[2] - 1.1], [b[0] + sd * 2.4, b[1] + 8.0, b[2] - 4.6], [b[0] + sd * 3.7, b[1] + 10.4, b[2] - 10.0], [b[0] + sd * 4.0, b[1] + 11.6, b[2] - 15.5], [b[0] + sd * 3.5, b[1] + 12.8, b[2] - 19.0]];
    parts.push(tube(beam, 1.05, 0.22, 26, 8, HORN));
    const tine = (u, d, r) => { const p = curve(beam, u); parts.push(tube([p, [p[0] + d[0] * 0.5, p[1] + d[1] * 0.55, p[2] + d[2] * 0.45], [p[0] + d[0], p[1] + d[1], p[2] + d[2]]], r, 0.12, 10, 6, HORN)); };
    tine(0.2, [sd * 1.2, 5.2, 2.8], 0.66);
    tine(0.45, [sd * 2.2, 5.8, 1.2], 0.58);
    tine(0.7, [sd * 2.0, 4.6, -0.4], 0.46);
    tine(0.88, [sd * 0.6, 3.4, -1.4], 0.34);
  }
  // ox ears, below the antlers, turned back
  for (const sd of [-1, 1]) {
    const o = [sd * 4.9, 4.6, -3.2];
    const g = surf(10, 6, (s, t) => {
      const L = 5.4, wd = 2.5 * Math.sin(Math.PI * Math.pow(s, 0.7)) * (1 - 0.25 * s);
      const across = (t - 0.5) * wd, cup = -(1 - Math.pow((t - 0.5) * 2, 2)) * 0.8 * (1 - s);
      // along: back, out and up; across: mostly up; cup: outward
      return [o[0] + sd * (s * L * 0.62 + cup * 0.9), o[1] + s * L * 0.32 + across * 0.85, o[2] - s * L * 0.72 + across * 0.45];
    }, EAR, false);
    parts.push(g);
  }
  // whiskers (龙须): from the lip scrolls, out and back along the body, long and thin
  for (const sd of [-1, 1]) {
    const pts = [[sd * 4.4, 1.6, 6.6], [sd * 7.0, 2.2, 8.0], [sd * 11.5, 0.5, 4.0], [sd * 14.0, -1.0, -6], [sd * 13.0, 2.5, -20], [sd * 11, 0, -36]];
    const g = tube(pts, 0.5, 0.1, 44, 6, WHISK);
    setEx(g, (x, y, z, s) => [s, sd * 1.7, 0, 0]);
    flows.push([g, 0]);
  }
  // beard (髯): long flame tufts under the chin, riding the jaw
  for (let k = 0; k < 7; k++) {
    const x = (k - 3) * 0.75, z = 10.5 - Math.abs(k - 3) * 1.3, L = 1.0 - Math.abs(k - 3) * 0.1;
    const g = ribbon([[x, -3.6, z], [x * 1.3, -6.2 * L, z - 3.0], [x * 1.6, -8.6 * L, z - 7.5], [x * 1.7, -9.4 * L, z - 12.0], [x * 1.5, -8.2 * L, z - 15.0]], s => 0.85 * (1 - s) + 0.12, 12, HAIR, [1, 0, 0], k, 1.2);
    setEx(g, (px, py, pz, s) => [s, k * 1.1, 1.2, 1]);   // w=1: rides on the jaw
    parts.push(g);
  }
  // cheek frills: spiked fans at the jaw corners
  for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) {
    const r0 = [sd * 4.8, -1.6 + k * 1.2, -3.6];
    parts.push(ribbon([r0, [r0[0] + sd * 3.4, r0[1] + 0.2 - k * 0.3, r0[2] - 3.6], [r0[0] + sd * 5.2, r0[1] + 0.8 - k * 0.5, r0[2] - 8.0], [r0[0] + sd * 5.6, r0[1] + 2.0 - k * 0.5, r0[2] - 11.0]], s => 1.2 * Math.sin(Math.PI * Math.pow(s, 0.55)) * (1 - 0.3 * s), 10, HAIR, [0, 1, 0], k * 2.1, 1.4));
  }
  // mane (鬃): flame strands from the crown and cheeks down the neck, tips curling up
  for (let k = 0; k < 17; k++) {
    const a = Math.PI * (0.06 + 0.88 * k / 16), c = Math.cos(a), sn = Math.sin(a);
    const L = 24 + 12 * Math.sin(k * 1.7) ** 2;
    const r0 = [c * 4.9, 2.2 + sn * 3.8, -3.6 - (k % 3) * 0.8];
    const pts = [r0, [c * 6.8, 2.6 + sn * 5.8, r0[2] - L * 0.28], [c * 8.4, 1.6 + sn * 6.6, r0[2] - L * 0.6], [c * 9.0, 1.0 + sn * 6.6, r0[2] - L * 0.85], [c * 8.6, 3.0 + sn * 8.0, r0[2] - L]];
    const g = ribbon(pts, s => (1.5 + 0.5 * Math.sin(k)) * Math.sin(Math.PI * Math.pow(s, 0.5)) * (1 - 0.3 * s), 14, HAIR, [c, sn, 0], k * 0.9, 2.6);
    flows.push([g, 0.8]);
  }
  // scale everything, then let trailing parts follow the neck
  const sc = g => {
    const P = g.attributes.position; for (let i = 0; i < P.count; i++) P.setXYZ(i, P.getX(i) * HS, P.getY(i) * HS, P.getZ(i) * HS);
    const pa = g.attributes.aPart.getX(0);
    if (pa === EYE || pa === NOSE) { const E = g.attributes.aEx; for (let i = 0; i < E.count; i++) E.setXYZ(i, E.getX(i) * HS, E.getY(i) * HS, E.getZ(i) * HS); }
    return g;
  };
  parts.forEach(sc);
  for (const [g, m] of flows) parts.push(flow(sc(g), m));
  return parts;
}
function prep(g, part) {
  const n = g.attributes.position.count;
  const ng = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(ng.attributes)) if (!['position', 'normal', 'uv'].includes(k)) ng.deleteAttribute(k);
  const m = mk(ng.attributes.position.array, ng.attributes.normal.array, ng.attributes.uv ? ng.attributes.uv.array : new Float32Array(ng.attributes.position.count * 2), part);
  void n; return m;
}

// legs: shoulder at the body side, upper arm down/back, forearm forward, five curved eagle claws
function legGeo(u, sd, front) {
  const r = drad(u), parts = [], L = 1.5;
  const sh = [sd * r * 0.72, -r * 0.42, 0];
  const el = [sh[0] + sd * 4.0 * L, sh[1] - 4.8 * L, sh[2] - (front ? 3.5 : 4.5) * L];
  const wr = [el[0] + sd * 1.2 * L, el[1] - 5.2 * L, el[2] + (front ? 4.2 : 3.4) * L];
  const k = (front ? 1 : 0.94) * L;
  parts.push(tube([sh, [lerp(sh[0], el[0], 0.5) + sd * 0.6, lerp(sh[1], el[1], 0.5), lerp(sh[2], el[2], 0.5)], el], 2.2 * k, 1.3 * k, 12, 10, LEG));
  parts.push(tube([el, [lerp(el[0], wr[0], 0.5), lerp(el[1], wr[1], 0.5), lerp(el[2], wr[2], 0.5) - 0.4], wr], 1.3 * k, 0.9 * k, 12, 10, LEG));
  const palm = new THREE.SphereGeometry(1.25 * k, 12, 9); palm.scale(1.15, 0.65, 1.3); palm.translate(wr[0], wr[1] - 0.4 * L, wr[2] + 0.5 * L); parts.push(prep(palm, LEG));
  for (let c = 0; c < 5; c++) {
    const a = (c - 2) * 0.45 + sd * 0.1, len = (c === 0 || c === 4 ? 2.4 : 3.3) * L;
    const b0 = [wr[0] + Math.sin(a) * 0.9 * L, wr[1] - 0.6 * L, wr[2] + Math.cos(a) * 0.9 * L + 0.5 * L];
    const pts = [b0, [b0[0] + Math.sin(a) * len * 0.5, b0[1] - 0.3 * L, b0[2] + Math.cos(a) * len * 0.5], [b0[0] + Math.sin(a) * len * 0.82, b0[1] - 1.2 * L, b0[2] + Math.cos(a) * len * 0.78], [b0[0] + Math.sin(a) * len * 0.9, b0[1] - 2.3 * L, b0[2] + Math.cos(a) * len * 0.6]];
    parts.push(tube(pts, 0.42 * k, 0.04, 10, 6, CLAW));
  }
  // flame tufts at the elbow, streaming back
  for (let t = 0; t < 3; t++) {
    const r0 = [el[0] + sd * 0.5, el[1] + 0.8 - t * 0.9, el[2] - 0.6];
    parts.push(ribbon([r0, [r0[0] + sd * 1.8, r0[1] + 1.0, r0[2] - 4.5], [r0[0] + sd * 2.6, r0[1] + 2.4 - t, r0[2] - 9.5], [r0[0] + sd * 2.2, r0[1] + 4.0 - t, r0[2] - 12.0]], s => 1.2 * Math.sin(Math.PI * Math.pow(s, 0.5)), 10, LHAIR, [0, 1, 0], t * 1.7 + sd, 1.2));
  }
  const g = mergeGeometries(parts, false);
  const ph = (front ? 0 : 1.9) + (sd > 0 ? 0 : Math.PI);
  const n = g.attributes.position.count, ex = g.attributes.aEx;
  for (let i = 0; i < n; i++) ex.setXYZW(i, sh[0], sh[1], sh[2], ph);
  return anchor(g, u);
}
function finGeo() {
  // dorsal spines along the back, alternating tall and short, leaning back, shrinking to the tail
  const parts = [];
  const N = 50;
  for (let k = 0; k < N; k++) {
    const u = 0.075 + k / (N - 1) * 0.86, r = drad(u), big = k % 2 === 0;
    const h = r * (big ? 1.0 : 0.62) + 0.9, base = 2.2 + r * 0.32;
    const g = surf(7, 1, (s, t) => {
      const wdt = base * Math.pow(1 - s, 1.15);
      const zc = -s * s * base * 1.15;
      return [0, r * 0.82 + s * h, zc + (0.5 - t) * wdt];
    }, FIN, false);
    setEx(g, (x, y, z, s) => [s, k * 0.7, 0, 0]);
    parts.push(anchor(g, u));
  }
  return parts;
}
function tailGeo() {
  const parts = [];
  for (let k = 0; k < 9; k++) {
    const a = (k - 4) * 0.32, L = 13 + 7 * Math.cos(a * 1.4);
    const pts = [[0, 0, 0], [Math.sin(a) * 3, Math.cos(a) * 2 + 1, -L * 0.35], [Math.sin(a) * 6.5, Math.cos(a) * 4.5 + 1.2, -L * 0.75], [Math.sin(a) * 8, Math.cos(a) * 6 + 0.5, -L]];
    const g = ribbon(pts, s => 1.4 * Math.sin(Math.PI * Math.pow(s, 0.45)) * (1 - 0.3 * s), 10, HAIR, [Math.cos(a), -Math.sin(a), 0], k * 0.8, 2.4);
    parts.push(anchor(g, 1));
  }
  return parts;
}

// ---------------------------------------------------------------- shaders
const VERT = /* glsl */`
attribute float aU; attribute float aPart; attribute vec4 aEx;
uniform sampler2D uSpine; uniform float uTime; uniform float uJaw; uniform float uSwim;
varying vec3 vN; varying vec3 vW; varying vec3 vObj; varying float vU; varying float vPart; varying vec2 vUv; varying vec3 vLoc; varying vec4 vEx;
vec3 sp(int row, float u){
  float x = clamp(u, 0.0, 1.0) * ${NS - 1}.0; int i0 = int(floor(x)); int i1 = min(i0 + 1, ${NS - 1});
  return mix(texelFetch(uSpine, ivec2(i0, row), 0).xyz, texelFetch(uSpine, ivec2(i1, row), 0).xyz, x - float(i0));
}
vec3 rx(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c); }
void main(){
  vec3 o = position; vec3 n = normal; float pt = aPart;
  bool jaw = (pt > 1.5 && pt < 2.5) || (pt > 10.5 && pt < 11.5) || (pt > 6.5 && pt < 7.5 && aEx.w > 0.5 && aEx.w < 1.5);
  if (jaw) { vec3 h = vec3(0.0, ${(-2.2 * HS).toFixed(3)}, ${(-3.5 * HS).toFixed(3)}); o = rx(o - h, uJaw) + h; n = rx(n, uJaw); }
  if ((pt > 8.5 && pt < 10.5) || (pt > 11.5 && pt < 12.5)) {
    // legs paddle about the shoulder; the elbow tufts trail behind, swinging with them
    vec3 pv = aEx.xyz; float a = sin(uTime * uSwim * 1.25 + aEx.w) * 0.5;
    if (pt > 11.5 && pt < 12.5) { float s = uv.x; o += vec3(sin(uTime * 2.6 + s * 4.5 + aEx.w), cos(uTime * 2.0 + s * 4.0) * 0.6, 0.0) * s * s * 1.2; }
    o = rx(o - pv, a) + pv; n = rx(n, a);
  }
  if (pt > 5.5 && pt < 6.5) { float s = aEx.x; o += vec3(sin(uTime * 2.1 + s * 6.0 + aEx.y) * 2.4, cos(uTime * 1.7 + s * 5.0 + aEx.y) * 1.8, 0.0) * s * s; }
  if (pt > 6.5 && pt < 7.5) { float s = aEx.x; o += vec3(sin(uTime * 2.6 + s * 4.5 + aEx.y), cos(uTime * 2.0 + s * 4.0 + aEx.y) * 0.7, sin(uTime * 1.3 + aEx.y) * 0.3) * s * s * aEx.z; }
  if (pt > 7.5 && pt < 8.5) { float s = aEx.x; o.x += sin(uTime * 3.0 + aU * 34.0) * s * 0.6; }
  vec3 P = sp(0, aU), T = normalize(sp(1, aU) + vec3(0.0, 0.0, 1e-5)), Up = normalize(sp(2, aU) + vec3(0.0, 1e-5, 0.0)), B = normalize(sp(3, aU) + vec3(1e-5, 0.0, 0.0));
  vec3 wp = P + B * o.x + Up * o.y + T * o.z;
  vN = B * n.x + Up * n.y + T * n.z;
  vW = wp; vObj = vec3(o.xy, o.z + aU * ${DL}.0); vU = aU; vPart = pt; vUv = uv; vLoc = o; vEx = aEx;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;

const FRAG = /* glsl */`
uniform float uTime; uniform float uCorrupt; uniform float uFreed; uniform float uHit; uniform float uFade; uniform vec3 uInk;
varying vec3 vN; varying vec3 vW; varying vec3 vObj; varying float vU; varying float vPart; varying vec2 vUv; varying vec3 vLoc; varying vec4 vEx;
${NOISE}
${SKY}
${FOG}
${DISSOLVE}
vec3 scales(vec2 q, out float rim){
  // overlapping scallops; q.x along the body, q.y around it
  q.y += mod(floor(q.x), 2.0) * 0.5;
  vec2 f = fract(q);
  float d = length((f - vec2(1.0, 0.5)) * vec2(1.0, 1.25));
  rim = smoothstep(0.5, 0.62, d) * smoothstep(0.86, 0.62, d);
  return vec3(d);
}
void main(){
  vec3 N = normalize(vN + vec3(0.0, 1e-6, 0.0)); vec3 V = normalize(cameraPosition - vW);
  if (dot(N, V) < 0.0) N = -N;
  float fres = pow(clamp(1.0 - dot(N, V), 0.0, 1.0), 2.0);
  float ndl = dot(N, uSunDir) * 0.5 + 0.5;
  vec3 gold = vec3(1.9, 1.32, 0.52);
  vec3 verm = vec3(1.15, 0.22, 0.1);
  vec3 ink = uInk * 1.15;
  int part = int(vPart + 0.5);
  vec3 col; float alpha = 1.0; float glow = 0.0;
  float cor = uCorrupt * (1.0 - uFreed);
  if (part == ${BODY} || part == ${HEAD} || part == ${JAW} || part == ${LEG} || part == ${NOSE} || part == ${EAR}) {
    float ang = atan(vLoc.y, vLoc.x);
    float up = sin(ang);
    float rim = 0.0;
    vec3 skin = mix(ink * 1.1, ink * 2.6 + vec3(0.04, 0.05, 0.05), ndl * 0.55);
    vec3 cream = vec3(0.86, 0.71, 0.44) * (0.45 + 0.55 * ndl);
    if (part == ${BODY} || part == ${LEG}) {
      vec2 q = part == ${BODY} ? vec2(vU * ${DL}.0 / 2.5, ang * 2.1) : vec2(vObj.z / 1.1, (vObj.x + vObj.y * 0.7) / 1.0);
      scales(q, rim);
      skin += vec3(0.75, 0.58, 0.28) * rim * (0.2 + fres * 0.8);
    }
    // belly plates on the underside of the body
    if (part == ${BODY}) {
      float belly = smoothstep(-0.3, -0.62, up);
      float pl = fract(vU * ${DL}.0 / 2.1);
      vec3 bc = cream * (0.75 + 0.25 * smoothstep(0.0, 0.12, pl) * smoothstep(1.0, 0.82, pl));
      bc *= 0.62 + 0.38 * smoothstep(-0.45, -0.95, up);   // rounder: brighter down the middle, darker at the flanks
      skin = mix(skin, bc, belly);
      skin += gold * 0.12 * smoothstep(0.7, 1.0, up) * fres;
    } else if (part != ${LEG}) {
      // the face: smooth hide, faint wrinkles, gold catching the ridges; cream lips and chin; red mouth
      float wr = vnoise(vec2(vLoc.z * 1.6, vLoc.y * 2.2 + vLoc.x * 0.4));
      skin *= 0.8 + 0.35 * wr;
      // small scales over the crown and down the cheeks
      if (part == ${HEAD}) {
        float crown = smoothstep(${(5 * HS).toFixed(2)}, ${(1 * HS).toFixed(2)}, vLoc.z) * smoothstep(-0.2, 0.4, normalize(vLoc - vec3(0.0, ${(1.2 * HS).toFixed(2)}, vLoc.z) + vec3(0.0, 1e-4, 0.0)).y + 0.3);
        scales(vec2(vLoc.z / 0.9, (vLoc.x + vLoc.y * 0.6) / 0.8), rim);
        skin += vec3(0.75, 0.58, 0.28) * rim * (0.15 + fres * 0.6) * crown;
      }
      skin += gold * 0.08 * fres;
      if (part == ${HEAD} || part == ${JAW}) {
        skin = mix(skin, cream, clamp(vEx.x, 0.0, 1.0) * 0.9);
        skin = mix(skin, vec3(0.34, 0.035, 0.04) * (0.55 + 0.45 * ndl), clamp(vEx.y, 0.0, 1.0));
      }
      if (part == ${NOSE}) {
        vec3 d = normalize(vLoc - vEx.xyz + vec3(0.0, 1e-4, 0.0));
        float nd = dot(d, normalize(vec3(vEx.w * 0.6, 0.25, 0.76)));
        skin = mix(skin, vec3(0.03, 0.005, 0.005), smoothstep(0.86, 0.92, nd));
      }
      if (part == ${EAR}) skin = mix(skin, vec3(0.42, 0.07, 0.06) * (0.6 + 0.4 * ndl), smoothstep(0.42, 0.1, abs(vUv.y - 0.5)) * smoothstep(0.05, 0.3, vUv.x) * smoothstep(1.0, 0.55, vUv.x));
    }
    col = skin + skyCol(-V) * fres * 0.35;
    // corruption: ink veins with embers glowing through
    float vn = fbm3(vObj * 0.055 + vec3(0.0, uTime * 0.05, 0.0));
    col = mix(col, ink * 0.5, smoothstep(0.55, 0.6, vn) * cor * 0.6);
    glow += smoothstep(0.585, 0.6, vn) * smoothstep(0.64, 0.6, vn) * cor * (0.7 + 0.3 * sin(uTime * 3.0 + vObj.z * 0.05));
    col += vec3(1.0, 0.12, 0.04) * glow * 2.4;
    // freed: gold
    vec3 freed = mix(vec3(1.25, 0.86, 0.34), gold * 1.1, rim * 0.6 + fres * 0.6) * (0.55 + 0.45 * ndl);
    if (part == ${BODY}) freed = mix(freed, vec3(1.5, 1.25, 0.8) * (0.6 + 0.4 * ndl), smoothstep(-0.35, -0.7, up) * 0.8);
    col = mix(col, freed, uFreed * 0.85);
  } else if (part == ${TOOTH} || part == ${LTOOTH} || part == ${CLAW}) {
    col = vec3(0.93, 0.88, 0.76) * (0.55 + 0.45 * ndl) + fres * 0.3;
    col = mix(col, gold, uFreed * 0.5);
  } else if (part == ${EYE}) {
    vec3 e = normalize(vLoc - vEx.xyz + vec3(0.0, 1e-4, 0.0));
    vec3 ax = normalize(vec3(vEx.w * 0.85, 0.1, 0.55));
    float c = dot(e, ax);
    vec3 iris = mix(vec3(3.0, 2.0, 0.45), vec3(3.2, 0.75, 0.1), cor);
    col = mix(vec3(0.85, 0.78, 0.6) * 0.5, iris * (0.75 + 0.25 * c), smoothstep(0.42, 0.55, c));
    vec3 tang = normalize(cross(ax, vec3(0.0, 1.0, 0.0)));
    float slit = smoothstep(0.24, 0.12, abs(dot(e, tang))) * smoothstep(0.62, 0.74, c);
    col = mix(col, vec3(0.01), slit);
    col *= smoothstep(-0.1, 0.35, c);
    col += vec3(1.0) * pow(max(dot(reflect(-V, N), normalize(vec3(0.3, 0.8, 0.5))), 0.0), 24.0) * 0.8;
  } else if (part == ${HORN}) {
    float s = vUv.x;
    col = mix(ink * 2.0 + vec3(0.06, 0.04, 0.02), vec3(0.95, 0.84, 0.6), smoothstep(0.1, 0.85, s)) * (0.5 + 0.5 * ndl);
    col *= 0.8 + 0.2 * smoothstep(0.3, 0.5, abs(fract(s * 11.0) - 0.5));
    col += fres * 0.25 + gold * uFreed * 0.5;
  } else if (part == ${WHISK}) {
    float s = vUv.x;
    col = mix(ink * 1.4, gold * 0.75, smoothstep(0.55, 1.0, s)) + fres * 0.2;
    col = mix(col, gold, uFreed * 0.6);
  } else if (part == ${HAIR} || part == ${LHAIR}) {
    // brush-stroke flames: fibres along each strand, vermilion root, crimson body, ink tips
    float s = vUv.x, w = abs(vUv.y - 0.5) * 2.0;
    float fib = vnoise(vec2(vUv.y * 22.0 + vEx.y * 7.0, s * 2.2 - uTime * 0.35));
    float fib2 = vnoise(vec2(vUv.y * 60.0 + vEx.y * 3.0, s * 5.0));
    float edge = 1.0 - smoothstep(0.4 + fib * 0.45, 1.0, w);
    alpha = edge * smoothstep(1.0, 0.68 + fib * 0.26, s) * (0.75 + 0.25 * fib2);
    vec3 root = mix(vec3(1.35, 0.42, 0.12), vec3(0.95, 0.16, 0.06), cor);
    vec3 body = mix(verm, vec3(0.5, 0.03, 0.04), cor);
    vec3 tip = mix(ink * 0.9, vec3(0.04, 0.0, 0.01), cor);
    col = mix(root, body, smoothstep(0.0, 0.4, s));
    col = mix(col, tip, smoothstep(0.42, 1.0, s) * (0.55 + 0.45 * fib));
    col *= 0.6 + 0.55 * fib2;
    col += vec3(1.0, 0.5, 0.15) * (1.0 - w) * (1.0 - s) * 0.25;
    col = mix(col, mix(gold * 1.1, vec3(1.4, 0.55, 0.15), s) * (0.7 + 0.4 * fib2), uFreed * 0.85);
  } else if (part == ${FIN}) {
    float s = vUv.x;
    float streak = vnoise(vec2(vUv.y * 14.0, s * 3.0));
    col = mix(mix(verm, vec3(0.5, 0.03, 0.05), cor) * 0.9, ink * 0.8, smoothstep(0.85, 0.25, s) * 0.55);
    col += vec3(1.0, 0.5, 0.15) * smoothstep(0.75, 1.0, s) * 0.25;
    col = mix(col, gold * 1.05, uFreed * 0.85);
    alpha = (0.78 + streak * 0.22) * smoothstep(1.0, 0.86 + streak * 0.1, s);
  }
  col = mix(col, vec3(1.9, 1.75, 1.5), uHit * 0.45);
  col = dissolve(col, vObj, 0.06);
  col = applyFog(col, vW, 0.4);
  gl_FragColor = vec4(col, alpha * uFade);
}`;

// the flaming pearl (龙珠): a luminous sphere, cracked with crimson while corrupted
const PEARL_V = /* glsl */`
varying vec3 vN; varying vec3 vW; varying vec3 vObj;
uniform float uTime;
void main(){
  vec3 p = position * (1.0 + 0.03 * sin(uTime * 5.0 + position.y));
  vObj = position; vec4 wp = modelMatrix * vec4(p, 1.0); vW = wp.xyz; vN = mat3(modelMatrix) * normal;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const PEARL_F = /* glsl */`
uniform float uTime; uniform float uHit; uniform float uA; uniform float uPure;
varying vec3 vN; varying vec3 vW; varying vec3 vObj;
${NOISE}
void main(){
  vec3 N = normalize(vN + vec3(0.0, 1e-6, 0.0)); vec3 V = normalize(cameraPosition - vW);
  float fres = pow(clamp(1.0 - abs(dot(N, V)), 0.0, 1.0), 2.0);
  vec3 p = vObj * 0.32;
  float sw = fbm3(p + vec3(uTime * 0.3, -uTime * 0.2, 0.0) + fbm3(p * 2.0 - uTime * 0.15) * 1.5);
  vec3 dark = vec3(0.03, 0.01, 0.02) + vec3(1.0, 0.1, 0.04) * smoothstep(0.52, 0.56, sw) * smoothstep(0.62, 0.56, sw) * 3.2 * (0.7 + 0.3 * sin(uTime * 6.0));
  dark += vec3(0.9, 0.14, 0.05) * pow(fres, 2.5) * 2.0;
  vec3 pure = mix(vec3(1.5, 1.4, 1.2), vec3(2.6, 1.9, 0.9), sw) + vec3(1.0, 0.6, 0.25) * fres * 1.6;
  vec3 col = mix(dark, pure, uPure);
  col = mix(col, vec3(2.5), uHit * 0.6);
  gl_FragColor = vec4(col * uA, 1.0);
}`;

// ---------------------------------------------------------------- Dragon
export class Dragon {
  constructor(scene) {
    this.tex = new THREE.DataTexture(new Float32Array(NS * 4 * 4), NS, 4, THREE.RGBAFormat, THREE.FloatType);
    this.tex.magFilter = this.tex.minFilter = THREE.NearestFilter; this.tex.needsUpdate = true;
    this.u = {
      uSpine: { value: this.tex }, uTime: { value: 0 }, uJaw: { value: 0.12 }, uSwim: { value: 1.6 },
      uCorrupt: { value: 1 }, uFreed: { value: 0 }, uHit: { value: 0 }, uFade: { value: 1 },
      uDissolve: { value: 0 }, uEmber: { value: new THREE.Color(2.8, 2.0, 0.8) },
    };
    const all = [bodyGeo(), ...headGeo(), ...[0.16, 0.56].flatMap(u => [-1, 1].map(sd => legGeo(u, sd, u < 0.3))), ...finGeo(), ...tailGeo()];
    const isHair = p => p === HAIR || p === FIN || p === LHAIR;
    const split = want => all.map(g => filterPart(g, p => isHair(p) === want)).filter(Boolean);
    const solidG = mergeGeometries(split(false), false);
    const hairG = mergeGeometries(split(true), false);
    this.mat = new THREE.ShaderMaterial({ uniforms: uni(this.u), vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide });
    this.hairMat = new THREE.ShaderMaterial({ uniforms: uni(this.u), vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.group = new THREE.Group();
    this.body = new THREE.Mesh(solidG, this.mat); this.hair = new THREE.Mesh(hairG, this.hairMat); this.hair.renderOrder = 4;
    this.group.add(this.body, this.hair);
    this.group.traverse(o => { o.frustumCulled = false; });
    this.group.visible = false; scene.add(this.group);

    this.pu = { uTime: { value: 0 }, uHit: { value: 0 }, uA: { value: 1 }, uPure: { value: 0 } };
    this.pearl = new THREE.Mesh(new THREE.IcosahedronGeometry(7, 4), new THREE.ShaderMaterial({ uniforms: this.pu, vertexShader: PEARL_V, fragmentShader: PEARL_F }));
    this.pearl.visible = false; this.pearl.frustumCulled = false; scene.add(this.pearl);

    this.hist = [];     // head path in camera space [x, y, d]
    this.P = []; this.T = []; this.Up = []; this.B = [];
    for (let i = 0; i < NS; i++) { this.P.push(new THREE.Vector3()); this.T.push(new THREE.Vector3(0, 0, 1)); this.Up.push(new THREE.Vector3(0, 1, 0)); this.B.push(new THREE.Vector3(1, 0, 0)); }
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3();
  }
  // start with the whole body hidden beneath the clouds, the head at (x, y, d) in camera space
  reset(x, y, d) {
    this.hist.length = 0;
    for (let k = 120; k >= 0; k--) this.hist.push([x + Math.sin(k * 0.05) * 12, y - k * (DL + 40) / 120, d + k * 0.4]);
  }
  push(x, y, d) {
    const l = this.hist[this.hist.length - 1];
    if (l && Math.hypot(l[0] - x, l[1] - y, l[2] - d) < 0.2) return;
    this.hist.push([x, y, d]);
    // keep just enough path for the body
    let len = 0;
    for (let i = this.hist.length - 1; i > 0; i--) {
      const a = this.hist[i], b = this.hist[i - 1];
      len += Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      if (len > DL + 60) { this.hist.splice(0, i - 1); break; }
    }
  }
  // camera-space -> world
  w(C, x, y, d, out) { return out.copy(C.camPos).addScaledVector(C.F, d).addScaledVector(C.R, x).addScaledVector(C.U, y); }
  update(dt, C, time) {
    const u = this.u; u.uTime.value = time; this.pu.uTime.value = time;
    u.uHit.value = Math.max(0, u.uHit.value - dt * 4);
    // resample the head's path into evenly spaced spine points
    const H = this.hist, ds = DL / (NS - 1);
    let i = H.length - 1, acc = 0, segLen = 0, k = 0;
    const cur = [0, 0, 0];
    this.w(C, H[i][0], H[i][1], H[i][2], this.P[0]);
    for (let s = 1; s < NS; s++) {
      const want = s * ds;
      while (i > 0) {
        const a = H[i], b = H[i - 1];
        segLen = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        if (acc + segLen >= want) break;
        acc += segLen; i--;
      }
      if (i > 0) {
        const a = H[i], b = H[i - 1], f = segLen > 1e-6 ? (want - acc) / segLen : 0;
        cur[0] = lerp(a[0], b[0], f); cur[1] = lerp(a[1], b[1], f); cur[2] = lerp(a[2], b[2], f);
      } else { const a = H[0]; cur[0] = a[0]; cur[1] = a[1] - (want - acc); cur[2] = a[2]; }
      this.w(C, cur[0], cur[1], cur[2], this.P[s]);
      k = s;
    }
    void k;
    // frames: tangent toward the head, dorsal side kept up relative to the screen
    const P = this.P, T = this.T, Up = this.Up, B = this.B, cu = C.U;
    for (let s = 0; s < NS; s++) {
      const a = P[Math.max(0, s - 1)], b = P[Math.min(NS - 1, s + 1)];
      T[s].subVectors(a, b); if (T[s].lengthSq() < 1e-8) T[s].copy(C.F); T[s].normalize();
      if (s === 0) T[0].subVectors(P[0], P[1]).normalize();
    }
    for (let s = 0; s < NS; s++) {
      const prev = s === 0 ? cu : Up[s - 1];
      this._a.copy(prev).addScaledVector(T[s], -prev.dot(T[s]));
      this._b.copy(cu).addScaledVector(T[s], -cu.dot(T[s]));
      this._a.addScaledVector(this._b, s === 0 ? 1 : 0.06);
      if (this._a.lengthSq() < 1e-6) this._a.copy(C.R).cross(T[s]);
      Up[s].copy(this._a.normalize());
      B[s].crossVectors(Up[s], T[s]).normalize();
    }
    const d = this.tex.image.data;
    for (let s = 0; s < NS; s++) {
      const rows = [P[s], T[s], Up[s], B[s]];
      for (let r = 0; r < 4; r++) { const o = (r * NS + s) * 4; d[o] = rows[r].x; d[o + 1] = rows[r].y; d[o + 2] = rows[r].z; d[o + 3] = 1; }
    }
    this.tex.needsUpdate = true;
  }
  // a point on the dragon: spine position at u, offset (x lateral, y dorsal, z forward) in its frame
  at(u, x, y, z, out) {
    const f = Math.min(NS - 1.001, Math.max(0, u * (NS - 1))), i = Math.floor(f), t = f - i;
    out.lerpVectors(this.P[i], this.P[i + 1], t);
    out.addScaledVector(this.B[i], x).addScaledVector(this.Up[i], y).addScaledVector(this.T[i], z);
    return out;
  }
  mouth(out) { return this.at(0, 0, -1.6 * HS, 15 * HS, out); }
}
function filterPart(g, keep) {
  const p = g.attributes.aPart, n = p.count;
  let any = false, all = true;
  for (let i = 0; i < n; i++) { const k = keep(p.getX(i)); any = any || k; all = all && k; }
  if (all) return g;
  if (!any) return null;
  // non-indexed: keep whole triangles whose first vertex passes
  const out = new THREE.BufferGeometry(), keepIdx = [];
  for (let t = 0; t < n; t += 3) if (keep(p.getX(t))) keepIdx.push(t, t + 1, t + 2);
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name], sz = a.itemSize, arr = new Float32Array(keepIdx.length * sz);
    keepIdx.forEach((v, j) => { for (let c = 0; c < sz; c++) arr[j * sz + c] = a.array[v * sz + c]; });
    out.setAttribute(name, new THREE.BufferAttribute(arr, sz));
  }
  return out;
}

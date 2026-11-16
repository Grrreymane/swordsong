import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { uni, NOISE, SKY, FOG, DISSOLVE } from './glsl.js';
import { talismanTexture, lanternTexture, sigilTexture } from './textures.js';
import { smallSwordGeometry } from './player.js';

export const DEF = {
  talisman: { hp: 1, score: 100, radius: 2.5 },
  fish: { hp: 1, score: 120, radius: 2.4 },
  lantern: { hp: 2, score: 300, radius: 2.3 },
  wisp: { hp: 1, score: 60, radius: 1.5, projectile: true },
  disc: { hp: 3, score: 450, radius: 2.5 },
  orb: { hp: 1, score: 150, radius: 1.8 },
  head: { hp: 3, score: 600, radius: 2.4 },
  jade: { hp: 1, score: 250, radius: 2.0, pickup: 'heal' },
  soul: { hp: 1, score: 250, radius: 2.0, pickup: 'od' },
  seal: { hp: 3, score: 1500, radius: 3.6, boss: true },
  heart: { hp: 16, score: 8000, radius: 8.5, boss: true },
};

// ------------------------------------------------------------ geometry helpers
function prep(geo, partId, extra = {}) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position.count;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(n).fill(partId), 1));
  const u = new Float32Array(n);
  if (extra.uFn) { const pa = g.attributes.position; for (let i = 0; i < n; i++) u[i] = extra.uFn(pa.getX(i), pa.getY(i), pa.getZ(i)); }
  g.setAttribute('aU', new THREE.Float32BufferAttribute(u, 1));
  return g;
}

export function fishGeometry(L = 5, R = 0.95) {
  const NS = 20, NR = 14, pos = [], idx = [];
  for (let i = 0; i <= NS; i++) {
    const u = 0.03 + (i / NS) * 0.97;
    const z = L / 2 - (i / NS) * L;
    const r = R * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.72)), 0.78) * (1 - 0.32 * u) + 0.02;
    for (let j = 0; j < NR; j++) {
      const a = j / NR * Math.PI * 2;
      let y = Math.sin(a) * r; if (y < 0) y *= 0.82;
      pos.push(Math.cos(a) * r * 0.6, y, z);
    }
  }
  for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++) {
    const a = i * NR + j, b = i * NR + (j + 1) % NR, c = (i + 1) * NR + j, d = (i + 1) * NR + (j + 1) % NR;
    idx.push(a, b, c, b, d, c);
  }
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); body.setIndex(idx); body.computeVertexNormals();
  const uFn = (x, y, z) => Math.min(1, Math.max(0, (L / 2 - z) / L));
  const parts = [prep(body, 0, { uFn })];
  const tz = -L / 2;
  const tail = new THREE.BufferGeometry();
  tail.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, tz + 0.35, 0, 1.25, tz - 1.7, 0, 0.2, tz - 1.05,
    0, 0, tz + 0.35, 0, 0.2, tz - 1.05, 0, -0.2, tz - 1.05,
    0, 0, tz + 0.35, 0, -0.2, tz - 1.05, 0, -1.25, tz - 1.7,
  ], 3));
  tail.computeVertexNormals();
  parts.push(prep(tail, 1, { uFn: (x, y, z) => Math.min(1.6, (L / 2 - z) / L) }));
  const dor = new THREE.BufferGeometry();
  const dz0 = L / 2 - L * 0.22, dz1 = L / 2 - L * 0.62;
  dor.setAttribute('position', new THREE.Float32BufferAttribute([0, R * 0.78, dz0, 0, R * 1.5, dz0 - 0.5, 0, R * 0.62, dz1, 0, R * 1.5, dz0 - 0.5, 0, R * 1.1, dz1 - 0.3, 0, R * 0.62, dz1], 3));
  dor.computeVertexNormals();
  parts.push(prep(dor, 1, { uFn }));
  for (const s of [-1, 1]) {
    const pz = L / 2 - L * 0.3;
    const pec = new THREE.BufferGeometry();
    pec.setAttribute('position', new THREE.Float32BufferAttribute([s * R * 0.5, -R * 0.35, pz, s * R * 1.5, -R * 0.9, pz - 0.9, s * R * 0.45, -R * 0.4, pz - 0.6], 3));
    pec.computeVertexNormals();
    parts.push(prep(pec, 1, { uFn }));
    const eye = new THREE.IcosahedronGeometry(0.12, 1); eye.translate(s * R * 0.42, R * 0.3, L / 2 - L * 0.1);
    parts.push(prep(eye, 2, { uFn }));
  }
  return mergeGeometries(parts, false);
}

function lanternGeometry() {
  const prof = [[0.0, -1.35], [0.45, -1.32], [0.6, -1.2], [1.0, -0.82], [1.18, -0.25], [1.2, 0], [1.18, 0.25], [1.0, 0.82], [0.6, 1.2], [0.45, 1.32], [0.0, 1.35]]
    .map(p => new THREE.Vector2(p[0], p[1]));
  const lathe = new THREE.LatheGeometry(prof, 18);
  const parts = [prep(lathe, 0)];
  for (const y of [-1.36, 1.36]) { const c = new THREE.CylinderGeometry(0.52, 0.52, 0.2, 14); c.translate(0, y, 0); parts.push(prep(c, 1)); }
  const top = new THREE.TorusGeometry(0.25, 0.05, 6, 12); top.translate(0, 1.62, 0); parts.push(prep(top, 1));
  for (let k = 0; k < 5; k++) {
    const b = new THREE.BoxGeometry(0.06, 1.1 + (k % 2) * 0.25, 0.06); const a = k / 5 * 6.283;
    b.translate(Math.cos(a) * 0.18, -2.0 - (k % 2) * 0.12, Math.sin(a) * 0.18); parts.push(prep(b, 2));
  }
  const knot = new THREE.OctahedronGeometry(0.16, 0); knot.translate(0, -1.5, 0); parts.push(prep(knot, 2));
  return mergeGeometries(parts, false);
}

function discGeometry() {
  const prof = [[0.55, -0.15], [1.78, -0.15], [1.9, 0], [1.78, 0.15], [0.55, 0.15], [0.47, 0], [0.55, -0.15]].map(p => new THREE.Vector2(p[0], p[1]));
  const g = new THREE.LatheGeometry(prof, 36); g.rotateX(Math.PI / 2);
  return mergeGeometries([prep(g, 0)], false);
}

function headGeometry() {
  const parts = [];
  const h = new THREE.IcosahedronGeometry(1.25, 2); h.scale(1, 0.8, 1.35); parts.push(prep(h, 0));
  for (const s of [-1, 1]) {
    const horn = new THREE.ConeGeometry(0.16, 1.6, 6); horn.rotateX(-Math.PI * 0.62); horn.rotateZ(s * 0.35); horn.translate(s * 0.55, 0.95, -0.55); parts.push(prep(horn, 1));
    const eye = new THREE.IcosahedronGeometry(0.17, 1); eye.translate(s * 0.62, 0.32, 1.05); parts.push(prep(eye, 2));
    const wh = new THREE.CylinderGeometry(0.03, 0.01, 2.2, 4); wh.rotateX(Math.PI / 2); wh.rotateY(s * 0.6); wh.translate(s * 0.9, -0.25, 1.4); parts.push(prep(wh, 1));
  }
  return mergeGeometries(parts, false);
}

// ------------------------------------------------------------ shaders
const STD_V = /* glsl */`
attribute float aPart; attribute float aU;
uniform float uTime; uniform float uPhase; uniform float uSwim; uniform float uBend;
varying vec3 vN; varying vec3 vW; varying vec3 vObj; varying float vPart; varying float vU; varying vec2 vUv;
void main(){
  vec3 p = position;
  vPart = aPart; vU = aU; vUv = uv;
  if (uSwim > 0.0) {
    float w = sin(aU * 5.2 - uTime * uSwim + uPhase);
    p.x += w * (0.06 + aU * aU * 0.6) * uBend;
    if (aPart > 0.5 && aPart < 1.5) p.x += sin(uTime * 9.0 + p.z * 2.0 + uPhase) * 0.14 * aU;
  }
  vObj = p;
  vec4 wp = modelMatrix * vec4(p, 1.0); vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const COMMON_F = /* glsl */`
uniform float uTime; uniform float uPhase; uniform float uHit; uniform vec3 uInk;
varying vec3 vN; varying vec3 vW; varying vec3 vObj; varying float vPart; varying float vU; varying vec2 vUv;
${NOISE}
${SKY}
${FOG}
${DISSOLVE}
`;
const FISH_F = COMMON_F + /* glsl */`
uniform vec3 uKoi; uniform float uKoiAmt; uniform vec3 uEye;
void main(){
  vec3 N = normalize(vN + vec3(0.0, 1e-6, 0.0)); vec3 V = normalize(cameraPosition - vW);
  if (dot(N, V) < 0.0) N = -N;
  float fres = pow(clamp(1.0 - dot(N, V), 0.0, 1.0), 2.4);
  float ndl = dot(N, uSunDir) * 0.5 + 0.5;
  vec3 col;
  if (vPart > 1.5) { col = uEye * 3.2; }
  else {
    float koi = smoothstep(0.5, 0.58, fbm3(vObj * 1.25 + uPhase * 3.0));
    vec3 body = mix(uInk * 1.35 + 0.02, uKoi, koi * uKoiAmt);
    float sc = sin(vObj.z * 13.0 + sin(vObj.y * 6.0)) * sin(atan(vObj.y, vObj.x) * 8.0);
    body *= 0.82 + 0.18 * smoothstep(-0.3, 0.7, sc);
    body *= 0.5 + 0.65 * ndl;
    body += skyCol(-V) * fres * 0.6;
    body += vec3(1.0, 0.75, 0.35) * pow(fres, 4.0) * 0.5;
    if (vPart > 0.5) body = mix(uInk * 1.6, skyCol(-V), 0.4) + uKoi * uKoiAmt * 0.25;
    col = body;
  }
  col = mix(col, vec3(1.4), uHit);
  col = dissolve(col, vObj, 1.3);
  gl_FragColor = vec4(applyFog(col, vW, 1.0), 1.0);
}`;
const LANT_F = COMMON_F + /* glsl */`
uniform sampler2D uTex;
void main(){
  vec3 N = normalize(vN + vec3(0.0, 1e-6, 0.0)); vec3 V = normalize(cameraPosition - vW);
  vec3 col;
  if (vPart < 0.5) {
    vec3 paper = texture2D(uTex, vUv).rgb;
    float flick = 0.86 + 0.14 * sin(uTime * 13.0 + uPhase) * sin(uTime * 7.3 + uPhase * 2.0);
    float facing = abs(dot(N, V));
    col = paper * (1.1 + 1.9 * facing) * flick;
  } else if (vPart < 1.5) {
    col = uInk * 1.4 + skyCol(reflect(-V, N)) * 0.12;
  } else {
    col = vec3(0.5, 0.03, 0.02);
  }
  col = mix(col, vec3(1.6), uHit);
  col = dissolve(col, vObj, 1.1);
  gl_FragColor = vec4(applyFog(col, vW, 0.75), 1.0);
}`;
const DISC_F = COMMON_F + /* glsl */`
uniform float uCorrupt;
void main(){
  vec3 N = normalize(vN + vec3(0.0, 1e-6, 0.0)); vec3 V = normalize(cameraPosition - vW);
  float fres = pow(clamp(1.0 - abs(dot(N, V)), 0.0, 1.0), 2.0);
  vec2 q = vObj.xy; float r = length(q); float a = atan(q.y, q.x);
  float grain = smoothstep(0.2, 0.9, sin(r * 20.0) * sin(a * 18.0 + r * 4.0));
  vec3 jade = mix(vec3(0.07, 0.3, 0.2), vec3(0.42, 0.82, 0.6), 0.5 + 0.5 * dot(N, uSunDir));
  jade *= 0.78 + 0.3 * grain;
  jade += vec3(0.55, 1.0, 0.8) * fres * 0.7;
  float vn = fbm3(vObj * 1.7 + uPhase);
  float vein = smoothstep(0.5, 0.6, vn) * uCorrupt;
  jade = mix(jade, uInk, vein * 0.92);
  jade += vec3(1.0, 0.12, 0.05) * smoothstep(0.58, 0.61, vn) * smoothstep(0.66, 0.61, vn) * uCorrupt * 2.2 * (0.6 + 0.4 * sin(uTime * 4.0 + uPhase));
  jade = mix(jade, vec3(1.6), uHit);
  jade = dissolve(jade, vObj, 1.2);
  gl_FragColor = vec4(applyFog(jade, vW, 0.9), 1.0);
}`;
const ORB_F = COMMON_F + /* glsl */`
uniform vec3 uEye;
void main(){
  vec3 N = normalize(vN + vec3(0.0, 1e-6, 0.0)); vec3 V = normalize(cameraPosition - vW);
  float fres = pow(clamp(1.0 - abs(dot(N, V)), 0.0, 1.0), 2.5);
  float ndl = dot(N, uSunDir) * 0.5 + 0.5;
  vec3 col = uInk * (1.2 + 0.6 * ndl) + vec3(1.0, 0.68, 0.28) * pow(fres, 2.5) * 1.6 + skyCol(-V) * fres * 0.25;
  float sc = smoothstep(0.4, 0.5, fract(vObj.z * 2.5 + atan(vObj.y, vObj.x) * 0.95));
  col += vec3(0.9, 0.6, 0.25) * sc * fres * 0.6;
  if (vPart > 0.5 && vPart < 1.5) col = vec3(0.85, 0.62, 0.25) * (0.5 + ndl * 0.8);
  if (vPart > 1.5) col = uEye * 3.5;
  col = mix(col, vec3(1.6), uHit);
  col = dissolve(col, vObj, 1.4);
  gl_FragColor = vec4(applyFog(col, vW, 0.9), 1.0);
}`;
const GLOWOBJ_F = COMMON_F + /* glsl */`
uniform vec3 uCol;
void main(){
  vec3 N = normalize(vN + vec3(0.0, 1e-6, 0.0)); vec3 V = normalize(cameraPosition - vW);
  float fres = pow(clamp(1.0 - abs(dot(N, V)), 0.0, 1.0), 2.0);
  vec3 col = uCol * (0.9 + fres * 2.4) + vec3(1.0) * pow(fres, 6.0) * 0.6;
  col = mix(col, vec3(2.0), uHit);
  col = dissolve(col, vObj, 1.6);
  gl_FragColor = vec4(col, 1.0);
}`;
const TAL_V = /* glsl */`
uniform float uTime; uniform float uPhase;
varying vec2 vUv; varying vec3 vW; varying vec3 vObj;
void main(){
  vUv = uv; vec3 p = position;
  float k = (2.5 - p.y) / 5.0;
  p.z += sin(p.y * 1.25 - uTime * 5.0 + uPhase) * 0.32 * k + sin(p.x * 2.0 + uTime * 3.0) * 0.05;
  p.x += sin(uTime * 2.0 + uPhase) * 0.12 * k;
  vObj = p;
  vec4 wp = modelMatrix * vec4(p, 1.0); vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const TAL_F = /* glsl */`
uniform sampler2D uTex; uniform float uVar; uniform float uHit; uniform float uTime; uniform float uPhase;
varying vec2 vUv; varying vec3 vW; varying vec3 vObj;
${NOISE}
${SKY}
${FOG}
${DISSOLVE}
void main(){
  vec4 t = texture2D(uTex, vec2((vUv.x + uVar) / 3.0, vUv.y));
  if (t.a < 0.5) discard;
  vec3 col = t.rgb * 0.95;
  float red = smoothstep(0.2, 0.05, t.g) * smoothstep(0.15, 0.35, t.r);
  float pulse = 0.55 + 0.45 * sin(uTime * 5.0 + uPhase);
  col += vec3(1.0, 0.14, 0.05) * red * pulse * 1.8;
  col = mix(col, vec3(1.6), uHit);
  col = dissolve(col, vObj, 0.85);
  gl_FragColor = vec4(applyFog(col, vW, 1.0), 1.0);
}`;
const WISP_F = /* glsl */`
uniform float uTime; uniform float uPhase; uniform float uA; uniform float uWarn;
varying vec2 vUv;
${NOISE}
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float t = uTime * 3.2 + uPhase;
  vec2 q = p; q.y += 0.28;
  float n = fbm2(vec2(p.x * 2.2, p.y * 2.0 - t));
  float shape = length(vec2(q.x * (1.35 + q.y * 0.9), q.y * 0.72)) + (n - 0.5) * 0.42;
  float core = smoothstep(0.32, 0.0, shape);
  float flame = smoothstep(0.88, 0.22, shape);
  vec3 c = mix(vec3(0.05, 0.85, 0.65), vec3(0.85, 1.0, 1.0), core);
  c = mix(c, vec3(1.0, 0.25, 0.15), uWarn * 0.5 * (1.0 - core));
  float a = flame * uA;
  gl_FragColor = vec4(c * (flame * 1.5 + core * 2.6) * uA, a);
}`;
const BB_V = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SIGIL_F = /* glsl */`
uniform sampler2D uTex; uniform float uTime; uniform float uHit; uniform float uA; uniform float uPhase;
varying vec2 vUv;
void main(){
  vec2 p = vUv - 0.5;
  float a = texture2D(uTex, vUv).a;
  float glow = exp(-dot(p, p) * 9.0) * 0.55;
  float pulse = 0.75 + 0.25 * sin(uTime * 4.0 + uPhase);
  vec3 c = vec3(1.0, 0.16, 0.06) * (a * 2.6 * pulse + glow * 1.4);
  c = mix(c, vec3(2.5, 2.2, 2.0), uHit * a);
  float al = clamp(a + glow, 0.0, 1.0) * uA;
  gl_FragColor = vec4(c * uA, al);
}`;

const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0);
// ------------------------------------------------------------ enemy manager
export class Enemies {
  constructor(scene, fx) {
    this.scene = scene; this.fx = fx;
    this.list = []; this.pool = {};
    this.tex = { tal: talismanTexture(), lan: lanternTexture(), sigil: sigilTexture('封') };
    this.geo = {
      tal: new THREE.PlaneGeometry(2.0, 5.0, 2, 14),
      fish: fishGeometry(5, 0.95),
      lantern: lanternGeometry(),
      disc: discGeometry(),
      orb: (() => { const g = new THREE.IcosahedronGeometry(1.15, 2); return mergeGeometries([prep(g, 0)], false); })(),
      head: headGeometry(),
      jade: (() => { const a = new THREE.IcosahedronGeometry(0.85, 2); const r = new THREE.TorusGeometry(1.45, 0.07, 6, 30); return mergeGeometries([prep(a, 0), prep(r, 1)], false); })(),
      soul: (() => { const s = smallSwordGeometry(); s.scale(1.5, 1.5, 1.5); s.rotateX(-Math.PI / 2); s.translate(0, -1.2, 0); const r = new THREE.TorusGeometry(1.5, 0.06, 6, 30); return mergeGeometries([prep(s, 0), prep(r, 1)], false); })(),
      quad: new THREE.PlaneGeometry(1, 1),
    };
    this._v = new THREE.Vector3(); this._w = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._m = new THREE.Matrix4();
    this._z = new THREE.Vector3(0, 0, 1);
    this.uid = 1;
  }

  makeObj(kind) {
    const base = { uTime: { value: 0 }, uPhase: { value: 0 }, uHit: { value: 0 }, uDissolve: { value: 0 }, uEmber: { value: new THREE.Color(2.4, 1.1, 0.3) }, uSwim: { value: 0 }, uBend: { value: 1 } };
    let mesh, mat;
    switch (kind) {
      case 'talisman':
        mat = new THREE.ShaderMaterial({ uniforms: uni({ ...base, uTex: { value: this.tex.tal }, uVar: { value: 0 } }), vertexShader: TAL_V, fragmentShader: TAL_F, side: THREE.DoubleSide });
        mesh = new THREE.Mesh(this.geo.tal, mat); break;
      case 'fish':
        mat = new THREE.ShaderMaterial({ uniforms: uni({ ...base, uKoi: { value: new THREE.Color(0.75, 0.12, 0.05) }, uKoiAmt: { value: 0 }, uEye: { value: new THREE.Color(1, 0.12, 0.05) } }), vertexShader: STD_V, fragmentShader: FISH_F, side: THREE.DoubleSide });
        mesh = new THREE.Mesh(this.geo.fish, mat); break;
      case 'lantern':
        mat = new THREE.ShaderMaterial({ uniforms: uni({ ...base, uTex: { value: this.tex.lan } }), vertexShader: STD_V, fragmentShader: LANT_F });
        mesh = new THREE.Mesh(this.geo.lantern, mat); break;
      case 'disc':
        mat = new THREE.ShaderMaterial({ uniforms: uni({ ...base, uCorrupt: { value: 1 } }), vertexShader: STD_V, fragmentShader: DISC_F });
        mesh = new THREE.Mesh(this.geo.disc, mat); break;
      case 'orb': case 'head':
        mat = new THREE.ShaderMaterial({ uniforms: uni({ ...base, uEye: { value: new THREE.Color(1, 0.12, 0.05) } }), vertexShader: STD_V, fragmentShader: ORB_F });
        mesh = new THREE.Mesh(kind === 'orb' ? this.geo.orb : this.geo.head, mat); break;
      case 'jade': case 'soul':
        mat = new THREE.ShaderMaterial({ uniforms: uni({ ...base, uCol: { value: kind === 'jade' ? new THREE.Color(0.25, 1.1, 0.6) : new THREE.Color(1.6, 1.0, 0.3) } }), vertexShader: STD_V, fragmentShader: GLOWOBJ_F });
        mesh = new THREE.Mesh(this.geo[kind], mat); break;
      case 'wisp':
        mat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uPhase: { value: 0 }, uA: { value: 1 }, uWarn: { value: 0 }, uHit: { value: 0 }, uDissolve: { value: 0 } }, vertexShader: BB_V, fragmentShader: WISP_F, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
        mesh = new THREE.Mesh(this.geo.quad, mat); mesh.renderOrder = 21; break;
      case 'seal':
        mat = new THREE.ShaderMaterial({ uniforms: { uTex: { value: this.tex.sigil }, uTime: { value: 0 }, uHit: { value: 0 }, uA: { value: 1 }, uPhase: { value: 0 }, uDissolve: { value: 0 } }, vertexShader: BB_V, fragmentShader: SIGIL_F, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
        mesh = new THREE.Mesh(this.geo.quad, mat); mesh.renderOrder = 21; break;
      case 'heart':
        mat = null; mesh = new THREE.Object3D(); break;
    }
    mesh.frustumCulled = false;
    return { mesh, mat };
  }

  spawn(kind, path, o = {}) {
    const def = DEF[kind];
    let e = (this.pool[kind] && this.pool[kind].pop()) || null;
    if (!e) {
      const { mesh, mat } = this.makeObj(kind);
      e = { kind, mesh, mat, n: new THREE.Vector3(), pn: new THREE.Vector3(), pos: new THREE.Vector3(), ppos: new THREE.Vector3(), q: new THREE.Quaternion(), dir: new THREE.Vector3(0, 0, 1) };
    }
    Object.assign(e, {
      id: this.uid++, def, hp: o.hp ?? def.hp, maxHp: o.hp ?? def.hp, locks: 0, alive: true, dying: false, dead: false, t: o.t0 || 0, dt: 0,
      path, radius: (o.radius ?? def.radius) * (o.scale || 1), score: o.score ?? def.score, sx: -999, sy: -999, sr: 0, onScreen: false, depth: 0,
      lockCool: 0, hitT: 0, sealTo: 0, phase: Math.random() * 100, external: !!o.external, scale: o.scale || 1, data: o.data || {}, fire: o.fire || 0,
      fireCount: o.fireDelay ?? (4 + Math.floor(Math.random() * 4)), pickup: def.pickup || null, projectile: !!def.projectile, boss: !!def.boss,
      counted: !def.projectile && !def.pickup && !def.boss && !o.noCount, seen: false, onKill: o.onKill || null, first: true, lockable: o.lockable ?? true,
      nt: o.nt ? o.nt.slice() : null, ni: 0, pitch: o.pitch || [0], phrase: o.phrase || null, chain: o.chain || null, inside: false, contact: -1, held: false,
      noMiss: !!o.noMiss || !!def.projectile, mark: !!o.mark, pending: 0, fled: false,
    });
    if (e.nt && !o.hp) { e.hp = e.maxHp = e.nt.length; }
    e.mesh.visible = true;
    e.mesh.scale.setScalar(e.scale);
    if (e.mat) {
      const u = e.mat.uniforms;
      if (u.uDissolve) u.uDissolve.value = 0; if (u.uHit) u.uHit.value = 0; if (u.uPhase) u.uPhase.value = e.phase;
      if (u.uVar) u.uVar.value = o.variant ?? Math.floor(Math.random() * 3);
      if (u.uSwim) u.uSwim.value = kind === 'fish' ? 7 : 0;
      if (u.uKoiAmt) { u.uKoiAmt.value = o.koi ?? 0; if (o.koiColor) u.uKoi.value.setRGB(...o.koiColor); }
      if (u.uCorrupt) u.uCorrupt.value = 1;
      if (u.uA) u.uA.value = 1;
      if (u.uEmber) u.uEmber.value.setRGB(...(kind === 'fish' || kind === 'orb' || kind === 'head' ? [2.6, 1.6, 0.5] : kind === 'disc' ? [0.6, 2.4, 1.4] : [2.6, 1.0, 0.25]));
    }
    if (o.at) e.n.copy(o.at);
    if (path) path(e.t, e.n);
    e.pn.copy(e.n);
    this.scene.add(e.mesh);
    this.list.push(e);
    return e;
  }

  remove(e) {
    e.dead = true; e.alive = false;
    this.scene.remove(e.mesh);
    (this.pool[e.kind] || (this.pool[e.kind] = [])).push(e);
  }

  toWorld(n, C, out) {
    const d = n.z * C.ds;
    return out.copy(C.camPos).addScaledVector(C.F, d).addScaledVector(C.R, n.x * d * C.kx).addScaledVector(C.U, n.y * d * C.ky);
  }

  update(dt, C, game) {
    const cam = C.camera;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (e.dead) continue;
      e.t += dt;
      const u = e.mat && e.mat.uniforms;
      if (u && u.uTime) u.uTime.value = C.time;
      if (e.dying) {
        e.dt += dt;
        const k = Math.min(1, e.dt / e.dieDur);
        if (u && u.uDissolve) u.uDissolve.value = k;
        if (u && u.uA && (e.kind === 'wisp' || e.kind === 'seal')) u.uA.value = 1 - k;
        if (e.kind === 'fish' || e.kind === 'talisman') e.mesh.scale.setScalar(e.scale * (1 + k * 0.15));
        if (k >= 1) { this.remove(e); continue; }
      }
      if (!e.dying) {
        if (e.kind === 'wisp') {
          const d = e.data; const p = Math.min(1, e.t / d.T);
          const k = Math.pow(p, 1.35);
          const tgt = C.playerN;
          e.n.set(d.x0 + (tgt.x - d.x0) * k + Math.sin(e.t * 5 + e.phase) * 0.05 * (1 - p),
            d.y0 + (tgt.y - d.y0) * k + Math.cos(e.t * 4 + e.phase) * 0.05 * (1 - p),
            d.d0 + (tgt.z - d.d0) * k);
          if (u) u.uWarn.value = p > 0.55 ? 0.5 + 0.5 * Math.sin(e.t * 22) : 0;
          if (p >= 1) { game.onWispHit(e); this.removeSoft(e); continue; }
        } else if (!e.external && e.path) {
          e.pn.copy(e.n);
          if (!e.path(e.t, e.n)) { game.onEscape(e); this.remove(e); continue; }
        }
      }
      if (!e.external) { e.ppos.copy(e.pos); this.toWorld(e.n, C, e.pos); if (e.first) { e.ppos.copy(e.pos); e.first = false; } }
      // orientation
      const m = e.mesh;
      m.position.copy(e.pos);
      switch (e.kind) {
        case 'talisman': case 'wisp': case 'seal': {
          m.quaternion.copy(cam.quaternion);
          this._q.setFromAxisAngle(this._z, Math.sin(e.t * 1.7 + e.phase) * 0.18); m.quaternion.multiply(this._q);
          if (e.kind === 'wisp') { const s = (2.4 + 0.25 * Math.sin(e.t * 18)) * e.scale; m.scale.set(s, s * 1.25, s); }
          if (e.kind === 'seal') { m.scale.setScalar(e.scale * 6.5 * (1 + 0.05 * Math.sin(e.t * 4 + e.phase))); }
          break;
        }
        case 'fish': case 'orb': case 'head': {
          this._v.subVectors(e.pos, e.ppos).addScaledVector(C.camVel, -dt);
          if (this._v.lengthSq() > 1e-6) { this._v.normalize(); e.dir.lerp(this._v, Math.min(1, dt * 6)).normalize(); }
          this._m.lookAt(this._w.copy(e.pos).add(e.dir), e.pos, C.U);
          this._q.setFromRotationMatrix(this._m);
          m.quaternion.slerp(this._q, e.t < 0.05 ? 1 : Math.min(1, dt * 8));
          if (e.kind === 'orb') { this._q.setFromAxisAngle(this._z, e.t * 2); m.quaternion.multiply(this._q); }
          break;
        }
        case 'lantern': {
          this._m.lookAt(this._w.copy(e.pos).sub(C.F), e.pos, C.U);
          m.quaternion.setFromRotationMatrix(this._m);
          this._q.setFromAxisAngle(AY, e.t * 0.7 + e.phase); m.quaternion.multiply(this._q);
          this._q.setFromAxisAngle(this._z, Math.sin(e.t * 1.3 + e.phase) * 0.12); m.quaternion.multiply(this._q);
          break;
        }
        case 'disc': {
          m.quaternion.copy(cam.quaternion);
          this._q.setFromAxisAngle(AX, Math.sin(e.t * 0.9 + e.phase) * 0.5); m.quaternion.multiply(this._q);
          this._q.setFromAxisAngle(this._z, e.t * 1.6); m.quaternion.multiply(this._q);
          if (u) u.uCorrupt.value += ((e.hp / e.maxHp) - u.uCorrupt.value) * Math.min(1, dt * 6);
          break;
        }
        case 'jade': case 'soul': {
          m.quaternion.copy(cam.quaternion);
          this._q.setFromAxisAngle(AY, e.t * 1.8); m.quaternion.multiply(this._q);
          if (Math.random() < dt * 14) {
            const c = e.kind === 'jade' ? [0.4, 1.6, 0.9] : [2.2, 1.5, 0.5];
            this.fx.glow.spawn(e.pos.x + (Math.random() - 0.5) * 2, e.pos.y + (Math.random() - 0.5) * 2, e.pos.z + (Math.random() - 0.5) * 2, 0, 1.5, 0, c[0], c[1], c[2], 0.5, 0.8, 1, 0);
          }
          break;
        }
      }
      if (u && u.uHit) u.uHit.value = Math.max(0, u.uHit.value - dt * 7);
      e.lockCool = Math.max(0, e.lockCool - dt);
      // screen projection
      this._v.copy(e.pos).project(cam);
      this._w.subVectors(e.pos, cam.position);
      e.depth = this._w.dot(C.camFwd);
      e.onScreen = e.depth > 3 && this._v.z < 1 && Math.abs(this._v.x) < 1.08 && Math.abs(this._v.y) < 1.08;
      e.sx = (this._v.x * 0.5 + 0.5) * C.W; e.sy = (-this._v.y * 0.5 + 0.5) * C.H;
      e.sr = e.radius * C.pxUnit / Math.max(e.depth, 1);
      if (e.onScreen && !e.seen && !e.dying) e.seen = true;
    }
    if (this.list.length > 0 && this.list.some(e => e.dead)) this.list = this.list.filter(e => !e.dead);
  }

  removeSoft(e) { e.alive = false; e.dying = true; e.dt = 0; e.dieDur = 0.15; }
  // a missed note: the spirit dissolves back into ink and drifts away
  flee(e) {
    if (!e.alive) return;
    e.alive = false; e.dying = true; e.dt = 0; e.dieDur = 0.7; e.fled = true;
    if (e.mat && e.mat.uniforms.uEmber) e.mat.uniforms.uEmber.value.setRGB(0.05, 0.05, 0.07);
    this.fx.ink.burst(e.pos, 5, 3, 1.4, 4.5, 0.45, 1.2);
  }

  // returns true if killed
  damage(e, dmg, game) {
    if (!e.alive) return false;
    e.hp -= dmg;
    e.locks = Math.max(0, e.locks - 1);
    if (e.mat && e.mat.uniforms.uHit) e.mat.uniforms.uHit.value = 1;
    if (e.hp > 0) { game.onEnemyHit(e); return false; }
    this.kill(e, game);
    return true;
  }

  kill(e, game) {
    e.alive = false; e.dying = true; e.dt = 0;
    const p = e.pos, fx = this.fx;
    switch (e.kind) {
      case 'talisman':
        e.dieDur = 0.55;
        fx.glow.burst(p, 16, 9, [2.6, 1.1, 0.3], 0.55, 0.9, { drag: 2.5, grav: -2 });
        fx.ink.burst(p, 4, 4, 1.2, 3.5, 0.55, 1.1);
        break;
      case 'fish': case 'orb': case 'head':
        e.dieDur = 0.45;
        fx.ink.burst(p, e.kind === 'head' ? 12 : 8, 7, 1.6, 5.5, 0.75, 1.3);
        fx.glow.burst(p, 18, 12, [2.4, 1.5, 0.5], 0.5, 0.8, { drag: 2.8 });
        fx.flash.ring(p, 1.5, 9, 0.6, [0.08, 0.09, 0.11], false, 0.7);
        break;
      case 'lantern':
        e.dieDur = 0.7;
        fx.glow.burst(p, 34, 10, [2.8, 0.9, 0.25], 0.7, 1.1, { drag: 2, grav: -6 });
        fx.glow.burst(p, 10, 4, [0.4, 2.2, 1.6], 0.9, 1.2, { drag: 1.5, grav: -3 });
        fx.flash.ring(p, 2, 11, 0.55, [2.0, 0.8, 0.3], true, 0.8);
        break;
      case 'disc':
        e.dieDur = 0.35;
        fx.glow.burst(p, 30, 16, [0.5, 2.4, 1.4], 0.8, 0.9, { drag: 3 });
        fx.flash.ring(p, 2, 14, 0.6, [0.6, 2.2, 1.4], true, 0.9);
        fx.flash.slash(p, 7, [0.6, 2.0, 1.2]);
        break;
      case 'wisp':
        e.dieDur = 0.18;
        fx.glow.burst(p, 10, 8, [0.4, 2.2, 1.8], 0.45, 0.5, { drag: 3 });
        break;
      case 'jade': case 'soul': {
        e.dieDur = 0.3;
        const c = e.kind === 'jade' ? [0.4, 2.2, 1.2] : [2.6, 1.7, 0.5];
        fx.glow.burst(p, 40, 12, c, 0.8, 1.2, { drag: 2, grav: -4 });
        fx.flash.ring(p, 2, 14, 0.6, c, true, 1);
        break;
      }
      case 'seal':
        e.dieDur = 0.5;
        fx.glow.burst(p, 50, 22, [2.8, 0.6, 0.2], 1.2, 1.2, { drag: 2 });
        fx.ink.burst(p, 10, 12, 3, 10, 0.8, 1.6);
        fx.flash.ring(p, 4, 30, 0.8, [2.5, 1.2, 0.4], true, 1);
        break;
      default:
        e.dieDur = 0.3;
    }
    game.onKill(e);
    if (e.onKill) e.onKill(e);
  }

  clear() { for (const e of this.list) if (!e.dead) this.remove(e); this.list = []; }
  count(fn) { let n = 0; for (const e of this.list) if (!e.dead && e.alive && (!fn || fn(e))) n++; return n; }
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { uni, NOISE, SKY } from './glsl.js';

export function bladeGeometry(len, w, t, tip, segs = 10) {
  const pos = [], edge = [];
  const secs = [];
  for (let i = 0; i <= segs; i++) {
    const v = i / segs, z = v * len;
    const ts = (len - tip) / len;
    let k = v > ts ? 1 - (v - ts) / (1 - ts) : 1;
    k = Math.max(k, 0.0001);
    const ww = w * (1 - 0.14 * v) * k, tt = t * Math.max(k, 0.2) * (k < 0.001 ? 0 : 1);
    secs.push({ ww, p: [[-ww, 0, z], [0, tt, z], [ww, 0, z], [0, -tt, z]] });
  }
  const push = (q, ww) => { pos.push(q[0], q[1], q[2]); edge.push(ww > 1e-3 ? Math.abs(q[0]) / ww : 1); };
  for (let i = 0; i < segs; i++) {
    const A = secs[i], B = secs[i + 1];
    for (let f = 0; f < 4; f++) {
      const a0 = A.p[f], a1 = A.p[(f + 1) % 4], b0 = B.p[f], b1 = B.p[(f + 1) % 4];
      push(a0, A.ww); push(b0, B.ww); push(a1, A.ww);
      push(a1, A.ww); push(b0, B.ww); push(b1, B.ww);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  g.computeVertexNormals();
  return g;
}
function part(geo, id) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'aEdge') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position.count;
  if (!g.attributes.aEdge) g.setAttribute('aEdge', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(n).fill(id), 1));
  return g;
}

export function mainSwordGeometry() {
  const blade = part(bladeGeometry(3.4, 0.13, 0.036, 0.55, 12), 0);
  const gs = new THREE.Shape();
  gs.moveTo(-0.34, 0); gs.lineTo(-0.24, 0.07); gs.lineTo(-0.08, 0.05); gs.lineTo(0, 0.1); gs.lineTo(0.08, 0.05); gs.lineTo(0.24, 0.07); gs.lineTo(0.34, 0);
  gs.lineTo(0.24, -0.07); gs.lineTo(0.08, -0.05); gs.lineTo(0, -0.1); gs.lineTo(-0.08, -0.05); gs.lineTo(-0.24, -0.07); gs.closePath();
  const guardG = new THREE.ExtrudeGeometry(gs, { depth: 0.12, bevelEnabled: false });
  guardG.translate(0, 0, -0.12);
  const guard = part(guardG, 1);
  const gripG = new THREE.CylinderGeometry(0.046, 0.052, 0.78, 10, 1); gripG.rotateX(Math.PI / 2); gripG.translate(0, 0, -0.51);
  const grip = part(gripG, 2);
  const pomG = new THREE.OctahedronGeometry(0.085, 0); pomG.scale(1, 1, 1.3); pomG.translate(0, 0, -0.97);
  const pom = part(pomG, 1);
  const ringG = new THREE.TorusGeometry(0.06, 0.016, 6, 14); ringG.rotateY(Math.PI / 2); ringG.translate(0, 0, -1.09);
  const ring = part(ringG, 1);
  return mergeGeometries([blade, guard, grip, pom, ring], false);
}
export function smallSwordGeometry() {
  const blade = part(bladeGeometry(1.7, 0.075, 0.022, 0.32, 8), 0);
  const g = new THREE.BoxGeometry(0.28, 0.05, 0.07); g.translate(0, 0, -0.035);
  const grip = new THREE.CylinderGeometry(0.025, 0.028, 0.34, 6, 1); grip.rotateX(Math.PI / 2); grip.translate(0, 0, -0.24);
  return mergeGeometries([blade, part(g, 1), part(grip, 1)], false);
}

const SW_V = /* glsl */`
attribute float aPart; attribute float aEdge;
varying vec3 vN; varying vec3 vW; varying float vPart; varying float vEdge; varying vec3 vObj;
void main(){
  vPart = aPart; vEdge = aEdge; vObj = position;
  vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const MAIN_F = /* glsl */`
uniform float uGlow; uniform float uTime; uniform vec3 uGold; uniform float uFlash; uniform vec3 uFlashCol;
varying vec3 vN; varying vec3 vW; varying float vPart; varying float vEdge; varying vec3 vObj;
${NOISE}
${SKY}
void main(){
  vec3 N = normalize(vN + vec3(0.0, 1e-6, 0.0)); vec3 V = normalize(cameraPosition - vW);
  if (dot(N, V) < 0.0) N = -N;
  vec3 R = reflect(-V, N);
  vec3 env = skyCol(R);
  float fres = pow(clamp(1.0 - dot(N, V), 0.0, 1.0), 3.0);
  float spec = pow(max(dot(R, uSunDir), 0.0), 70.0);
  vec3 col;
  if (vPart < 0.5) {
    col = vec3(0.16, 0.18, 0.21) * 0.6 + env * (0.62 + 0.38 * fres);
    col += (uSunGlow + vec3(0.6)) * spec * 2.6;
    float e = smoothstep(0.78, 1.0, vEdge);
    float zt = vObj.z / 3.4;
    float dz = (zt - fract(uTime * 0.42)) * 8.0; float run = exp(-dz * dz);
    col += uGold * (e * (0.35 + uGlow * 1.6) + run * 0.8 * uGlow * (0.3 + e));
  } else if (vPart < 1.5) {
    vec3 gold = vec3(0.78, 0.55, 0.2);
    col = gold * (0.22 + env * 0.95) + vec3(1.0, 0.82, 0.45) * spec * 2.2 + gold * fres * 0.6;
  } else {
    float wrap = step(0.5, fract(vObj.z * 24.0 + atan(vObj.y, vObj.x) * 0.16));
    col = mix(vec3(0.05, 0.035, 0.035), vec3(0.3, 0.07, 0.05), wrap) * (0.45 + env * 0.6);
  }
  col = mix(col, uFlashCol * 1.6, uFlash);
  gl_FragColor = vec4(col, 1.0);
}`;
const SMALL_F = /* glsl */`
uniform vec3 uGold; uniform float uHot; uniform float uAlpha;
varying vec3 vN; varying vec3 vW; varying float vPart; varying float vEdge; varying vec3 vObj;
void main(){
  vec3 N = normalize(vN + vec3(0.0, 1e-6, 0.0)); vec3 V = normalize(cameraPosition - vW);
  float fres = pow(clamp(1.0 - abs(dot(N, V)), 0.0, 1.0), 2.0);
  float e = smoothstep(0.7, 1.0, vEdge);
  vec3 col = uGold * (0.55 + fres * 1.2 + e * 1.6 + uHot * 1.4) * (vPart > 0.5 ? 0.7 : 1.0);
  col += vec3(1.0, 0.95, 0.85) * e * uHot * 1.2;
  gl_FragColor = vec4(col, uAlpha);
}`;

const GOLD = new THREE.Color(1.0, 0.68, 0.24);

export function smallSwordMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uGold: { value: GOLD.clone() }, uHot: { value: 0 }, uAlpha: { value: 1 } },
    vertexShader: SW_V, fragmentShader: SMALL_F, transparent: true,
  });
}

class Rope {
  constructor(n, seg) {
    this.n = n; this.seg = seg;
    this.p = []; this.q = [];
    for (let i = 0; i < n; i++) { this.p.push(new THREE.Vector3()); this.q.push(new THREE.Vector3()); }
    this._d = new THREE.Vector3(); this.last = null;
  }
  reset(a, dir) { for (let i = 0; i < this.n; i++) { this.p[i].copy(a).addScaledVector(dir, i * this.seg); this.q[i].copy(this.p[i]); } }
  step(dt, anchor, gx, gy, gz, damp, windFn) {
    const { p, q, n } = this;
    if (this.last) {
      this._d.subVectors(anchor, this.last).multiplyScalar(0.88);
      for (let i = 1; i < n; i++) { p[i].add(this._d); q[i].add(this._d); }
    } else this.last = new THREE.Vector3();
    this.last.copy(anchor);
    p[0].copy(anchor); q[0].copy(anchor);
    const d2 = dt * dt;
    for (let i = 1; i < n; i++) {
      const vx = (p[i].x - q[i].x) * damp, vy = (p[i].y - q[i].y) * damp, vz = (p[i].z - q[i].z) * damp;
      q[i].copy(p[i]);
      const w = windFn ? windFn(i) : null;
      p[i].x += vx + (gx + (w ? w.x : 0)) * d2; p[i].y += vy + (gy + (w ? w.y : 0)) * d2; p[i].z += vz + (gz + (w ? w.z : 0)) * d2;
    }
    for (let it = 0; it < 6; it++) {
      for (let i = 1; i < n; i++) {
        const a = p[i - 1], b = p[i];
        this._d.subVectors(b, a); const l = this._d.length() || 1e-4;
        const diff = (l - this.seg) / l;
        if (i === 1) b.addScaledVector(this._d, -diff);
        else { a.addScaledVector(this._d, diff * 0.5); b.addScaledVector(this._d, -diff * 0.5); }
      }
    }
  }
}

export class Player {
  constructor(scene, fx) {
    this.scene = scene; this.fx = fx;
    this.mainMat = new THREE.ShaderMaterial({
      uniforms: uni({ uGlow: { value: 1 }, uGold: { value: new THREE.Color(1.0, 0.66, 0.22) }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(1, 0.2, 0.1) } }),
      vertexShader: SW_V, fragmentShader: MAIN_F,
    });
    this.sword = new THREE.Mesh(mainSwordGeometry(), this.mainMat);
    this.sword.frustumCulled = false;
    scene.add(this.sword);
    this.smallGeo = smallSwordGeometry();
    this.orbit = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(this.smallGeo, smallSwordMaterial());
      m.frustumCulled = false; m.renderOrder = 2;
      scene.add(m);
      this.orbit.push({ m, state: 'ready', target: null, t: 0, alpha: 1, q: new THREE.Quaternion(), pos: new THREE.Vector3(), hot: 0 });
    }
    this.tassel = new Rope(7, 0.16);
    this.silkA = new Rope(13, 0.3);
    this.silkB = new Rope(13, 0.3);
    this.tasselId = fx.silk.alloc(); this.silkAId = fx.silk.alloc(); this.silkBId = fx.silk.alloc();
    fx.silk.set(this.tasselId, this.tassel.p, 7, u => 0.06 + u * u * 0.2, [0.62, 0.05, 0.03, 1], u => 1);

    this.pos = new THREE.Vector3(); this.dir = new THREE.Vector3(0, 0, -1); this.right = new THREE.Vector3(1, 0, 0); this.up = new THREE.Vector3(0, 1, 0);
    this.center = new THREE.Vector3();
    this._m = new THREE.Matrix4(); this._v = new THREE.Vector3(); this._w = new THREE.Vector3(); this._q = new THREE.Quaternion();
    this._pom = new THREE.Vector3(); this._wind = new THREE.Vector3();
    this.theta = 0; this.flash = 0; this.ready = false; this.glow = 1; this.visible = true;
    this.lastPos = new THREE.Vector3(); this.roll = 0; this.pulse = 0;
  }

  setVisible(v) {
    this.visible = v; this.sword.visible = v;
    for (const o of this.orbit) o.m.visible = v && o.alpha > 0.01;
    this.fx.silk.mesh.visible = v;
  }

  reset() {
    for (const o of this.orbit) { o.state = 'ready'; o.target = null; o.alpha = 1; o.hot = 0; }
    this.ready = false;
  }

  readyCount() { let n = 0; for (const o of this.orbit) if (o.state === 'ready' && o.alpha > 0.6) n++; return n; }
  takeSlot(target) {
    let best = -1;
    for (let i = 0; i < 8; i++) { const o = this.orbit[i]; if (o.state === 'ready' && o.alpha > 0.6) { best = i; break; } }
    if (best < 0) return -1;
    const o = this.orbit[best]; o.state = 'locked'; o.target = target;
    return best;
  }
  releaseSlot(i) { const o = this.orbit[i]; if (o && o.state === 'locked') { o.state = 'ready'; o.target = null; } }
  launch(i) {
    const o = this.orbit[i]; o.state = 'gone'; o.t = 0; o.alpha = 0; o.target = null; o.m.visible = false;
    return { pos: o.pos.clone(), q: o.q.clone() };
  }

  // pos: guard position; dir: blade direction; right/up: frame
  update(dt, time, pos, dir, right, up, lateralVel) {
    this.pos.copy(pos); this.dir.copy(dir); this.right.copy(right); this.up.copy(up);
    this.roll += (Math.max(-0.6, Math.min(0.6, -lateralVel * 0.08)) - this.roll) * Math.min(1, dt * 4);
    this._w.copy(up).applyAxisAngle(dir, this.roll);
    this._m.lookAt(this._v.copy(pos).add(dir), pos, this._w);
    // Matrix4.lookAt(eye, target, up) makes -Z point from eye to target; we want +Z toward dir => eye = pos + dir, target = pos
    this.sword.quaternion.setFromRotationMatrix(this._m);
    this.sword.position.copy(pos);
    this.sword.position.addScaledVector(up, Math.sin(time * 1.6) * 0.06);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.mainMat.uniforms.uFlash.value = this.flash;
    this.mainMat.uniforms.uGlow.value += (this.glow - this.mainMat.uniforms.uGlow.value) * Math.min(1, dt * 3);
    // orbit swords
    this.theta += dt * 0.55;
    this.pulse = Math.max(0, this.pulse - dt * 3.5);
    this.center.copy(pos).addScaledVector(dir, 1.35);
    const R = 1.55;
    for (let i = 0; i < 8; i++) {
      const o = this.orbit[i];
      const a = this.theta + i * Math.PI / 4;
      const br = R * (1 + 0.05 * Math.sin(time * 2.1 + i) + this.pulse * 0.07);
      o.pos.copy(this.center).addScaledVector(right, Math.cos(a) * br).addScaledVector(up, Math.sin(a) * br * 0.92);
      if (o.state === 'gone') {
        o.t += dt;
        if (o.t > 0.75) { o.state = 'ready'; o.alpha = 0.001; }
      }
      if (o.state !== 'gone' && o.alpha < 1) {
        o.alpha = Math.min(1, o.alpha + dt * 3.2);
        if (o.alpha > 0.2 && o.alpha < 0.32 && this.visible) this.fx.glow.spawn(o.pos.x, o.pos.y, o.pos.z, 0, 0, 0, 2.5, 1.7, 0.6, 0.9, 0.35, 1, 0);
      }
      let tgt;
      if (o.state === 'locked' && o.target && o.target.alive) {
        tgt = this._v.copy(o.target.pos);
        o.hot = Math.min(1, o.hot + dt * 6);
        o.pos.addScaledVector(right, (Math.random() - 0.5) * 0.04).addScaledVector(up, (Math.random() - 0.5) * 0.04);
      } else {
        tgt = this._v.copy(o.pos).addScaledVector(dir, 10);
        o.hot = Math.max(0, o.hot - dt * 3);
      }
      this._m.lookAt(tgt, o.pos, up);
      this._q.setFromRotationMatrix(this._m);
      o.q.slerp(this._q, Math.min(1, dt * 14));
      o.m.position.copy(o.pos); o.m.quaternion.copy(o.q);
      o.m.visible = this.visible && o.alpha > 0.01 && o.state !== 'gone';
      o.m.material.uniforms.uAlpha.value = o.alpha; o.m.material.uniforms.uHot.value = o.hot;
    }
    // tassel & silk ropes
    this._pom.copy(pos).addScaledVector(dir, -1.1);
    if (!this.ready) {
      this.tassel.reset(this._pom, this._v.copy(up).multiplyScalar(-1));
      this.ready = true;
    }
    dt = Math.min(dt, 1 / 30);
    const damp = Math.exp(-dt * 2.2);
    const t = time;
    const back = this._v.copy(dir).multiplyScalar(-1);
    this.tassel.step(dt, this._pom, 0, -14, 0, damp, (i) => this._wind.copy(back).multiplyScalar(16).addScaledVector(right, Math.sin(t * 9 + i) * 10).addScaledVector(up, Math.sin(t * 7 + i * 1.7) * 6));

  }
}

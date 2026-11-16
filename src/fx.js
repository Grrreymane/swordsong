import * as THREE from 'three';
import { uni, NOISE, SKY, FOG } from './glsl.js';
import { inkSplatTexture, brushRingTexture } from './textures.js';

// ---------------------------------------------------------------- glow particles (additive)
const GLOW_V = /* glsl */`
attribute vec4 aCol; attribute float aSize;
uniform float uPx;
varying vec4 vCol;
void main(){
  vCol = aCol;
  vec4 mv = viewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aCol.a > 0.001 ? clamp(aSize * uPx / max(-mv.z, 0.1), 1.0, 220.0) : 0.0;
}`;
const GLOW_F = /* glsl */`
varying vec4 vCol;
void main(){
  vec2 c = gl_PointCoord * 2.0 - 1.0; float r = dot(c, c);
  if (r > 1.0) discard;
  float a = (exp(-r * 4.5) + smoothstep(0.25, 0.0, r) * 0.6) * vCol.a;
  gl_FragColor = vec4(vCol.rgb * a, a);
}`;

export class GlowParticles {
  constructor(scene, n = 2400) {
    this.n = n; this.next = 0;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.col = new Float32Array(n * 4);
    this.base = new Float32Array(n * 4); this.size = new Float32Array(n); this.life = new Float32Array(n); this.max = new Float32Array(n);
    this.drag = new Float32Array(n); this.grav = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = { uPx: { value: 600 } };
    this.mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: GLOW_V, fragmentShader: GLOW_F, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 20;
    this.geo = g; this.alive = 0;
    scene.add(this.points);
  }
  spawn(x, y, z, vx, vy, vz, r, g, b, size, life, drag = 2, grav = 0) {
    const i = this.next; this.next = (this.next + 1) % this.n;
    const i3 = i * 3, i4 = i * 4;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.base[i4] = r; this.base[i4 + 1] = g; this.base[i4 + 2] = b; this.base[i4 + 3] = size;
    this.size[i] = size; this.life[i] = life; this.max[i] = life; this.drag[i] = drag; this.grav[i] = grav;
  }
  burst(p, n, speed, color, size, life, o = {}) {
    for (let k = 0; k < n; k++) {
      let x = Math.random() * 2 - 1, y = Math.random() * 2 - 1, z = Math.random() * 2 - 1;
      const l = Math.hypot(x, y, z) || 1; const sp = speed * (0.35 + Math.random() * 0.65) / l;
      const j = o.jitter || 0;
      this.spawn(p.x + x * j, p.y + y * j, p.z + z * j, x * sp + (o.vx || 0), y * sp + (o.vy || 0), z * sp + (o.vz || 0),
        color[0], color[1], color[2], size * (0.5 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), o.drag ?? 2.2, o.grav ?? 0);
    }
  }
  update(dt) {
    const { pos, vel, col, base, size, life, max, drag, grav } = this;
    for (let i = 0; i < this.n; i++) {
      if (life[i] <= 0) { if (col[i * 4 + 3] !== 0) col[i * 4 + 3] = 0; continue; }
      life[i] -= dt;
      const i3 = i * 3, i4 = i * 4;
      const k = Math.exp(-drag[i] * dt);
      vel[i3] *= k; vel[i3 + 1] = vel[i3 + 1] * k - grav[i] * dt; vel[i3 + 2] *= k;
      pos[i3] += vel[i3] * dt; pos[i3 + 1] += vel[i3 + 1] * dt; pos[i3 + 2] += vel[i3 + 2] * dt;
      const t = Math.max(0, life[i] / max[i]);
      col[i4] = base[i4]; col[i4 + 1] = base[i4 + 1]; col[i4 + 2] = base[i4 + 2];
      col[i4 + 3] = life[i] > 0 ? Math.min(1, t * 2.5) * Math.sqrt(t) : 0;
      size[i] = base[i4 + 3] * (0.4 + 0.6 * t);
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aCol.needsUpdate = true; this.geo.attributes.aSize.needsUpdate = true;
  }
  clear() { this.life.fill(0); }
}

// ---------------------------------------------------------------- ink particles (normal blend)
const INK_V = /* glsl */`
attribute vec4 aInk; // x size, y alpha, z rot, w variant
uniform float uPx;
varying vec4 vInk; varying vec3 vWorld;
void main(){
  vInk = aInk; vWorld = position;
  vec4 mv = viewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aInk.y > 0.001 ? clamp(aInk.x * uPx / max(-mv.z, 0.1), 1.0, 360.0) : 0.0;
}`;
const INK_F = /* glsl */`
uniform sampler2D uTex; uniform vec3 uInk;
varying vec4 vInk; varying vec3 vWorld;
${NOISE}
${SKY}
${FOG}
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float cs = cos(vInk.z), sn = sin(vInk.z);
  c = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs);
  if (abs(c.x) > 0.5 || abs(c.y) > 0.5) discard;
  float v = vInk.w;
  vec2 uv = (c + 0.5) * 0.5 + vec2(mod(v, 2.0), floor(v / 2.0)) * 0.5;
  float a = texture2D(uTex, uv).a * vInk.y;
  if (a < 0.01) discard;
  vec3 col = applyFog(uInk * 0.85, vWorld, 0.6);
  gl_FragColor = vec4(col, a);
}`;

export class InkParticles {
  constructor(scene, n = 700) {
    this.n = n; this.next = 0;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.ink = new Float32Array(n * 4);
    this.s0 = new Float32Array(n); this.s1 = new Float32Array(n); this.a0 = new Float32Array(n); this.life = new Float32Array(n); this.max = new Float32Array(n); this.spin = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aInk', new THREE.BufferAttribute(this.ink, 4).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = uni({ uPx: { value: 600 }, uTex: { value: inkSplatTexture() } });
    this.mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: INK_V, fragmentShader: INK_F, transparent: true, depthWrite: false });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 18;
    this.geo = g;
    scene.add(this.points);
  }
  spawn(x, y, z, vx, vy, vz, s0, s1, alpha, life) {
    const i = this.next; this.next = (this.next + 1) % this.n;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = alpha; this.life[i] = life; this.max[i] = life;
    this.spin[i] = (Math.random() - 0.5) * 1.5;
    this.ink[i * 4 + 2] = Math.random() * 6.28; this.ink[i * 4 + 3] = Math.floor(Math.random() * 4);
  }
  burst(p, n, speed, s0, s1, alpha, life) {
    for (let k = 0; k < n; k++) {
      let x = Math.random() * 2 - 1, y = Math.random() * 2 - 1, z = Math.random() * 2 - 1;
      const l = Math.hypot(x, y, z) || 1; const sp = speed * (0.3 + Math.random() * 0.7) / l;
      this.spawn(p.x, p.y, p.z, x * sp, y * sp, z * sp, s0 * (0.6 + Math.random() * 0.8), s1 * (0.7 + Math.random() * 0.6), alpha, life * (0.7 + Math.random() * 0.5));
    }
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      const i4 = i * 4;
      if (this.life[i] <= 0) { this.ink[i4 + 1] = 0; continue; }
      this.life[i] -= dt;
      const i3 = i * 3; const k = Math.exp(-3.2 * dt);
      this.vel[i3] *= k; this.vel[i3 + 1] = this.vel[i3 + 1] * k - 0.6 * dt; this.vel[i3 + 2] *= k;
      this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const t = Math.max(0, this.life[i] / this.max[i]);
      const e = 1 - Math.pow(t, 2.2);
      this.ink[i4] = this.s0[i] + (this.s1[i] - this.s0[i]) * e;
      this.ink[i4 + 1] = this.a0[i] * Math.pow(t, 0.8);
      this.ink[i4 + 2] += this.spin[i] * dt;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aInk.needsUpdate = true;
  }
  clear() { this.life.fill(0); }
}

// ---------------------------------------------------------------- ribbons
const RIB_V = /* glsl */`
attribute vec4 aCol; attribute vec2 aUv;
varying vec4 vCol; varying vec2 vUv;
void main(){ vCol = aCol; vUv = aUv; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`;
const RIB_F_ADD = /* glsl */`
varying vec4 vCol; varying vec2 vUv;
void main(){
  float edge = 1.0 - vUv.y * vUv.y;
  float core = pow(max(edge, 0.0), 6.0);
  float a = vCol.a * edge;
  vec3 c = vCol.rgb * a + vec3(1.0, 0.95, 0.85) * core * vCol.a * 1.6;
  gl_FragColor = vec4(c, a);
}`;
const RIB_F_NORM = /* glsl */`
uniform float uTime;
varying vec4 vCol; varying vec2 vUv;
void main(){
  float edge = smoothstep(1.0, 0.55, abs(vUv.y));
  float sheen = 0.85 + 0.15 * sin(vUv.x * 40.0 + uTime * 6.0);
  gl_FragColor = vec4(vCol.rgb * sheen, vCol.a * edge);
}`;

const RIB_F_INK = /* glsl */`
uniform vec3 uInk;
varying vec4 vCol; varying vec2 vUv;
float h1(float n){ return fract(sin(n * 91.7) * 43758.5453); }
void main(){
  float across = vUv.y * 0.5 + 0.5;
  float lane = floor(across * 11.0);
  float dry = h1(lane + 3.0);
  float len = 0.35 + 0.65 * dry;
  float m = smoothstep(len, len - 0.08, vUv.x) * smoothstep(1.0, 0.65, abs(vUv.y));
  float a = vCol.a * m * (0.5 + 0.5 * h1(lane + 7.0));
  gl_FragColor = vec4(uInk * 0.9, a);
}`;

export class Ribbons {
  constructor(scene, strips, pts, additive) {
    const ink = additive === 'ink'; if (ink) additive = false;
    this.S = strips; this.P = pts; this.free = [];
    for (let i = strips - 1; i >= 0; i--) this.free.push(i);
    const nv = strips * pts * 2;
    this.pos = new Float32Array(nv * 3); this.col = new Float32Array(nv * 4); this.uv = new Float32Array(nv * 2);
    const idx = [];
    for (let s = 0; s < strips; s++) for (let i = 0; i < pts - 1; i++) {
      const a = (s * pts + i) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aUv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(nv > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    this.geo = g;
    this.uniforms = ink ? uni({}) : { uTime: { value: 0 } };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: RIB_V, fragmentShader: additive ? RIB_F_ADD : ink ? RIB_F_INK : RIB_F_NORM, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: additive ? THREE.CustomBlending : THREE.NormalBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 22 : 15;
    scene.add(this.mesh);
    this.strips = new Array(strips).fill(null);
    this._t = new THREE.Vector3(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3();
  }
  alloc() { const id = this.free.pop(); if (id === undefined) return -1; this.strips[id] = { n: 0, pts: null, w: null, c: null }; return id; }
  release(id) { if (id < 0 || !this.strips[id]) return; this.strips[id] = null; this.free.push(id); this.clearStrip(id); }
  set(id, pts, n, width, color, alphaFn) { const s = this.strips[id]; if (!s) return; s.pts = pts; s.n = n; s.width = width; s.color = color; s.alphaFn = alphaFn; }
  clearStrip(id) { const o = id * this.P * 2; for (let k = 0; k < this.P * 2; k++) this.col[(o + k) * 4 + 3] = 0; }
  update(camPos) {
    const P = this.P;
    for (let id = 0; id < this.S; id++) {
      const s = this.strips[id];
      if (!s || !s.pts || s.n < 2) { if (s) this.clearStrip(id); continue; }
      const n = Math.min(s.n, P);
      for (let i = 0; i < P; i++) {
        const k = Math.min(i, n - 1);
        const p = s.pts[k];
        const pa = s.pts[Math.max(0, k - 1)], pb = s.pts[Math.min(n - 1, k + 1)];
        this._t.subVectors(pb, pa);
        this._v.subVectors(camPos, p);
        this._s.crossVectors(this._t, this._v);
        const l = this._s.length() || 1;
        const u = n > 1 ? k / (n - 1) : 0;
        const w = (typeof s.width === 'function' ? s.width(u) : s.width) * 0.5 / l;
        this._s.multiplyScalar(w);
        const vi = (id * P + i) * 2;
        this.pos[vi * 3] = p.x + this._s.x; this.pos[vi * 3 + 1] = p.y + this._s.y; this.pos[vi * 3 + 2] = p.z + this._s.z;
        this.pos[vi * 3 + 3] = p.x - this._s.x; this.pos[vi * 3 + 4] = p.y - this._s.y; this.pos[vi * 3 + 5] = p.z - this._s.z;
        const a = i < n ? (s.alphaFn ? s.alphaFn(u) : 1) : 0;
        const c = s.color;
        for (let q = 0; q < 2; q++) {
          const ci = (vi + q) * 4;
          this.col[ci] = c[0]; this.col[ci + 1] = c[1]; this.col[ci + 2] = c[2]; this.col[ci + 3] = a * (c[3] ?? 1);
          this.uv[(vi + q) * 2] = u; this.uv[(vi + q) * 2 + 1] = q ? -1 : 1;
        }
      }
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aCol.needsUpdate = true; this.geo.attributes.aUv.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- slashes & rings (pooled billboards)
const SLASH_F = /* glsl */`
uniform float uT; uniform float uA; uniform vec3 uCol;
varying vec2 vUv;
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p - vec2(0.0, -1.1));
  float d = abs(r - 1.55);
  float along = clamp((p.x + 1.0) * 0.5, 0.0, 1.0);
  float wdt = 0.07 * sin(along * 3.14159) * (1.0 - uT * 0.6);
  float m = smoothstep(wdt + 0.02, 0.0, d) * smoothstep(1.0, 0.75, abs(p.x));
  float sweep = smoothstep(uT * 1.8 - 0.4, uT * 1.8, along);
  m *= 1.0 - sweep * 0.0;
  vec3 c = mix(uCol, vec3(1.0, 0.98, 0.9), smoothstep(wdt * 0.6, 0.0, d));
  gl_FragColor = vec4(c * m * uA * 1.7, m * uA);
}`;
const BB_V = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RING_F = /* glsl */`
uniform sampler2D uTex; uniform float uA; uniform vec3 uCol; uniform float uAdd;
varying vec2 vUv;
void main(){
  float a = texture2D(uTex, vUv).a * uA;
  if (a < 0.01) discard;
  gl_FragColor = uAdd > 0.5 ? vec4(uCol * a, a) : vec4(uCol, a);
}`;

export class Flashes {
  constructor(scene) {
    this.scene = scene;
    this.slashes = []; this.rings = [];
    const geo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 }, uA: { value: 0 }, uCol: { value: new THREE.Color(1.0, 0.7, 0.25) } },
        vertexShader: BB_V, fragmentShader: SLASH_F, transparent: true, depthWrite: false, depthTest: true,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      }));
      m.visible = false; m.renderOrder = 24; m.frustumCulled = false; scene.add(m);
      this.slashes.push({ m, t: 0, life: 0, ang: 0, size: 1 });
    }
    const tex = [brushRingTexture(7), brushRingTexture(19)];
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
        uniforms: { uTex: { value: tex[i % 2] }, uA: { value: 0 }, uCol: { value: new THREE.Color() }, uAdd: { value: 0 } },
        vertexShader: BB_V, fragmentShader: RING_F, transparent: true, depthWrite: false,
      }));
      m.visible = false; m.renderOrder = 19; m.frustumCulled = false; scene.add(m);
      this.rings.push({ m, t: 0, life: 0, ang: 0, s0: 1, s1: 2, a: 1 });
    }
    this.si = 0; this.ri = 0;
    this._q = new THREE.Quaternion(); this._z = new THREE.Vector3(0, 0, 1);
  }
  slash(p, size, color) {
    const s = this.slashes[this.si++ % this.slashes.length];
    s.m.position.copy(p); s.t = 0; s.life = 0.22; s.ang = Math.random() * Math.PI * 2; s.size = size; s.m.visible = true;
    s.m.material.uniforms.uCol.value.setRGB(color[0], color[1], color[2]);
  }
  ring(p, s0, s1, life, color, additive, alpha = 0.85) {
    const r = this.rings[this.ri++ % this.rings.length];
    r.m.position.copy(p); r.t = 0; r.life = life; r.ang = Math.random() * Math.PI * 2; r.s0 = s0; r.s1 = s1; r.a = alpha; r.m.visible = true;
    const u = r.m.material.uniforms; u.uCol.value.setRGB(color[0], color[1], color[2]); u.uAdd.value = additive ? 1 : 0;
    r.m.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
  }
  update(dt, camera) {
    for (const s of this.slashes) {
      if (!s.m.visible) continue;
      s.t += dt; const k = s.t / s.life;
      if (k >= 1) { s.m.visible = false; continue; }
      s.m.quaternion.copy(camera.quaternion);
      this._q.setFromAxisAngle(this._z, s.ang); s.m.quaternion.multiply(this._q);
      const sc = s.size * (0.7 + k * 0.6); s.m.scale.set(sc * 1.6, sc, 1);
      s.m.material.uniforms.uT.value = k; s.m.material.uniforms.uA.value = 1 - k * k;
    }
    for (const r of this.rings) {
      if (!r.m.visible) continue;
      r.t += dt; const k = r.t / r.life;
      if (k >= 1) { r.m.visible = false; continue; }
      r.m.quaternion.copy(camera.quaternion);
      this._q.setFromAxisAngle(this._z, r.ang + k * 0.6); r.m.quaternion.multiply(this._q);
      const e = 1 - Math.pow(1 - k, 3);
      const sc = r.s0 + (r.s1 - r.s0) * e; r.m.scale.set(sc, sc, 1);
      r.m.material.uniforms.uA.value = r.a * (1 - k) * Math.min(1, k * 8);
    }
  }
  clear() { for (const s of this.slashes) s.m.visible = false; for (const r of this.rings) r.m.visible = false; }
}

export class FX {
  constructor(scene) {
    this.glow = new GlowParticles(scene, 2600);
    this.ink = new InkParticles(scene, 800);
    this.trails = new Ribbons(scene, 40, 22, true);
    this.inkTrails = new Ribbons(scene, 34, 16, 'ink');
    this.inkTrails.mesh.renderOrder = 16;
    this.silk = new Ribbons(scene, 4, 18, false);
    this.flash = new Flashes(scene);
  }
  setPx(px) { this.glow.uniforms.uPx.value = px; this.ink.uniforms.uPx.value = px; }
  update(dt, camera, time) {
    this.glow.update(dt); this.ink.update(dt); this.flash.update(dt, camera);
    this.trails.update(camera.position); this.inkTrails.update(camera.position); this.silk.uniforms.uTime.value = time; this.silk.update(camera.position);
  }
  clear() { this.glow.clear(); this.ink.clear(); this.flash.clear(); }
}

import * as THREE from 'three';
import { brushRingTexture, drawSeal } from './textures.js';
import { OPEN, LATE } from './config.js';

const $ = id => document.getElementById(id);
const RED = new THREE.Color('#c23b22'), GOLD = new THREE.Color('#f0b445');

const TRAIL_V = /* glsl */`
attribute vec2 aUv; attribute float aA;
varying vec2 vUv; varying float vA;
void main(){ vUv = aUv; vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const TRAIL_F = /* glsl */`
uniform vec3 uCol; uniform float uAlpha;
varying vec2 vUv; varying float vA;
float h1(float n){ return fract(sin(n * 91.7) * 43758.5453); }
void main(){
  float across = vUv.y * 0.5 + 0.5;
  float lane = floor(across * 11.0);
  float dry = h1(lane + 1.0);
  float keep = smoothstep(dry * 0.6, dry * 0.6 + 0.12, vA);
  float m = smoothstep(1.0, 0.55, abs(vUv.y)) * keep;
  float a = uAlpha * m * (0.6 + 0.4 * h1(lane + 5.0));
  gl_FragColor = vec4(uCol, a);
}`;

// A brush stroke drawn in screen space (HUD coordinates, y up)
class ScreenTrail {
  constructor(scene, color, alpha, width, life, max = 56) {
    this.max = max; this.pts = []; this.width = width; this.life = life;
    const nv = max * 2;
    this.pos = new Float32Array(nv * 3); this.uv = new Float32Array(nv * 2); this.a = new Float32Array(nv);
    const idx = [];
    for (let i = 0; i < max - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aUv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aA', new THREE.BufferAttribute(this.a, 1).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    this.u = { uCol: { value: new THREE.Color(color) }, uAlpha: { value: alpha } };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: TRAIL_V, fragmentShader: TRAIL_F, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 4;
    scene.add(this.mesh); this.geo = g;
  }
  add(x, y, t) {
    const l = this.pts[this.pts.length - 1];
    if (l && Math.hypot(l.x - x, l.y - y) < 3) { l.t = t; return; }
    this.pts.push({ x, y, t });
    if (this.pts.length > this.max) this.pts.shift();
  }
  clear() { this.pts.length = 0; }
  update(t) {
    while (this.pts.length && t - this.pts[0].t > this.life) this.pts.shift();
    const n = this.pts.length;
    const last = this.pts[n - 1] || { x: -999, y: -999 };
    for (let i = 0; i < this.max; i++) {
      const vi = i * 2;
      if (i >= n || n < 2) {
        this.pos[vi * 3] = this.pos[vi * 3 + 3] = last.x; this.pos[vi * 3 + 1] = this.pos[vi * 3 + 4] = last.y;
        this.a[vi] = this.a[vi + 1] = 0; continue;
      }
      const p = this.pts[i], pa = this.pts[Math.max(0, i - 1)], pb = this.pts[Math.min(n - 1, i + 1)];
      let dx = pb.x - pa.x, dy = pb.y - pa.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const va = Math.max(0, 1 - (t - p.t) / this.life);
      const u = i / (n - 1);
      const w = this.width * (0.25 + 0.75 * va) * (0.45 + 0.55 * Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.5 + 0.0001));
      const nx = -dy * w * 0.5, ny = dx * w * 0.5;
      this.pos[vi * 3] = p.x + nx; this.pos[vi * 3 + 1] = p.y + ny; this.pos[vi * 3 + 2] = 0;
      this.pos[vi * 3 + 3] = p.x - nx; this.pos[vi * 3 + 4] = p.y - ny; this.pos[vi * 3 + 5] = 0;
      this.uv[vi * 2] = u; this.uv[vi * 2 + 1] = 1; this.uv[vi * 2 + 2] = u; this.uv[vi * 2 + 3] = -1;
      this.a[vi] = this.a[vi + 1] = va;
    }
    const at = this.geo.attributes; at.position.needsUpdate = true; at.aUv.needsUpdate = true; at.aA.needsUpdate = true;
  }
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}

export class Hud {
  constructor() {
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
    this.W = 1; this.H = 1;
    const geo = new THREE.PlaneGeometry(1, 1);
    this.ringTex = [brushRingTexture(7), brushRingTexture(19), brushRingTexture(53)];
    const mk = (tex, color, opacity = 1, add) => new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(color), transparent: true, opacity, depthTest: false, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.trail = new ScreenTrail(this.scene, '#c23b22', 0.62, 15, 0.38);
    this.trail2 = new ScreenTrail(this.scene, '#c23b22', 0.62, 15, 0.38);
    this.trails = [this.trail, this.trail2];
    this.ghostTrail = new ScreenTrail(this.scene, '#c23b22', 0.38, 15, 0.55);
    this.reticle = new THREE.Mesh(geo, mk(this.ringTex[0], '#c23b22', 0.95));
    this.reticle2 = new THREE.Mesh(geo, mk(this.ringTex[2], '#c23b22', 0.5));
    this.dot = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: RED.clone(), transparent: true, depthTest: false, depthWrite: false }));
    this.scene.add(this.reticle, this.reticle2, this.dot);
    this.stamps = [];
    for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(geo, mk(this.ringTex[i % 3], '#c23b22', 0)); m.visible = false; this.scene.add(m); this.stamps.push({ m, t: 1, e: null, x: 0, y: 0, s: 60, j: 2 }); }
    this.rings = [];
    for (let i = 0; i < 28; i++) { const m = new THREE.Mesh(geo, mk(this.ringTex[i % 3], '#c23b22', 0.9)); m.visible = false; this.scene.add(m); this.rings.push(m); }
    this.warns = [];
    for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(geo, mk(this.ringTex[(i + 1) % 3], '#1a1d24', 0.7)); m.visible = false; this.scene.add(m); this.warns.push(m); }
    this.locks = [];
    for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(geo, mk(this.ringTex[1], '#c23b22', 0)); m.visible = false; m.renderOrder = 5; this.scene.add(m); this.locks.push(m); }
    this.marks = [];
    for (let i = 0; i < 28; i++) { const m = new THREE.Mesh(geo, mk(this.ringTex[(i + 2) % 3], '#c23b22', 0.3)); m.visible = false; this.scene.add(m); this.marks.push(m); }
    // ghost fingertip & its stamp
    this.ghostDot = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshBasicMaterial({ color: RED.clone(), transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
    this.ghostRing = new THREE.Mesh(geo, mk(this.ringTex[1], '#c23b22', 0));
    this.scene.add(this.ghostDot, this.ghostRing);
    this.gh = null; this.ghRing = 0;
    // ripples (touch-here cue) and flying glints
    this.ripples = [];
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(geo, mk(this.ringTex[i % 3], '#f0b445', 0)); m.visible = false; this.scene.add(m); this.ripples.push({ m, t: 1, x: 0, y: 0 }); }
    const gtex = glowTexture();
    this.glints = [];
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: gtex, color: GOLD.clone(), transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.visible = false; m.renderOrder = 6; this.scene.add(m);
      this.glints.push({ m, active: false, t: 0, dur: 0.7, x0: 0, y0: 0, x1: 0, y1: 0, cx: 0, cy: 0, cb: null });
    }
    this.rot = 0; this.hold = 0; this.beat = 0; this.visible = false; this.retA = 0; this.full = 0;
    this.setVisible(false);
    // DOM
    this.el = {
      hud: $('hud'), score: $('score'), mult: $('mult'), stage: $('stage-name'), prog: $('prog'), life: $('life'),
      od: $('btn-od'), boss: $('bossbar'), bossHp: $('bosshp'), fx: $('fx'),
    };
    this.beads = Array.from(this.el.life.children);
    this.odPips = Array.from(this.el.od.querySelectorAll('.od-pips i'));
    this.pops = [];
    for (let i = 0; i < 14; i++) { const d = document.createElement('div'); d.className = 'pop'; this.el.fx.appendChild(d); this.pops.push(d); }
    this.popI = 0;
    this.shownScore = 0; this.targetScore = 0; this.lastScoreText = '';
    this.multTimer = 0;
  }

  setSize(w, h) {
    this.W = w; this.H = h;
    this.cam.left = 0; this.cam.right = w; this.cam.top = h; this.cam.bottom = 0; this.cam.updateProjectionMatrix();
  }
  setVisible(v) {
    this.visible = v;
    this.scene.visible = v;
    if (!v) {
      for (const r of this.rings) r.visible = false; for (const r of this.warns) r.visible = false; for (const r of this.marks) r.visible = false; for (const r of this.locks) r.visible = false;
      this.trail2.clear();
      for (const st of this.stamps) { st.t = 1; st.m.visible = false; }
      this.trail.clear(); this.ghostTrail.clear(); this.gh = null; this.ghRing = 0;
    }
  }
  showDom(v) { this.el.hud.classList.toggle('hidden', !v); }
  dim(v) { this.el.hud.classList.toggle('dim', v); }

  // ---------------------------------------------------------------- per frame
  update(dt, s) {
    if (!this.visible) return;
    const H = this.H, t = s.time;
    this.hold += ((s.holding ? 1 : 0) - this.hold) * Math.min(1, dt * 14);
    this.rot += dt * (0.5 + this.hold * 2.6);
    this.beat = Math.max(0, this.beat - dt * 4);
    // reticle: follows the pointer; on touch screens it only exists under the finger
    this.retA += ((s.showReticle ? 1 : 0) - this.retA) * Math.min(1, dt * (s.showReticle ? 20 : 8));
    const base = s.touch ? Math.max(78, Math.min(104, Math.min(this.W, this.H) * 0.24)) : Math.max(46, Math.min(66, Math.min(this.W, this.H) * 0.13));
    const sc = base * (1 - this.hold * 0.12) * (1 + this.beat * 0.06) * (0.7 + 0.3 * this.retA);
    const x = s.rx, y = H - s.ry;
    const vis = this.retA > 0.01;
    this.reticle.visible = this.reticle2.visible = this.dot.visible = vis;
    this.reticle.position.set(x, y, 0); this.reticle.scale.set(sc, sc, 1); this.reticle.rotation.z = -this.rot;
    this.reticle.material.opacity = 0.95 * this.retA;
    this.reticle2.position.set(x, y, 0); this.reticle2.scale.set(sc * 0.62, sc * 0.62, 1); this.reticle2.rotation.z = this.rot * 1.3;
    this.reticle2.material.opacity = (0.25 + this.hold * 0.55) * this.retA;
    this.dot.position.set(x, y, 0); const ds = (s.touch ? 0 : 2.6 + this.hold * 1.4); this.dot.scale.set(ds || 0.001, ds || 0.001, 1);
    this.dot.material.opacity = this.retA;
    // brush trails
    this.trail.update(t); this.trail2.update(t);
    this.updateGhost(dt, t);
    this.ghostTrail.update(t);
    // approach rings: a brush circle closes onto each spirit exactly on its beat
    let ri = 0, gi = 0;
    const per = new Map();
    for (const e of s.enemies) {
      if (!e.alive || !e.onScreen || !e.nt || e.ni >= e.nt.length || !e.lockable) continue;
      const T = e.nt[e.ni], k = (T - s.atime) / OPEN;
      if (k > 1 || k < -LATE / OPEN) continue;
      if (e.chain) { const c = per.get(e.chain) || 0; if (c >= 2) continue; per.set(e.chain, c + 1); }
      if (ri >= this.rings.length) break;
      const hs = Math.max(58, Math.min(210, e.sr * 2.4));
      const m = this.rings[ri++];
      const kk = Math.max(0, k);
      const sc = hs * (1 + 2.1 * kk * kk + 0.25 * kk);
      m.visible = true; m.position.set(e.sx, H - e.sy, 0); m.scale.set(sc, sc, 1); m.rotation.z = -kk * 3 + e.id;
      const fadeIn = Math.min(1, (1 - k) / 0.22);
      m.material.opacity = k >= 0 ? 0.92 * fadeIn : 0.92 * Math.max(0, 1 + k * OPEN / LATE);
      const hot = Math.max(0, 1 - Math.abs(k) * OPEN / 0.09);
      m.material.color.copy(RED).lerp(GOLD, e.sealTo > e.ni ? Math.max(hot, 0.5) : hot);
      if (gi < this.marks.length) {
        const gm = this.marks[gi++];
        gm.visible = true; gm.position.set(e.sx, H - e.sy, 0); gm.scale.set(hs, hs, 1); gm.rotation.z = e.id * 1.7;
        gm.material.opacity = 0.2 * fadeIn * (k >= 0 ? 1 : Math.max(0, 1 + k * OPEN / LATE));
        gm.material.color.copy(RED);
      }
    }
    for (; ri < this.rings.length; ri++) this.rings[ri].visible = false;
    // seals: a small brush circle stays on every spirit the brush has claimed
    let li = 0;
    for (const e of s.enemies) {
      if (li >= this.locks.length) break;
      if (!e.alive || !e.onScreen || !e.nt || e.ni >= e.nt.length || !(e.sealTo > e.ni)) continue;
      const m = this.locks[li++];
      const sz = Math.max(46, Math.min(150, e.sr * 1.7)) * (1 + this.beat * 0.08);
      m.visible = true; m.position.set(e.sx, H - e.sy, 0); m.scale.set(sz, sz, 1); m.rotation.z = -t * 1.6 + e.id;
      m.material.opacity = 0.85; m.material.color.copy(RED);
    }
    for (; li < this.locks.length; li++) this.locks[li].visible = false;
    // tutorial marks: a breathing circle on the very first spirit
    for (const e of s.enemies) {
      if (gi >= this.marks.length) break;
      if (!e.mark || !e.alive || !e.onScreen) continue;
      const m = this.marks[gi++];
      const br = 0.5 + 0.5 * Math.sin(t * 3.2 + e.id);
      const size = Math.max(64, Math.min(200, e.sr * 2.7)) * (1 + br * 0.1);
      m.visible = true; m.position.set(e.sx, H - e.sy, 0); m.scale.set(size, size, 1); m.rotation.z = t * 0.5 + e.id;
      m.material.opacity = 0.12 + br * 0.22; m.material.color.copy(RED);
    }
    for (; gi < this.marks.length; gi++) this.marks[gi].visible = false;
    // strike stamps
    for (const st of this.stamps) {
      if (st.t >= 1) { st.m.visible = false; continue; }
      st.t += dt / 0.5;
      if (st.e && st.e.alive) { st.x = st.e.sx; st.y = st.e.sy; }
      const k = Math.min(1, st.t);
      const pop = k < 0.25 ? 1.45 - k * 1.8 : 1 + (k - 0.25) * 0.25;
      st.m.visible = true; st.m.position.set(st.x, H - st.y, 0); st.m.scale.set(st.s * pop, st.s * pop, 1);
      st.m.material.opacity = (st.j === 0 ? 0.55 : 0.95) * (1 - Math.pow(k, 2));
    }
    // threats (incoming ghost fire)
    let wi = 0;
    for (const e of s.enemies) {
      if (wi >= this.warns.length) break;
      if (e.kind !== 'wisp' || !e.alive || !e.onScreen) continue;
      const p = e.t / e.data.T; if (p < 0.7) continue;
      const m = this.warns[wi++];
      const pulse = 0.5 + 0.5 * Math.sin(t * 22);
      const size = Math.max(44, e.sr * 2.4) * (1.3 - p * 0.3);
      m.visible = true; m.position.set(e.sx, H - e.sy, 0); m.scale.set(size, size, 1); m.rotation.z = t * 3;
      m.material.color.set(s.night ? '#e9e1d1' : '#1a1d24');
      m.material.opacity = (0.3 + pulse * 0.5) * Math.min(1, (p - 0.7) / 0.1);
    }
    for (; wi < this.warns.length; wi++) this.warns[wi].visible = false;
    // ripples & glints
    for (const r of this.ripples) {
      if (r.t >= 1) { r.m.visible = false; continue; }
      r.t += dt / 1.1; const e = 1 - Math.pow(1 - Math.min(1, r.t), 3);
      const size = r.s0 + (r.s1 - r.s0) * e;
      r.m.visible = true; r.m.position.set(r.x, H - r.y, 0); r.m.scale.set(size, size, 1); r.m.rotation.z = r.t * 2;
      r.m.material.opacity = 0.75 * (1 - Math.min(1, r.t));
    }
    for (const g of this.glints) {
      if (!g.active) continue;
      g.t += dt;
      if (g.t < 0) { g.m.visible = false; continue; }
      const k = Math.min(1, g.t / g.dur), e = k * k * (3 - 2 * k), a = 1 - e;
      const gx = a * a * g.x0 + 2 * a * e * g.cx + e * e * g.x1, gy = a * a * g.y0 + 2 * a * e * g.cy + e * e * g.y1;
      const size = 26 * (1 - k * 0.55);
      g.m.visible = true; g.m.position.set(gx, H - gy, 0); g.m.scale.set(size, size, 1);
      g.m.material.opacity = 0.9;
      if (k >= 1) { g.active = false; g.m.visible = false; if (g.cb) { const cb = g.cb; g.cb = null; cb(); } }
    }
    // DOM score count-up
    if (this.shownScore !== this.targetScore) {
      const d = this.targetScore - this.shownScore;
      this.shownScore += Math.sign(d) * Math.max(1, Math.ceil(Math.abs(d) * Math.min(1, dt * 9)));
      if (Math.abs(this.targetScore - this.shownScore) < 1) this.shownScore = this.targetScore;
      const txt = this.shownScore.toLocaleString('en-US');
      if (txt !== this.lastScoreText) { this.el.score.textContent = txt; this.lastScoreText = txt; }
    }
    if (this.multTimer > 0) { this.multTimer -= dt; if (this.multTimer <= 0) this.el.mult.classList.remove('on'); }
  }

  // ---------------------------------------------------------------- show, don't tell
  // ghost hand: a faint brush that performs the gesture along screen-space points (y down)
  ghost(pts, dur, ring, onDone) {
    const P = pts.map(p => ({ x: p[0], y: this.H - p[1] }));
    this.gh = { P, t: -0.25, dur, ring, onDone };
    this.ghostTrail.clear();
  }
  updateGhost(dt, time) {
    const g = this.gh;
    this.ghRing = Math.max(0, this.ghRing - dt * 1.4);
    if (this.ghRing > 0 && this.ghRingAt) {
      const r = this.ghRingAt; const pop = 1 + Math.max(0, this.ghRing - 0.7) * 2.2;
      this.ghostRing.visible = true; this.ghostRing.position.set(r.x, r.y, 0); this.ghostRing.scale.set(r.s * pop, r.s * pop, 1);
      this.ghostRing.material.opacity = Math.min(1, this.ghRing) * 0.55; this.ghostRing.rotation.z = time;
    } else this.ghostRing.visible = false;
    if (!g) { this.ghostDot.material.opacity = Math.max(0, this.ghostDot.material.opacity - dt * 3); return; }
    g.t += dt;
    const k = Math.max(0, Math.min(1, g.t / g.dur));
    const f = k * (g.P.length - 1), i = Math.min(g.P.length - 2, Math.floor(f)), u = f - i;
    const a = g.P[Math.max(0, i - 1)], b = g.P[i], c = g.P[i + 1], d = g.P[Math.min(g.P.length - 1, i + 2)];
    const cr = (p0, p1, p2, p3) => 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
    const x = cr(a.x, b.x, c.x, d.x), y = cr(a.y, b.y, c.y, d.y);
    const press = g.t < 0 ? 1 + (-g.t) * 2.5 : 1;
    this.ghostDot.visible = true; this.ghostDot.position.set(x, y, 0); this.ghostDot.scale.set(15 * press, 15 * press, 1);
    this.ghostDot.material.opacity = g.t < 0 ? 0.32 * (1 + g.t * 4) : (k < 1 ? 0.32 : Math.max(0, 0.32 - (g.t - g.dur) * 1.2));
    if (g.t >= 0 && k < 1) this.ghostTrail.add(x, y, time);
    if (k >= 1 && !g.done) {
      g.done = true;
      if (g.ring) { this.ghRingAt = { x: g.ring[0], y: this.H - g.ring[1], s: g.ring[2] }; this.ghRing = 1.0; }
      if (g.onDone) g.onDone();
    }
    if (g.t > g.dur + 0.4) this.gh = null;
  }
  ghostActive() { return !!this.gh; }
  ripple(x, y, s0 = 40, s1 = 120) {
    const r = this.ripples.find(q => q.t >= 1) || this.ripples[0];
    r.t = 0; r.x = x; r.y = y; r.s0 = s0; r.s1 = s1;
  }
  // golden glints flying from a point to a DOM element (y down)
  fly(x0, y0, el, color, n, cb) {
    const rc = el.getBoundingClientRect();
    const x1 = rc.left + rc.width / 2, y1 = rc.top + rc.height / 2;
    let first = true;
    for (let i = 0; i < n; i++) {
      const g = this.glints.find(q => !q.active); if (!g) break;
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
      const off = (Math.random() - 0.5) * 0.9 * l;
      Object.assign(g, { active: true, t: -i * 0.028, dur: 0.62 + Math.random() * 0.18, x0: x0 + (Math.random() - 0.5) * 30, y0: y0 + (Math.random() - 0.5) * 30, x1, y1, cx: mx - dy / l * off, cy: my + dx / l * off - 60, cb: first ? cb : null });
      g.m.material.color.set(color);
      first = false;
    }
    if (first && cb) cb();
  }
  center(el) { const rc = el.getBoundingClientRect(); return [rc.left + rc.width / 2, rc.top + rc.height / 2]; }

  stamp(e, j, scale = 1) {
    const st = this.stamps.find(q => q.t >= 1) || this.stamps[0];
    st.t = 0; st.e = e; st.x = e.sx; st.y = e.sy; st.j = j;
    st.s = Math.max(58, Math.min(210, e.sr * 2.4)) * scale;
    st.m.material.color.copy(j === 3 ? GOLD : j === 0 ? new THREE.Color('#2a2d33') : RED);
  }
  judge(x, y, j) {
    const d = this.pops[this.popI++ % this.pops.length];
    d.textContent = ['', '好', '妙', '绝'][j]; d.className = 'pop j' + j;
    d.style.left = `${Math.round(x)}px`; d.style.top = `${Math.round(y)}px`;
    void d.offsetWidth; d.classList.add('go');
  }
  setCombo(n, how) {
    const el = $('combo');
    if (!this.comboN) this.comboN = $('combo-n');
    this.comboN.textContent = String(n);
    el.classList.toggle('on', n >= 5 || how === 'break');
    if (how) { el.classList.remove('bump', 'break'); void el.offsetWidth; el.classList.add(how); }
    if (how === 'break') { clearTimeout(this.comboT); this.comboT = setTimeout(() => { if (this.comboN.textContent === '0') el.classList.remove('on'); }, 600); }
  }

  // ---------------------------------------------------------------- DOM
  setScore(v, instant) { this.targetScore = v; if (instant) { this.shownScore = v; this.el.score.textContent = v.toLocaleString('en-US'); this.lastScoreText = ''; } }
  showMult(n) {
    const cn = ['', '一', '二', '三', '四', '五', '六', '七', '八'];
    this.el.mult.textContent = n >= 2 ? `${cn[n] || n}连 ×${n}` : '';
    this.el.mult.classList.toggle('on', n >= 2); this.multTimer = 1.6;
  }
  setStage(name, prog) { if (name !== undefined) this.el.stage.textContent = name; if (prog !== undefined) this.el.prog.style.transform = `translateX(${Math.round(prog * 56)}px)`; }
  setLife(hp, hit, heal) {
    this.beads.forEach((b, i) => {
      if (hit && i === hp) { b.classList.remove('hit', 'heal'); void b.offsetWidth; b.classList.add('hit'); }
      if (heal && i === hp - 1) { b.classList.remove('hit', 'heal'); void b.offsetWidth; b.classList.add('heal'); }
      b.classList.toggle('off', i >= hp);
    });
  }
  setOD(charges, active, revealed, pop) {
    this.odPips.forEach((p, i) => p.classList.toggle('on', i < charges));
    this.el.od.classList.toggle('ready', charges > 0 && !active);
    this.el.od.classList.toggle('off', !revealed);
    if (pop) { this.el.od.classList.remove('odpop'); void this.el.od.offsetWidth; this.el.od.classList.add('odpop'); }
  }
  setBoss(frac) {
    if (frac === null) { this.el.boss.classList.add('hidden'); return; }
    this.el.boss.classList.remove('hidden');
    this.el.bossHp.style.transform = `scaleX(${Math.max(0, frac)})`;
  }
  pop(x, y, text, big) {
    const d = this.pops[this.popI++ % this.pops.length];
    d.textContent = text; d.className = 'pop' + (big ? ' big' : '');
    d.style.left = `${Math.round(x)}px`; d.style.top = `${Math.round(y)}px`;
    void d.offsetWidth; d.classList.add('go');
  }
  card(st) {
    const c = document.createElement('div'); c.className = 'card';
    c.innerHTML = `<div class="ch">${st.chapter}</div><div class="nm">${st.name}</div><div class="po">${st.poem.join('<br>')}</div>`;
    const seal = document.createElement('canvas'); seal.width = 60; seal.height = 60; seal.className = 'sl';
    drawSeal(seal, st.name[0], { seed: st.name.charCodeAt(0) });
    c.children[1].after(seal);
    this.el.fx.appendChild(c); setTimeout(() => c.remove(), 4400);
  }
  poem(lines, dur = 5.5) {
    const c = document.createElement('div'); c.className = 'poem';
    c.style.animationDuration = `${dur}s`;
    c.innerHTML = lines.join('<br>');
    this.el.fx.appendChild(c); setTimeout(() => c.remove(), dur * 1000 + 100);
  }
  bonus(text, sub) {
    const c = document.createElement('div'); c.className = 'bonus';
    c.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
    this.el.fx.appendChild(c); setTimeout(() => c.remove(), 1600);
  }
  warn() { const c = document.createElement('div'); c.className = 'warn'; this.el.fx.appendChild(c); setTimeout(() => c.remove(), 3100); }
  clearFx() {
    for (const c of Array.from(this.el.fx.children)) if (!c.classList.contains('pop')) c.remove();
    for (const g of this.glints) { g.active = false; g.cb = null; g.m.visible = false; }
    for (const r of this.ripples) r.t = 1;
  }
}

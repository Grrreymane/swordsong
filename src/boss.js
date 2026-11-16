import * as THREE from 'three';
import { Dragon, drad, DL } from './dragon.js';

// seals pinned along the dragon's back (u along the body)
const SEAL_U = [0.1, 0.22, 0.34, 0.46, 0.58, 0.7];
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => k * k * (3 - 2 * k);

export class Boss {
  constructor(scene, game) {
    this.scene = scene; this.game = game;
    this.dragon = new Dragon(scene);
    this.ku = this.dragon.u;            // dragon uniforms (hit flash, corruption, freed)
    this.kun = this.dragon.group;
    this.heart = this.dragon.pearl;     // the pearl is phase two's target
    this.heartU = this.dragon.pu;
    this.active = false; this.phase = 0;
    this._v = new THREE.Vector3(); this._w = new THREE.Vector3();
    this.seals = []; this.heartE = null;
    this.cam = { x: 0, y: 0, d: 200 };
  }

  start() {
    this.active = true; this.phase = 1; this.t = 0; this.barN = 0; this.th = 0; this.jawT = 0; this.dk = 1; this.t3 = 0;
    const D = this.dragon, u = this.ku;
    u.uCorrupt.value = 1; u.uFreed.value = 0; u.uDissolve.value = 0; u.uFade.value = 1; u.uJaw.value = 0.1;
    this.heartU.uPure.value = 0;
    this.kun.visible = true; this.heart.visible = false; this.heart.scale.setScalar(1);
    this.splashed = false; this.roared = false; this.flyRoar = false;
    const g = this.game, C = g.C;
    const D0 = this.depth(C);
    this.start0 = { x: -D0 * 0.08, y: -175, d: D0 + 15 };
    D.reset(this.start0.x, this.start0.y, this.start0.d);
    this.seals = SEAL_U.map(su => g.enemies.spawn('seal', null, { external: true, onKill: () => this.onSeal(), data: { u: su }, lockable: true, nt: [], hp: 3, pitch: [0, 2, 4] }));
    this.sealIdx = -1; this.hb = 0;
    this.seals.forEach(s => { s.mesh.material.depthTest = false; s.mesh.renderOrder = 30; });
    this.heartE = null;
    this.maxHp = this.seals.length * 3 + 16;
    this.D.update(0, C, g.time);
  }
  get D() { return this.dragon; }
  depth(C) { const near = Math.min(1, Math.max(0, (C.aspect - 0.5) / 0.8)); return (this.phase === 2 ? 0.92 : 1) * (215 - 40 * near); }
  hpFrac() {
    if (!this.active) return null;
    let hp = 0;
    for (const s of this.seals) if (s.alive) hp += s.hp;
    if (this.phase === 1) hp += 16; else if (this.heartE && this.heartE.alive) hp += this.heartE.hp;
    return hp / this.maxHp;
  }
  roar(open = 1.4) { this.jawT = Math.max(this.jawT, open); }
  onSeal() {
    this.game.audio.impact('seal');
    this.game.shake(0.6);
    this.ku.uHit.value = 0.8;
    if (this.seals.every(s => !s.alive) && this.phase === 1) {
      this.phase = 2; this.t2 = 0;
      const g = this.game;
      g.audio.roar(g.audio.now() + 0.05); this.roar(2.4);
      g.hud.poem(['龙战于野', '其血玄黄'], 5);
      g.audio.setOverride('boss2', g.audio.currentBar() + 1);
      this.heart.visible = true; this.heartU.uA.value = 0;
      this.heartE = g.enemies.spawn('heart', null, { external: true, onKill: () => this.onHeart(), nt: [], hp: 16, pitch: [0, 2, 4, 7] });
      this.D.mouth(this.heartE.pos);
    }
  }
  onHeart() {
    this.phase = 3; this.t3 = 0;
    this.pearlCam = { x: this.pearlX || 0, y: this.pearlY || 0, d: this.pearlD || 120 };
    this.headCam0 = { ...this.cam };
    this.game.onBossDefeated();
  }

  // camera-space placement helper
  place(C, X, Y, D, out) { return out.copy(C.camPos).addScaledVector(C.F, D).addScaledVector(C.R, X).addScaledVector(C.U, Y); }

  // the head's position in camera space at boss time t, loop angle th, ending time t3
  headAt(C, t, th, t3) {
    const tanH = C.ky / 0.86, asp = C.aspect;
    if (this.phase < 3) {
      const near = Math.min(1, Math.max(0, (asp - 0.5) / 0.8));
      const D0 = this.dk * (215 - 40 * near);
      // the figure-8's tightest turn (radius ~3.1·ay²/ax) is at its left/right ends: keep it wide enough
      // that the body sweeps round instead of folding
      const ax = Math.min(105, D0 * tanH * asp * 0.66);
      const ay = Math.min(Math.max(Math.min(46, D0 * tanH * 0.26), Math.sqrt(ax * 50 / 3.08)), D0 * tanH * 0.42);
      let X = ax * Math.sin(th), Y = 8 + ay * Math.sin(2 * th + 0.5), Dd = D0 + 30 * Math.cos(th * 0.5);
      const intro = 7.5;
      if (t < intro) {
        // rise out of the cloud sea, then fall into the loop
        const e = t / intro, k = ease(Math.min(1, e * 1.15)), s0 = this.start0;
        const rise = Math.sin(Math.min(1, e * 1.25) * Math.PI * 0.5);
        X = lerp(s0.x, X, k); Y = lerp(s0.y, Y + 26 * (1 - k), rise); Dd = lerp(s0.d, Dd, k);
      }
      // debug: pin the head at a pose for close-up looks (window.__dragonPose = {x, y, d, sway})
      const dp = typeof window !== 'undefined' && window.__dragonPose;
      if (dp) { X = dp.x + Math.sin(t * 0.9) * (dp.sway ?? 30); Y = dp.y + Math.sin(t * 1.3) * (dp.sway ?? 30) * 0.4; Dd = dp.d; }
      return [X, Y, Dd];
    }
    // freed: the dragon takes its pearl and climbs into the sky in a spiral
    const k = t3, h0 = this.headCam0, pc = this.pearlCam;
    if (k < 1.8) { const e = ease(k / 1.8); return [lerp(h0.x, pc.x, e), lerp(h0.y, pc.y - 2, e), lerp(h0.d, pc.d + 10, e)]; }
    const e = k - 1.8;
    return [pc.x * Math.max(0, 1 - e * 0.25) + Math.sin(e * 1.3) * 26 * Math.min(1, e * 0.5),
      pc.y - 2 + e * 16 + e * e * 6.5,
      pc.d + 10 + e * 26 + Math.cos(e * 1.3) * 18 * Math.min(1, e * 0.5)];
  }

  update(dt, C, time) {
    if (!this.active) return;
    const ku = this.ku, Dg = this.dragon;
    const t0 = this.t, th0 = this.th, t30 = this.t3 || 0;
    this.t += dt;
    if (this.phase < 3) this.th += dt * (this.phase === 2 ? 0.66 : 0.58); else this.t3 += dt;
    this.dk += ((this.phase === 2 ? 0.92 : 1) - this.dk) * Math.min(1, dt * 0.8);
    const t = this.t;
    // sub-step the head along its path, so the body follows a smooth curve at any frame rate
    const end = this.headAt(C, t, this.th, this.t3);
    const last = Dg.hist[Dg.hist.length - 1];
    const n = last ? Math.min(64, Math.max(1, Math.ceil(Math.hypot(end[0] - last[0], end[1] - last[1], end[2] - last[2]) / 1.5))) : 1;
    for (let i = 1; i < n; i++) {
      const f = i / n, p = this.headAt(C, t0 + dt * f, th0 + (this.th - th0) * f, t30 + ((this.t3 || 0) - t30) * f);
      Dg.push(p[0], p[1], p[2]);
    }
    const [X, Y, Dd] = end;
    this.cam.x = X; this.cam.y = Y; this.cam.d = Dd;
    if (this.phase < 3 && t < 7.5) {
      const e = t / 7.5;
      if (!this.splashed && Y > -48) {
        this.splashed = true;
        this.place(C, X, -34, Dd, this._v);
        this.game.fx.glow.burst(this._v, 60, 40, [1.6, 1.6, 1.7], 3.5, 2.2, { drag: 1.2, grav: 8, jitter: 18 });
        this.game.fx.ink.burst(this._v, 14, 30, 10, 34, 0.35, 2.6);
        this.game.shake(1.0); this.game.audio.boom(0.8);
      }
      if (!this.roared && e > 0.55) { this.roared = true; this.roar(2.2); this.game.audio.longyin(this.game.audio.now() + 0.05, 0.26); }
    }
    Dg.push(X, Y, Dd);
    Dg.update(dt, C, time);
    // jaw: opens to roar and to breathe ghost fire
    this.jawT = Math.max(0, this.jawT - dt);
    const jawTarget = this.jawT > 0 ? 0.62 : 0.1 + 0.05 * Math.sin(time * 1.3);
    ku.uJaw.value += (jawTarget - ku.uJaw.value) * Math.min(1, dt * 7);
    // seals ride on its back
    const show = this.phase === 1 && t > 6.5;
    for (const s of this.seals) {
      if (s.alive) { s.lockable = show; s.mesh.visible = show || s.dying; }
      if (!s.alive && !s.dying) continue;
      const u = s.data.u;
      Dg.at(u, 0, drad(u) * 1.05 + 2.4, 0, s.pos);
    }
    // the pearl: spat out at phase two, it hangs before the dragon, which circles behind it
    if (this.phase === 2 && this.heartE) {
      const hk = Math.min(1, this.t2 / 2.5), he = 1 - Math.pow(1 - hk, 3);
      this.pearlD = Dd - 85 * he;
      // keep the pearl in the open middle of the screen, clear of the HUD
      const kx = C.kx * this.pearlD, ky = C.ky * this.pearlD;
      this.pearlX = Math.max(-0.62 * kx, Math.min(0.62 * kx, X * (1 - 0.7 * he)));
      this.pearlY = Math.max(-0.3 * ky, Math.min(0.48 * ky, Y + 6 + 8 * he + Math.sin(time * 1.4) * 3));
      this.place(C, this.pearlX, this.pearlY, this.pearlD, this.heartE.pos);
      if (hk < 1) { Dg.mouth(this._w); this.heartE.pos.lerpVectors(this._w, this.heartE.pos, he); }
      this.heart.position.copy(this.heartE.pos);
      this.heart.rotation.y = time * 0.6; this.heart.rotation.x = time * 0.3;
      this.heartU.uA.value = Math.min(1, this.heartU.uA.value + dt * 0.8);
      this.heartU.uHit.value = Math.max(0, this.heartU.uHit.value - dt * 5);
      if (!this.heartE.alive) this.heart.visible = false;
      this.t2 += dt;
    }
    if (this.phase === 3) {
      const k = this.t3;
      ku.uCorrupt.value = Math.max(0, 1 - k * 0.7);
      ku.uFreed.value = Math.min(1, k * 0.45);
      this.heartU.uPure.value = Math.min(1, k * 0.8);
      this.heart.visible = true; this.heartU.uA.value = 1;
      // the pearl drifts to the dragon's jaws and is carried up
      if (k < 1.8) this.place(C, this.pearlCam.x, this.pearlCam.y, this.pearlCam.d, this.heart.position);
      else { Dg.mouth(this._w); this.heart.position.lerp(this._w, Math.min(1, dt * 6)); }
      this.heart.scale.setScalar(Math.max(0.55, 1 - k * 0.12));
      if (k > 1.6 && !this.flyRoar) { this.flyRoar = true; this.roar(2.0); this.game.audio.longyin(this.game.audio.now() + 0.05, 0.3); }
      if (k > 9.5) ku.uFade.value = Math.max(0, 1 - (k - 9.5) / 2);
      if (k > 11.5) { this.kun.visible = false; this.heart.visible = false; }
    }
  }

  // the boss is a song section: seals and the heart light up as notes on the downbeat
  // the dragon calls, the player answers: one voice at a time, on the bar lines
  scheduleNotes(ev) {
    const g = this.game, B = ev.beat || 0.5, pend = e => e.nt && e.ni < e.nt.length;
    const take = (e, beats) => {
      const ts = beats.map(b => ev.t + b * B);
      if (!ts.every(t => g.isFree(t))) return false;
      e.nt = ts; e.ni = 0; e.sealTo = 0; for (const t of ts) g.resv.push(t);
      return true;
    };
    if (this.phase === 1) {
      if (this.seals.some(s => s.alive && pend(s))) return;
      const alive = this.seals.filter(s => s.alive && s.lockable);
      if (!alive.length) return;
      // the next seal in turn that the coiling body has brought into view
      for (let k = 1; k <= alive.length; k++) {
        const i = (this.sealIdx + k) % alive.length, s = alive[i];
        if (s.onScreen === false) continue;
        if (take(s, [1, 2, 3].slice(0, s.hp))) this.sealIdx = i;
        return;
      }
    } else if (this.phase === 2 && this.heartE && this.heartE.alive) {
      const h = this.heartE; if (pend(h) || this.t2 < 2.5) return;
      const pat = (this.hb % 2) ? [1, 1.5, 2, 2.5] : [1, 2, 3];
      if (take(h, pat.slice(0, h.hp))) this.hb++;
    }
  }
  volley(ev, n, ring) {
    const g = this.game;
    const k = ring ? 5 : 4;
    for (let i = 0; i < k; i++) {
      let x = n.x + (i - (k - 1) / 2) * 0.12, y = n.y + Math.sin(i) * 0.06;
      if (ring) { const a = this.barN * 0.4 + i / k * Math.PI * 2; x = n.x + Math.cos(a) * 0.18; y = n.y + Math.sin(a) * 0.14; }
      g.spawnWisp(x, y, n.z, (ring ? 3.2 : 2.9) + i * 0.12, 2 + i * 0.5, false, ev.t, 0);
    }
  }
  onBeat(ev, C) {
    if (!this.active || this.phase === 3) return;
    const g = this.game;
    if (this.t < 7 || ev.st !== 0) return;
    const n = ++this.barN;
    if (this.phase === 1) {
      if (n % 8 === 6) { g.level.summon(); return; }
      if (n % 4 === 3) {
        // ghost fire from the jaws, when they are in view
        const m = g.worldToNorm(this.dragon.mouth(this._v));
        if (Math.abs(m.x) < 0.92 && m.y > -0.6 && m.y < 0.9 && m.z > 0) { this.roar(1.6); this.volley(ev, m, false); return; }
      }
      this.scheduleNotes(ev);
    } else if (this.phase === 2 && this.heartE && this.heartE.alive) {
      if (this.t2 > 2.5 && n % 8 === 6) { g.level.summon(); return; }
      if (this.t2 > 2.5 && n % 4 === 3) { this.volley(ev, g.worldToNorm(this.heartE.pos), true); return; }
      this.scheduleNotes(ev);
    }
  }

  hide() {
    this.active = false; this.kun.visible = false; this.heart.visible = false; this.flyRoar = false;
    for (const s of this.seals) if (!s.dead) this.game.enemies.remove(s);
    if (this.heartE && !this.heartE.dead) this.game.enemies.remove(this.heartE);
    this.seals = []; this.heartE = null;
  }
}

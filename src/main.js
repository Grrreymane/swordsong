import * as THREE from 'three';
import { STEP, BEAT, BAR, SPEED, SWORD_DEPTH, BOSS_BAR, STAGES, OPEN, LATE, PERFECT, GREAT } from './config.js';
import { U, PaletteMixer } from './glsl.js';
import * as MUSIC from './tracks.js';
const TRACKS = MUSIC.TRACKS, CREDITS = MUSIC.CREDITS || [];
import { Rail } from './rail.js';
import { World } from './world.js';
import { Post } from './post.js';
import { FX } from './fx.js';
import { Player, smallSwordGeometry, smallSwordMaterial } from './player.js';
import { Enemies } from './enemies.js';
import { Boss } from './boss.js';
import { Level, W } from './level.js';
import { Hud } from './hud.js';
import { AudioEngine } from './audio.js';
import { drawSeal, brushStrokeURL } from './textures.js';
import { Board } from './board.js';

const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
};
const vibrate = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const segD2 = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 > 1e-6 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 1;
  const qx = ax + dx * t - px, qy = ay + dy * t - py; return qx * qx + qy * qy;
};
const JF = [0, 0.4, 0.75, 1];

class Game {
  constructor() {
    this.canvas = $('gl');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.W = innerWidth; this.H = innerHeight;
    this.maxDpr = Math.min(window.devicePixelRatio || 1, isTouch ? 1.6 : 2);
    this.dpr = this.maxDpr;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.W, this.H, false);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, this.W / this.H, 0.5, 6000);
    this.hud = new Hud();
    this.post = new Post(this.renderer, this.scene, this.camera, this.hud.scene, this.hud.cam, this.W, this.H, this.dpr);
    this.palette = new PaletteMixer('dawn');
    this.audio = new AudioEngine();
    // recorded music: fetch every track now (small files), decode the first ones before anyone taps
    this.audio.registerTracks(TRACKS);
    for (const t of TRACKS) if (!t.alias) this.audio.fetchSlot(t.slot);
    this.audio.decodeSlot('calm').then(() => this.audio.decodeSlot('stage1'));
    // #audiocheck: a small readout of the recorded tracks (to verify hosting without a debugger)
    const audioCheck = () => {
      if (this._ac || !/audiocheck/.test(location.hash)) return;
      const el = this._ac = document.createElement('pre');
      el.style.cssText = 'position:fixed;left:8px;top:40px;z-index:99;margin:0;padding:6px 8px;font:12px/1.4 monospace;background:rgba(255,255,255,.85);color:#111;pointer-events:none';
      document.body.appendChild(el);
      setInterval(() => {
        const a = this.audio, seen = new Set(); let t = '';
        for (const [k, sl] of Object.entries(a.slots)) { if (seen.has(sl)) continue; seen.add(sl); t += `${k.padEnd(7)} ${sl.state}${sl.buf ? ' ' + sl.buf.duration.toFixed(1) + 's' : ''}${sl.shift ? ' shift ' + (sl.shift * 1000).toFixed(1) + 'ms' : ''}\n`; }
        t += `song ${a.songName || '-'} ${a.curSeg ? a.curSeg.slot + ':' + a.curSeg.mode : ''}`;
        el.textContent = t;
      }, 500);
    };
    audioCheck(); window.addEventListener('hashchange', audioCheck); setTimeout(audioCheck, 1500); setTimeout(audioCheck, 4000);
    this.audio.onTrackReady = k => {
      // the title started on the synthesized fallback: hand over to the recording as soon as it is ready
      const a = this.audio;
      if (this.state === 'title' && a.songName === 'title' && a.curSeg && a.curSeg.mode === 'proc' && a.slots[k] === a.slots.calm) a.playSong('title', 0.4);
    };
    this.state = 'loading';
    this.time = 0; this.s = 260; this.speedMul = 1;
    this.FC = Rail.makeFrame(); this.FT = Rail.makeFrame(); this.FS = Rail.makeFrame();
    this.C = {
      camPos: new THREE.Vector3(), F: new THREE.Vector3(), R: new THREE.Vector3(), U: new THREE.Vector3(), camVel: new THREE.Vector3(),
      camFwd: new THREE.Vector3(), kx: 1, ky: 1, ds: 1, camera: this.camera, W: this.W, H: this.H, pxUnit: 600, time: 0, playerN: new THREE.Vector3(), aspect: 1,
    };
    this.prevCam = new THREE.Vector3();
    this.rx = this.W / 2; this.ry = this.H * 0.42; this.prx = this.rx; this.pry = this.ry; this.aimX = 0; this.aimY = 0; this.prevAimX = 0;
    // every finger, the held mouse button and each brush key is its own brush
    this.ptrs = new Map(); this.contactSeq = 0; this.holding = false; this.trailUse = [null, null];
    this.mx = null; this.my = null; this.lastInput = isTouch ? 'touch' : 'mouse';
    this.calib = clamp(+store.get('swordsong.calib', 0) || 0, -0.03, 0.09);
    this.queue = []; this.shots = []; this.resv = []; this.timers = [];
    this.shakeAmt = 0; this.shakeV = new THREE.Vector3(); this.timeScale = 1; this.tsTarget = 1;
    this.fovKick = 0; this.damageFx = 0; this.flashFx = 0; this.wipe = 0;
    this.best = store.get('swordsong.best', 0);
    this.muted = store.get('swordsong.muted', false);
    this.learned = store.get('swordsong.learned', false);
    this.stats = { j3: 0, j2: 0, j1: 0, miss: 0, killed: 0, damage: 0 }; this.score = 0; this.hp = 5; this.combo = 0; this.maxCombo = 0;
    this.skills = {}; this.noteBase = 0; this.noteBeat = 0; this.pendingSong = null; this.tutor = null;
    this.frameTimes = []; this.upgraded = false;
    this._v = new THREE.Vector3(); this._w = new THREE.Vector3(); this._m = new THREE.Matrix4();
  }
  get aspect() { return this.C.aspect; }

  async boot() {
    this.resize();
    try {
      if (document.fonts && document.fonts.load) {
        await Promise.race([
          Promise.all([
            document.fonts.load('48px "Ma Shan Zheng"', '剑歌行启程再战归去暂停继续重来云海青绿灯海龙渊敕令镇邪幽冥鬼魂煞封御神绝妙良凡好失连一气呵成万积水成蛟生焉战于野其血玄黄飞在天利见大人从风虎潜勿用或跃未渡来日'),
            document.fonts.load('600 30px "Cormorant Garamond"', '0123456789'),
            document.fonts.load('16px "Noto Serif SC"', '一剑一音万剑成歌最高全屏得分最大连击准度'),
          ]),
          new Promise(r => setTimeout(r, 2600)),
        ]);
      }
    } catch (e) { /* ignore */ }
    this.world = new World(this.scene);
    this.fx = new FX(this.scene);
    this.player = new Player(this.scene, this.fx);
    this.enemies = new Enemies(this.scene, this.fx);
    this.boss = new Boss(this.scene, this);
    this.level = new Level(this);
    this.initShots();
    this.decorateUI();
    this.bindInput();
    this.updateCamera(0);
    this.world.reset(this.s - SWORD_DEPTH, 0);
    await this.prewarm();
    this.toTitle(true);
    $('loading').classList.add('out');
    setTimeout(() => $('loading').remove(), 1200);
    this.last = performance.now();
    requestAnimationFrame(t => this.frame(t));
    window.__game = this;
    window.__ready = true;
  }

  async prewarm() {
    const kinds = ['talisman', 'fish', 'lantern', 'disc', 'orb', 'head', 'jade', 'soul', 'wisp', 'seal'];
    const tmp = kinds.map((k, i) => this.enemies.spawn(k, (t, o) => { o.set((i - 5) * 0.15, 0.3, 60); return true; }));
    this.boss.kun.visible = true; this.boss.heart.visible = true;
    for (const s of this.shots) s.m.visible = true;
    this.enemies.update(0.016, this.C, this);
    try {
      if (this.renderer.compileAsync) await Promise.race([this.renderer.compileAsync(this.scene, this.camera), new Promise(r => setTimeout(r, 4000))]);
      else this.renderer.compile(this.scene, this.camera);
    } catch (e) { /* ignore */ }
    this.post.render(0.016);
    for (const e of tmp) this.enemies.remove(e);
    this.enemies.list = [];
    this.boss.kun.visible = false; this.boss.heart.visible = false;
    for (const s of this.shots) s.m.visible = false;
  }

  decorateUI() {
    drawSeal($('seal'), '御剑', { seed: 3 });
    const stroke = brushStrokeURL(440, 150, 5);
    document.querySelectorAll('.brush-btn').forEach(b => { b.style.backgroundImage = `url(${stroke})`; });
    $('t-best').textContent = this.best.toLocaleString('en-US');
    this.setMuteIcon();
  }
  setMuteIcon() {
    const b = $('btn-sound');
    b.querySelector('.wave').style.display = this.muted ? 'none' : '';
    b.querySelector('.mute').style.display = this.muted ? '' : 'none';
    b.setAttribute('aria-label', this.muted ? '开启声音' : '关闭声音');
  }

  // ------------------------------------------------------------------ input: the finger is the brush
  bindInput() {
    const cv = this.canvas;
    const lagOf = e => { const lag = (performance.now() - e.timeStamp) / 1000; return lag > 0 && lag < 2 ? lag : 0; };
    const pos = e => [clamp(e.clientX, 0, this.W), clamp(e.clientY, 0, this.H)];
    const trailPts = (id, e) => {
      const p = this.ptrs.get(id); if (!p || p.trail < 0) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
      if (evs && evs.length) for (const c of evs) this.hud.trails[p.trail].add(clamp(c.clientX, 0, this.W), this.H - clamp(c.clientY, 0, this.H), this.time);
    };
    const onDown = e => {
      if (this.state === 'title') { this.ensureAudio(); return; }
      if (this.state !== 'play') return;
      this.lastInput = e.pointerType === 'mouse' ? 'mouse' : 'touch';
      if (e.pointerType === 'mouse' && e.button === 2) { this.triggerOD(); e.preventDefault(); return; }
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const [x, y] = pos(e);
      if (e.pointerType === 'mouse') { this.mx = x; this.my = y; }
      this.ptrDown('p' + e.pointerId, x, y, lagOf(e), e.pointerType === 'touch' ? 'touch' : 'mouse');
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
    };
    const onMove = e => {
      if (this.state !== 'play') return;
      const [x, y] = pos(e);
      if (e.pointerType === 'mouse') {
        this.mx = x; this.my = y; this.lastInput = 'mouse';
        if (!this.ptrs.size) { this.rx = x; this.ry = y; }
        // brush keys ride the mouse: hold Z and sweep
        for (const p of this.ptrs.values()) if (p.kind === 'key') { trailPts(p.id, e); this.ptrMove(p.id, x, y); }
      }
      const id = 'p' + e.pointerId;
      if (!this.ptrs.has(id)) return;
      trailPts(id, e); this.ptrMove(id, x, y);
      e.preventDefault();
    };
    const onUp = e => this.ptrUp('p' + e.pointerId);
    cv.addEventListener('pointerdown', onDown, { passive: false });
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    // a key released while the window is unfocused never reports its keyup
    window.addEventListener('blur', () => { for (const p of [...this.ptrs.values()]) if (p.kind === 'key') this.ptrDrop(p); });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('touchmove', e => { if (e.target === cv) e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturestart', e => e.preventDefault());
    const BRUSH_KEYS = new Set(['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyA', 'KeyS', 'KeyD', 'KeyF']);
    window.addEventListener('keyup', e => { if (BRUSH_KEYS.has(e.code)) this.ptrUp('k' + e.code); });
    window.addEventListener('keydown', e => {
      if (BRUSH_KEYS.has(e.code) && this.state === 'play') {
        e.preventDefault(); if (e.repeat) return;
        this.lastInput = 'mouse';
        const x = this.mx ?? this.W / 2, y = this.my ?? this.H * 0.45;
        this.ptrDown('k' + e.code, x, y, lagOf(e), 'key');
        return;
      }
      if (e.code === 'Space') { e.preventDefault(); if (this.state === 'play') this.triggerOD(); }
      if (e.code === 'Escape' || e.code === 'KeyP') { if (this.state === 'play') this.pause(); else if (this.state === 'paused') this.resume(); }
      if (e.code === 'Enter' && this.state === 'title') this.startGame();
    });
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (this.state === 'play') this.pause(); else this.audio.suspend(); }
      else if (this.state !== 'paused') this.audio.resume();
    });
    $('btn-start').addEventListener('click', () => this.startGame());
    $('title').addEventListener('pointerdown', () => this.ensureAudio());
    $('title').addEventListener('touchend', () => this.ensureAudio());
    $('btn-sound').addEventListener('click', () => {
      this.muted = !this.muted; store.set('swordsong.muted', this.muted); this.setMuteIcon();
      this.ensureAudio(); this.audio.setMuted(this.muted);
    });
    const de = document.documentElement;
    const fsFn = de.requestFullscreen || de.webkitRequestFullscreen;
    if (!fsFn) $('btn-full').classList.add('hidden');
    $('btn-full').addEventListener('click', () => {
      try {
        if (!(document.fullscreenElement || document.webkitFullscreenElement)) { const r = fsFn.call(de); if (r && r.catch) r.catch(() => {}); }
        else { const ex = document.exitFullscreen || document.webkitExitFullscreen; const r = ex && ex.call(document); if (r && r.catch) r.catch(() => {}); }
      } catch (e) { /* ignore */ }
    });
    $('btn-pause').addEventListener('click', () => this.pause());
    $('btn-resume').addEventListener('click', () => this.resume());
    $('btn-restart').addEventListener('click', () => this.startGame());
    $('btn-quit').addEventListener('click', () => this.toTitle());
    $('btn-retry').addEventListener('click', () => this.startGame());
    $('btn-home').addEventListener('click', () => this.toTitle());
    $('btn-od').addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); this.triggerOD(); });
  }

  ensureAudio() {
    const fresh = !this.audio.ctx;
    this.audio.init();
    this.audio.setMuted(this.muted);
    if (fresh && this.state === 'title') this.audio.playSong('title', 0.15);
  }

  // ------------------------------------------------------------------ flow
  setState(s) { this.state = s; document.body.classList.toggle('playing', s === 'play'); }
  toTitle(first) {
    this.setState('title');
    this.hideScreens();
    $('title').classList.remove('hidden', 'fade');
    this.hud.showDom(false); this.hud.setVisible(false); this.hud.clearFx();
    this.player.setVisible(true);
    this.enemies.clear(); this.boss.hide(); this.clearShots(); this.queue = []; this.tutor = null; this.pendingSong = null;
    this.palette.set('dawn', first ? 0.01 : 3);
    document.body.classList.remove('night');
    this.post.u.uSat.value = 1; this.timeScale = this.tsTarget = 1;
    $('t-best').textContent = this.best.toLocaleString('en-US');
    if (!first && this.audio.ctx) this.audio.playSong('title', 0.3);
    this.wipeTo(0, 0.8);
  }
  hideScreens() {
    for (const id of ['title', 'pause', 'results']) $(id).classList.add('hidden');
    $('veil').classList.add('fade');
  }
  startGame() {
    if (this.starting) return;
    this.starting = true;
    this.ensureAudio();
    this.audio.ui();
    if (this.state === 'paused') this.audio.resume();
    this.wipeTo(1, 0.55, () => {
      this.hideScreens();
      this.resetRun();
      Board.start();   // a new round on the AIWANNA leaderboards (only inside the platform's player)
      this.setState('play');
      this.hud.showDom(true); this.hud.setVisible(true); this.hud.dim(false);
      this.wipeTo(0, 0.9);
      this.starting = false;
      this.audio.ready(this.learned ? 'stage1' : 'tutor', 3500).then(() => {
        if (this.state !== 'play') return;
        if (this.learned) this.audio.playSong('game', 0.25);
        else this.startTutorial();
      });
    });
  }
  resetRun() {
    this.enemies.clear(); this.boss.hide(); this.clearShots(); this.fx.clear(); this.hud.clearFx();
    this.queue = []; this.player.reset(); this.tutor = null; this.pendingSong = null; this.resv = []; this.timers = [];
    this.score = 0; this.hp = 5; this.invuln = 0; this.od = 0; this.odActive = false; this.odTime = 0; this.odRevealed = false;
    this.combo = 0; this.maxCombo = 0; this.skills = {}; this.everTouched = false;
    this.stats = { j3: 0, j2: 0, j1: 0, miss: 0, killed: 0, damage: 0 };
    this.bar = -1; this.stage = 0; this.victory = false; this.timeScale = this.tsTarget = 1;
    this.hud.setScore(0, true); this.hud.setLife(5); this.hud.setOD(0, false, false); this.hud.setBoss(null); this.hud.setStage(STAGES[0].name, 0); this.hud.setCombo(0);
    this.palette.set('dawn', 2);
    document.body.classList.remove('night');
    this.post.u.uSat.value = 1; this.post.u.uDamage.value = 0; this.post.u.uOD.value = 0;
    this.rx = this.W / 2; this.ry = this.H * 0.42; this.ptrClear();
    this.level.reset();
  }
  pause() {
    if (this.state !== 'play') return;
    this.setState('paused'); this.audio.suspend();
    this.ptrClear();
    $('veil').classList.remove('fade'); $('pause').classList.remove('hidden');
  }
  resume() {
    if (this.state !== 'paused') return;
    this.audio.resume(); this.setState('play'); this.lastHeard = undefined;
    $('veil').classList.add('fade'); $('pause').classList.add('hidden');
    this.last = performance.now();
  }
  wipeTo(v, dur, cb) { this.wipeFrom = this.wipe; this.wipeTarget = v; this.wipeDur = dur; this.wipeT = 0; this.wipeCb = cb; }

  stageCard(i) {
    const st = STAGES[i]; this.stage = i;
    this.hud.card(st); this.hud.setStage(st.name);
    this.palette.set(st.key, i === 0 ? 2 : 7);
    this.audio.card();
    setTimeout(() => document.body.classList.toggle('night', st.key === 'dusk' || st.key === 'night'), i === 0 ? 0 : 3000);
  }
  preBoss() {
    this.palette.set('night', 8); this.stage = 3;
    this.hud.poem(['积水成渊', '蛟龙生焉'], 6); this.hud.setStage('龙渊');
    setTimeout(() => document.body.classList.add('night'), 2500);
  }
  startBoss() {
    this.boss.start(); this.hud.setBoss(1);
    this.audio.decodeSlot('ending');   // ready for the moment the dragon is freed
    this.audio.longyin(this.audio.now() + 0.2, 0.14);
    this.audio.gong(this.audio.now() + 0.05, 0.5, { f: 70, dur: 6 });
  }
  onBossDefeated() {
    if (this.victory) return;
    this.victory = true; this.setState('ending'); this.endT = 0;
    this.tsTarget = 0.22; this.timeScale = 0.22;
    this.flashFx = 1; this.shake(2.2);
    this.audio.boom(1);
    this.fx.glow.burst(this.boss.heart.position, 120, 60, [3, 1.2, 0.5], 3, 2.4, { drag: 1.4 });
    this.fx.ink.burst(this.boss.heart.position, 22, 50, 6, 30, 0.85, 2.5);
    this.queue = []; this.player.reset(); this.ptrClear();
    for (const e of this.enemies.list) if (e.alive && !e.boss) { e.alive = false; e.dying = true; e.dt = 0; e.dieDur = 0.8; }
    this.hud.setVisible(false); this.hud.dim(true); this.hud.setBoss(null);
    this.audio.stopSong();
    setTimeout(() => { if (this.state === 'ending') this.audio.playSong('ending', 0.1); }, 1400);
    this.palette.set('gold', 8);
    setTimeout(() => document.body.classList.remove('night'), 4000);
  }
  gameOver() {
    this.setState('dead'); this.deadT = 0;
    this.tsTarget = 0.3; this.audio.stopSong();
    this.audio.boom(0.7);
    setTimeout(() => this.audio.playSong('fail', 0.1), 900);
    this.queue = []; this.player.reset(); this.ptrClear();
    this.hud.setVisible(false); this.hud.dim(true);
  }
  accuracy() {
    const s = this.stats, n = s.j3 + s.j2 + s.j1 + s.miss;
    return n ? (s.j3 + 0.75 * s.j2 + 0.4 * s.j1) / n : 0;
  }
  showResults() {
    this.setState('results');
    this.hud.showDom(false); this.hud.dim(false);
    const st = this.stats, acc = this.accuracy();
    if (this.victory) Board.finish(acc, this.maxCombo); else Board.drop();
    let rank;
    if (this.victory) rank = acc >= 0.93 && st.miss <= 3 ? '神' : acc >= 0.85 ? '绝' : acc >= 0.72 ? '妙' : acc >= 0.55 ? '良' : '凡';
    else rank = acc >= 0.7 ? '良' : '凡';
    $('r-title').textContent = this.victory ? '剑歌已成' : '剑折';
    $('r-sub').textContent = this.victory ? '飞龙在天 · 云从龙' : (this.stage >= 3 ? '龙渊未渡 · 来日再战' : `止步于「${STAGES[this.stage].name}」`);
    const newBest = this.score > this.best;
    if (newBest) { this.best = this.score; store.set('swordsong.best', this.best); }
    store.set('swordsong.calib', +this.calib.toFixed(3));
    $('r-best').textContent = newBest && this.score > 0 ? '新纪录' : `最高　${this.best.toLocaleString('en-US')}`;
    $('r-score').textContent = this.score.toLocaleString('en-US');
    $('r-combo').textContent = String(this.maxCombo);
    $('r-acc').textContent = `${(acc * 100).toFixed(1)}%`;
    $('r-judge').textContent = `${st.j3} · ${st.j2} · ${st.j1} · ${st.miss}`;
    const rows = Array.from($('r-stats').children);
    rows.forEach(r => r.classList.remove('in'));
    $('veil').classList.remove('fade'); $('results').classList.remove('hidden', 'fade');
    const seal = $('r-seal'); seal.classList.remove('go'); drawSeal(seal, rank, { seed: rank.charCodeAt(0) });
    rows.forEach((r, i) => setTimeout(() => r.classList.add('in'), 250 + i * 160));
    setTimeout(() => { void seal.offsetWidth; seal.classList.add('go'); this.audio.stamp(); vibrate(30); }, 1050);
  }

  // ------------------------------------------------------------------ the wordless lesson
  // Each gate teaches exactly one thing and waits until the player has done it.
  hoverPath(x, y, d, ph = 0) {
    return (t, out) => { const a = Math.min(1, t / 2.2), e = 1 - Math.pow(1 - a, 3); out.set(x + Math.sin(t * 0.7 + ph) * 0.035, y + Math.sin(t * 1.1 + ph) * 0.025 + (1 - e) * 0.6, d + (1 - e) * 150); return true; };
  }
  startTutorial() {
    this.tutor = { step: 0, t: 0, ents: [], misses: 0, demo: false };
    this.audio.decodeSlot('stage1');
    this.audio.playSong('tutor', 0.3);
    this.stageCard(0);
  }
  tutAlive() { return this.tutor.ents.some(e => e.alive); }
  updateTutorial(dt) {
    const T = this.tutor; if (!T) return;
    T.t += dt;
    const now = this.audio.heard();
    switch (T.step) {
      case 0: // one spirit, one ring, one touch
        if (T.t > 1.6) {
          const bt = this.audio.nextBarTime(2.6 * BEAT / 0.5);
          T.ents = [this.spawn('talisman', this.hoverPath(0, 0.14, 38), { nt: [bt], pitch: [0], mark: true, scale: 1.15 })];
          T.step = 1; T.t = 0;
        }
        break;
      case 1: {
        if (!this.tutAlive()) { T.step = 2; T.t = 0; break; }
        const e = T.ents[0];
        if (!this.everTouched && T.misses >= 2 && !T.demo && e.nt && e.ni < e.nt.length) {
          const Tn = e.nt[e.ni], lead = Tn - now;
          if (lead < 1.3 && lead > 1.0) {
            T.demo = true;
            const x0 = this.W * 0.5, y0 = this.H * 0.86;
            this.hud.ghost([[x0, y0], [x0 + (e.sx - x0) * 0.35, (y0 + e.sy) / 2 + 20], [e.sx, e.sy + 10], [e.sx, e.sy]], lead - 0.02,
              [e.sx, e.sy, Math.max(58, e.sr * 2.4)], () => { if (e.alive && e.nt && e.ni < e.nt.length) this.strike(e, 3); });
          }
        }
        break;
      }
      case 2: // three on the beat: one, two, three
        if (T.t > 0.5) {
          const bt = this.audio.nextBarTime(2.6 * BEAT / 0.5);
          T.ents = [-0.42, 0, 0.42].map((x, i) => this.spawn('talisman', this.hoverPath(x, 0.27 + (i === 1 ? 0.05 : 0), 46, i), { nt: [bt + i * BEAT], pitch: [i * 2] }));
          T.step = 3; T.t = 0;
        }
        break;
      case 3: if (!this.tutAlive()) { T.step = 4; T.t = 0; } break;
      case 4: // a ring: draw it in eighths
        if (T.t > 0.5) {
          const bt = this.audio.nextBarTime(2.8 * BEAT / 0.5), asp = this.aspect;
          const ry = Math.max(0.3, Math.min(0.5, 0.75 * asp)), rx = Math.min(0.72, 0.5 / Math.max(asp, 0.5) * 0.9 + 0.2);
          const arp = [0, 2, 4, 5, 7, 5, 4, 2];
          T.ents = [];
          for (let i = 0; i < 8; i++) {
            const a0 = Math.PI / 2 - i / 8 * Math.PI * 2;
            T.ents.push(this.spawn('talisman', (t, out) => { const a = Math.min(1, t / 2.4), e = 1 - Math.pow(1 - a, 3); out.set(Math.cos(a0) * rx * (0.3 + 0.7 * e), Math.sin(a0) * ry * (0.3 + 0.7 * e) + 0.2, 58 + (1 - e) * 150); return true; },
              { nt: [bt + i * BEAT * 0.5], pitch: [arp[i]] }));
          }
          T.step = 5; T.t = 0;
        }
        break;
      case 5: if (!this.tutAlive()) { T.step = 6; T.t = 0; } break;
      case 6: // a lantern: keep the brush on it; then it answers with fire
        if (T.t > 0.5) {
          const bt = this.audio.nextBarTime(2.8 * BEAT / 0.5);
          const e = this.spawn('lantern', (t, out) => { const a = Math.min(1, t / 2.4), k = 1 - Math.pow(1 - a, 3); out.set(0.28, -1.7 + (0.34 + 1.7) * k + Math.sin(t) * 0.02, 52); return true; },
            { nt: [bt + BEAT, bt + 2 * BEAT], pitch: [0, 4], chain: this.chain() });
          T.ents = [e]; T.wispAt = bt + 2.5 * BEAT; T.wisped = false; T.lan = e;
          T.step = 7; T.t = 0;
        }
        break;
      case 7:
        if (!T.wisped && now >= T.wispAt) {
          const src = this.worldToNorm(T.lan.pos);
          const w = this.spawnWisp(src.x, src.y, src.z, 4.6, 3, true, null, 3);
          if (w) { T.wisped = true; T.ents.push(w); } else T.wispAt = now + BEAT;
        }
        if (T.wisped && !this.tutAlive()) { T.step = 8; T.t = 0; }
        break;
      case 8: // the sword soul: its light flies to the button that unleashes it
        if (T.t > 0.6) {
          const bt = this.audio.nextBarTime(2.6 * BEAT / 0.5);
          T.ents = [this.spawn('soul', this.hoverPath(0, 0.1, 40), { nt: [bt], pitch: [9] })];
          T.step = 9; T.t = 0;
        }
        break;
      case 9: if (!this.tutAlive()) { T.step = 10; T.t = 0; } break;
      case 10: // a school to unleash it on
        if (T.t > 1.2) {
          this.noteBeat = Math.floor(this.audio.beatAt(now)); this.noteBase = this.audio.beatTime(this.noteBeat);
          const n0 = this.enemies.list.length;
          W.fishSchool(this, 8, 1, 0.22, 52, 7.5, {}, 1);
          T.ents = this.enemies.list.slice(n0);
          T.step = 11; T.t = 0;
        }
        break;
      case 11: if (T.t > 1.5 && !this.tutAlive()) this.finishTutorial(); break;
    }
  }
  finishTutorial() {
    this.tutor = null; this.learned = true; store.set('swordsong.learned', true); store.set('swordsong.calib', +this.calib.toFixed(3));
    this.bar = 2;
    // the first stage's recording should be decoded by now; give it a moment if not
    this.audio.ready('stage1', 2500).then(() => {
      if (this.state !== 'play' && this.state !== 'paused') return;
      this.pendingSong = { at: this.audio.nextBarTime(0.5), name: 'game', bar: 3 };
    });
  }

  // ------------------------------------------------------------------ notes & strikes
  tk() { return this.audio.beatLenAt(this.noteBase) / 0.5; }
  nb(beats) { return this.audio.beatTime(this.noteBeat + Math.round(beats * 2) / 2); }
  phrase(total) { return { total, done: 0, good: 0, miss: false }; }
  chain() { return { contact: -1 }; }
  judge(d) { const a = Math.abs(d); return a <= PERFECT ? 3 : a <= GREAT ? 2 : 1; }
  pan(sx) { return clamp((sx / this.W) * 2 - 1, -1, 1) * 0.6; }

  // ---- brushes
  ptrDown(id, x, y, lag = 0, kind = 'touch') {
    if (this.ptrs.has(id)) return;
    const p = { id, x, y, px: x, py: y, kind, fresh: true, up: false, at: this.audio.heard() - lag, inside: new Set(), trail: this.trailUse.indexOf(null) };
    if (p.trail >= 0) { this.trailUse[p.trail] = id; const tr = this.hud.trails[p.trail]; tr.clear(); tr.add(x, this.H - y, this.time); }
    this.ptrs.set(id, p);
    this.rx = x; this.ry = y; this.holding = true; this.everTouched = true;
  }
  ptrMove(id, x, y) {
    const p = this.ptrs.get(id); if (!p) return;
    p.x = x; p.y = y; this.rx = x; this.ry = y;
    if (p.trail >= 0) this.hud.trails[p.trail].add(x, this.H - y, this.time);
  }
  // a tap shorter than a frame is still judged: the brush lifts after its first frame
  ptrUp(id) { const p = this.ptrs.get(id); if (!p) return; if (p.fresh) p.up = true; else this.ptrDrop(p); }
  ptrDrop(p) {
    this.ptrs.delete(p.id);
    if (p.trail >= 0 && this.trailUse[p.trail] === p.id) this.trailUse[p.trail] = null;
    this.holding = this.ptrs.size > 0;
  }
  ptrClear() { for (const p of [...this.ptrs.values()]) this.ptrDrop(p); this.holding = false; }
  reach(p, e) { return (p.kind === 'touch' ? 50 : 40) + Math.min(e.sr * 0.8, 70); }
  brushOn(e) {
    for (const p of this.ptrs.values()) { const r = this.reach(p, e); if ((p.x - e.sx) ** 2 + (p.y - e.sy) ** 2 <= r * r) return true; }
    return false;
  }

  // The brush rules, the same for finger, mouse and keys:
  //  * touching a spirit on its beat strikes it at once, judged by timing;
  //  * touching it early seals it (印): it is struck on its beat, 绝 if a brush is on it then, 妙 if not;
  //  * whatever a brush rests on when its beat arrives is struck (绝).
  updateHits() {
    const now = this.audio.heard();
    const list = this.enemies.list;
    const lateBy = LATE + Math.max(0, this.calib);
    for (const p of this.ptrs.values()) {
      let best = null, bestD = 1e9;
      for (const e of list) {
        if (!e.alive || !e.onScreen || !e.lockable || !e.nt || e.ni >= e.nt.length) continue;
        const r = this.reach(p, e);
        if (segD2(e.sx, e.sy, p.px, p.py, p.x, p.y) > r * r) { p.inside.delete(e.id); continue; }
        if (p.inside.has(e.id)) continue;
        p.inside.add(e.id);
        if (p.fresh) { const d = Math.abs(p.at - e.nt[e.ni]); if (d < bestD) { bestD = d; best = e; } }   // a tap picks one spirit
        else this.contact(e, now, false);   // a stroke takes everything it crosses
      }
      if (best) this.contact(best, Math.min(now, p.at), true);
      p.fresh = false; p.px = p.x; p.py = p.y;
      if (p.up) this.ptrDrop(p);
    }
    // on the beat (a hair early, so the struck note sounds exactly with the music)
    const lead = Math.min(0.1, this.audio.latency()) + 0.025;
    for (const e of list) {
      if (!e.alive || !e.nt || e.ni >= e.nt.length) continue;
      const T = e.nt[e.ni];
      if (this.odActive && e.onScreen && e.lockable && (T - now <= lead || (e.projectile && T - now <= OPEN))) { this.strike(e, 3, true, T); continue; }
      if (T - now > lead) continue;
      const on = e.onScreen && e.lockable && this.ptrs.size > 0 && this.brushOn(e);
      if (on || e.sealTo > e.ni) this.strike(e, on ? 3 : 2, false, T);
    }
    // misses last, so a touch that landed in time is credited even when its frame arrives late
    for (const e of list) {
      if (!e.alive || !e.nt || e.ni >= e.nt.length || e.noMiss) continue;
      if (now > e.nt[e.ni] + lateBy) this.noteMiss(e);
    }
  }
  contact(e, tc, fresh) {
    const T = e.nt[e.ni], err = tc - T;
    if (fresh && Math.abs(err) < GREAT) {
      // quietly learn the player's habitual offset (touch latency, Bluetooth audio) and centre the window on it
      this.calib = clamp(this.calib + (err - this.calib) * 0.06, -0.03, 0.09);
      if (window.__errLog) window.__errLog.push(+err.toFixed(3));
    }
    const d = fresh ? err - this.calib : err;
    if (d < -PERFECT) { this.seal(e); return; }
    if (d > LATE + Math.max(0, this.calib) && !e.noMiss) return;
    this.strike(e, this.judge(d));
    if (e.alive && e.ni < e.nt.length) e.sealTo = e.nt.length;   // the rest of this spirit's notes are already ours
  }
  seal(e) {
    if (e.sealTo >= e.nt.length) return;
    e.sealTo = e.nt.length;
    this.audio.seal(this.pan(e.sx), e.sealN = (this.sealN = (this.sealN || 0) + 1));
    this.hud.stamp(e, 2, 0.62);
    // the brush bites at once (a nick and a splash of ink); the sword finishes it on the beat
    if (e.pos) { this.fx.flash.slash(e.pos, 2.2 + Math.random() * 0.8, [0.9, 0.42, 0.2]); this.fx.ink.burst(e.pos, 3, 2, 1, 3, 0.4, 0.8); }
    if (e.mat && e.mat.uniforms.uHit) e.mat.uniforms.uHit.value = Math.max(e.mat.uniforms.uHit.value, 0.45);
    if (e.kind === 'heart') this.boss.heartU.uHit.value = 0.45;
  }

  strike(e, j, auto = false, when = 0) {
    const k = e.ni; e.ni++;
    if (e.ni >= e.nt.length && !e.boss) e.lockable = false;
    e.pending++;
    const pitch = e.pitch[Math.min(k, e.pitch.length - 1)] ?? 0;
    const pan = this.pan(e.sx);
    this.audio.key(pitch, j, pan, when);
    const slot = this.player.takeSlot(e);
    const at = this.audio.nextStepTime(0.004);
    this.queue.push({ at, slot, e, j });
    this.audio.launch(at, k, pan);
    if (j === 3) this.stats.j3++; else if (j === 2) this.stats.j2++; else this.stats.j1++;
    if (j >= 2) {
      this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.hud.setCombo(this.combo, 'bump');
      if (this.combo % 40 === 0 && this.od < 3 && !this.tutor) {
        const [cx, cy] = this.hud.center($('combo'));
        this.hud.fly(cx, cy, $('btn-od'), '#ffd27a', 12, () => this.gainOD(1));
      }
    }
    const cm = 1 + Math.min(this.combo, 100) / 50;
    const base = (e.score || 100) / Math.max(1, e.maxHp);
    this.score += Math.round(base * JF[j] * cm); this.hud.setScore(this.score);
    this.hud.stamp(e, j);
    this.hud.judge(e.sx, e.sy - Math.min(90, e.sr + 24), j);
    if (e.mat && e.mat.uniforms.uHit) e.mat.uniforms.uHit.value = 0.8;
    if (e.kind === 'heart') this.boss.heartU.uHit.value = 0.8;
    if (j === 3) vibrate(8);
    const ph = e.phrase;
    if (ph) {
      ph.done++; if (j >= 2) ph.good++;
      if (ph.done === ph.total && ph.good === ph.total && !ph.miss && ph.total >= 3) {
        this.hud.bonus('一气呵成');
        this.audio.bonus();
        this.score += Math.round(60 * ph.total * cm); this.hud.setScore(this.score);
        this.flashFx = Math.max(this.flashFx, 0.1);
      }
    }
    this.skills.hit = true;
  }
  noteMiss(e) {
    if (e.boss) { e.nt = []; e.ni = 0; if (e.onScreen) this.breakCombo(e); return; }
    if (this.tutor) {
      for (let i = e.ni; i < e.nt.length; i++) { e.nt[i] += BAR; this.resv.push(e.nt[i]); }
      this.tutor.misses++; this.hud.stamp(e, 0); this.audio.miss();
      return;
    }
    this.stats.miss += e.nt.length - e.ni;
    if (e.phrase) e.phrase.miss = true;
    e.ni = e.nt.length;
    this.breakCombo(e);
    if (e.pending <= 0) this.enemies.flee(e); else e.lockable = false;
  }
  breakCombo(e) {
    if (e) this.hud.stamp(e, 0);
    this.audio.miss();
    if (this.combo >= 5) this.hud.setCombo(0, 'break'); else this.hud.setCombo(0);
    this.combo = 0;
  }

  // ------------------------------------------------------------------ swords in flight
  initShots() {
    const geo = smallSwordGeometry();
    for (let i = 0; i < 34; i++) {
      const m = new THREE.Mesh(geo, smallSwordMaterial());
      m.material.uniforms.uHot.value = 1; m.visible = false; m.frustumCulled = false; m.renderOrder = 3;
      this.scene.add(m);
      const pts = []; for (let k = 0; k < 14; k++) pts.push(new THREE.Vector3());
      const id = this.fx.trails.alloc(); const iid = this.fx.inkTrails.alloc();
      this.shots.push({ m, pts, id, iid, active: false, fade: 0, t: 0, dur: 0.4, p0: new THREE.Vector3(), p1: new THREE.Vector3(), p2: new THREE.Vector3(), end: new THREE.Vector3(), pos: new THREE.Vector3(), target: null, j: 2, alpha: 1 });
    }
  }
  clearShots() {
    for (const s of this.shots) { s.active = false; s.fade = 0; s.m.visible = false; this.fx.trails.set(s.id, s.pts, 0); if (s.iid >= 0) this.fx.inkTrails.set(s.iid, s.pts, 0); }
  }
  launchShot(from, target, j, fromSky) {
    const s = this.shots.find(x => !x.active && x.fade <= 0);
    if (!s) { this.applyHit(target, j, target.pos); return; }
    const C = this.C;
    s.active = true; s.t = 0; s.target = target; s.j = j; s.alpha = 1;
    s.p0.copy(from);
    if (fromSky) s.p1.copy(from).addScaledVector(C.F, 30).addScaledVector(C.U, 6);
    else {
      this._v.subVectors(from, this.player.center); if (this._v.lengthSq() < 1e-4) this._v.copy(C.U); this._v.normalize();
      s.p1.copy(from).addScaledVector(this._v, 5 + Math.random() * 3).addScaledVector(C.F, 7).addScaledVector(C.U, 1.5);
    }
    s.end.copy(target.pos);
    s.dur = (fromSky ? 0.42 : 0.26) + from.distanceTo(target.pos) * 0.0024;
    for (const p of s.pts) p.copy(from);
    s.m.visible = true; s.m.position.copy(from);
    const hot = j === 3 ? [2.4, 1.5, 0.45, 1] : [1.7, 1.05, 0.34, 1];
    this.fx.trails.set(s.id, s.pts, s.pts.length, u => 0.24 * Math.pow(1 - u, 0.7) + 0.02, hot, u => (1 - u) * s.alpha);
    if (s.iid >= 0) this.fx.inkTrails.set(s.iid, s.pts, s.pts.length, u => 0.55 * Math.pow(1 - u, 0.5) + 0.06, [1, 1, 1, 0.7], u => Math.min(1, (1 - u) * 1.8) * s.alpha);
  }
  bez(s, k, out) {
    const a = 1 - k;
    return out.set(0, 0, 0).addScaledVector(s.p0, a * a * a).addScaledVector(s.p1, 3 * a * a * k).addScaledVector(s.p2, 3 * a * k * k).addScaledVector(s.end, k * k * k);
  }
  updateShots(dt) {
    const e1 = this._v, d1 = this._w;
    const TR = 0.11;
    for (const s of this.shots) {
      if (s.active) {
        if (s.target && (s.target.alive || s.target.dying)) s.end.copy(s.target.pos);
        s.t += dt / s.dur;
        const k = Math.min(1, s.t);
        s.p2.copy(s.end).lerp(s.p1, 0.28);
        this.bez(s, k, e1);
        this.bez(s, Math.max(0, k - 0.02), d1);
        d1.subVectors(e1, d1);
        s.pos.copy(e1); s.m.position.copy(e1);
        if (d1.lengthSq() > 1e-8) { this._m.lookAt(d1.add(e1), e1, this.C.U); s.m.quaternion.setFromRotationMatrix(this._m); }
        const dk = TR / s.dur / (s.pts.length - 1);
        for (let i = 0; i < s.pts.length; i++) this.bez(s, Math.max(0, k - i * dk), s.pts[i]);
        if (k >= 1) this.shotHit(s);
      } else if (s.fade > 0) {
        s.fade -= dt;
        const f = Math.max(0, s.fade / 0.22);
        const dk = TR / s.dur / (s.pts.length - 1) * f;
        for (let i = 0; i < s.pts.length; i++) this.bez(s, Math.max(0, 1 - i * dk), s.pts[i]);
        s.alpha = f;
        if (s.fade <= 0) { this.fx.trails.set(s.id, s.pts, 0); if (s.iid >= 0) this.fx.inkTrails.set(s.iid, s.pts, 0); }
      }
    }
  }
  shotHit(s) {
    s.active = false; s.fade = 0.22; s.m.visible = false;
    this.applyHit(s.target, s.j, s.pos);
  }
  applyHit(e, j, p) {
    const big = j === 3;
    this.fx.flash.slash(p, (big ? 4.4 : 3.4) + Math.random() * 1.4, big ? [1.2, 0.8, 0.3] : [1.0, 0.62, 0.22]);
    this.fx.glow.burst(p, big ? 14 : 7, big ? 13 : 9, [2.6, 1.7, 0.6], 0.42, 0.5, { drag: 3 });
    if (!e) return;
    e.pending = Math.max(0, e.pending - 1);
    if (!e.alive) return;
    const killed = this.enemies.damage(e, 1, this);
    if (!killed) {
      this.audio.hitTick(this.pan(e.sx));
      if (e.nt && e.ni >= e.nt.length && e.pending <= 0 && !e.boss) this.enemies.flee(e);
    }
  }
  processQueue() {
    const now = this.audio.now() - this.audio.latency();
    while (this.queue.length && this.queue[0].at <= now) {
      const q = this.queue.shift();
      let from;
      if (q.slot >= 0) from = this.player.launch(q.slot).pos;
      else from = this._v.copy(this.C.camPos).addScaledVector(this.C.U, 12 + Math.random() * 8).addScaledVector(this.C.R, (Math.random() - 0.5) * 26).addScaledVector(this.C.F, -2).clone();
      this.launchShot(from, q.e, q.j, q.slot < 0);
      this.fx.glow.spawn(from.x, from.y, from.z, 0, 0, 0, 3, 2, 0.8, 1.6, 0.25, 1, 0);
    }
  }

  // ------------------------------------------------------------------ overdrive
  gainOD(n) {
    const first = !this.odRevealed;
    this.od = Math.min(3, this.od + n); this.odRevealed = true;
    this.hud.setOD(this.od, this.odActive, true, true);
    this.audio.heal();
    if (first) this.odHintT = 0.6;
  }
  triggerOD() {
    if (this.state !== 'play' || this.odActive || this.od <= 0) return;
    this.odActive = true; this.odTime = 2.6 + this.od * 2.2; this.od = 0; this.skills.od = true;
    this.hud.setOD(0, true, true);
    this.hud.bonus('万 剑');
    this.audio.od(); vibrate([20, 30, 40]);
    this.fovKick = 9; this.flashFx = 0.35; this.shake(0.8);
  }

  // ------------------------------------------------------------------ callbacks
  // formations start on the music's clock, not on whenever the frame happened to process the bar
  spawn(kind, path, o = {}) {
    if (o.t0 === undefined && !this.tutor && this.audio.songName === 'game') o.t0 = clamp(this.audio.heard() - this.noteBase, 0, 0.5);
    const tk = this.audio.beatLenAt(this.noteBase) / 0.5;
    if (path && Math.abs(tk - 1) > 1e-3) { const p0 = path; path = (t, v) => p0(t / tk, v); }
    if (o.nt) for (const t of o.nt) this.resv.push(t);
    return this.enemies.spawn(kind, path, o);
  }
  // one lane: every note owns its moment. Late-scheduled notes (ghost fire, the dragon) only take free moments.
  isFree(t, m = 0.4) { for (const x of this.resv) if (Math.abs(x - t) < m) return false; return true; }
  // run fn on the step that sounds at time t (formations use this to cue their fire on the beat)
  later(t, fn) { this.timers.push({ t, fn }); }
  spawnWisp(x, y, d, T, off = 2, mark = false, base = null, flex = 0) {
    const T2 = T * (this.stage === 0 ? 1.12 : this.stage === 1 ? 1.04 : 1) * BEAT / 0.5;
    const now = this.audio.heard();
    const b = base ?? this.audio.gridAfter(now, 2);
    let nt = -1;
    for (let k = 0; k <= flex + 1e-6; k += 0.5) {
      const t = b + (off + k) * BEAT;
      if (t - now > T2 - 0.6) break;
      if (this.isFree(t)) { nt = t; break; }
    }
    if (nt < 0) return null;
    this.resv.push(nt);
    return this.spawnWispAt(x, y, d, T2, nt, mark);
  }
  spawnWispAt(x, y, d, T, nt, mark = false) {
    const e = this.enemies.spawn('wisp', null, { data: { x0: x, y0: y, d0: d, T }, at: new THREE.Vector3(x, y, d), nt: [nt], pitch: [10], mark });
    this.audio.whoosh(this.audio.now() + 0.01, 0.4, 600, 1600, 0.06);
    return e;
  }
  onKill(e) {
    if (e.counted) this.stats.killed++;
    this.audio.impact(e.kind, this.pan(e.sx), e.maxHp >= 3);
    if (e.pickup === 'heal') {
      const bead = this.hud.beads[Math.min(4, this.hp)];
      this.hud.fly(e.sx, e.sy, bead, '#8ff0c4', 14, () => { if (this.hp < 5) { this.hp++; this.hud.setLife(this.hp, false, true); } this.audio.heal(); });
    }
    if (e.pickup === 'od') this.hud.fly(e.sx, e.sy, $('btn-od'), '#ffd27a', 18, () => this.gainOD(1));
    if (e.kind === 'lantern' || e.kind === 'disc' || e.kind === 'head') this.shake(0.35);
    if (e.kind === 'heart') this.shake(2);
  }
  onEnemyHit(e) {
    this.fx.glow.burst(e.pos, 6, 8, [2.5, 1.5, 0.5], 0.4, 0.4, { drag: 3 });
    if (e.kind === 'heart') this.boss.heartU.uHit.value = 1;
    if (e.kind === 'seal') this.boss.ku.uHit.value = 0.6;
  }
  onEscape(e) {
    if (e.nt && e.ni < e.nt.length && !this.tutor) { this.stats.miss += e.nt.length - e.ni; if (e.phrase) e.phrase.miss = true; }
  }
  onWispHit(e) {
    this.fx.glow.burst(e.pos, 14, 10, [0.4, 2.2, 1.8], 0.6, 0.6, { drag: 3 });
    if (!this.tutor) this.stats.miss++;
    this.breakCombo(null);
    this.hurtPlayer();
  }
  hurtPlayer() {
    if (this.state !== 'play' || this.invuln > 0 || this.odActive) return;
    this.hp--; this.invuln = 2.0; this.stats.damage++;
    this.audio.hurt(); this.shake(1.3); this.damageFx = 1; this.player.flash = 1;
    this.hud.setLife(this.hp, true); vibrate(70);
    this.fx.ink.burst(this.player.pos, 10, 6, 1.2, 4, 0.8, 1.2);
    if (this.hp <= 0) this.gameOver();
  }
  shake(a) { this.shakeAmt = Math.min(2.5, this.shakeAmt + a); }

  worldToNorm(p, out = new THREE.Vector3()) {
    const C = this.C;
    this._w.subVectors(p, C.camPos);
    const d = Math.max(1, this._w.dot(C.F));
    return out.set(this._w.dot(C.R) / (d * C.kx), this._w.dot(C.U) / (d * C.ky), d / C.ds);
  }

  // ------------------------------------------------------------------ camera
  resize() {
    this.W = innerWidth; this.H = innerHeight;
    this.renderer.setSize(this.W, this.H, false);
    this.post.setSize(this.W, this.H, this.dpr);
    this.hud.setSize(this.W, this.H);
    const a = this.W / this.H;
    this.baseFov = a < 1 ? 66 + (1 - a) * 8 : Math.max(50, 60 - (a - 1) * 6);
    this.camera.aspect = a; this.camera.updateProjectionMatrix();
    this.C.W = this.W; this.C.H = this.H; this.C.aspect = a;
    this.camY = a < 1 ? 4.6 : 3.9;
    this.rx = clamp(this.rx, 0, this.W); this.ry = clamp(this.ry, 0, this.H);
  }
  updateCamera(dt) {
    const C = this.C;
    const camS = this.s - SWORD_DEPTH;
    Rail.frame(camS, this.FC); Rail.frame(this.s + 40, this.FT);
    const base = this._v.copy(this.FC.p).addScaledVector(this.FC.u, this.camY);
    const look = this._w.copy(this.FT.p).addScaledVector(this.FT.u, 1.1);
    C.F.subVectors(look, base).normalize();
    C.R.crossVectors(C.F, this.FC.u).normalize();
    C.U.crossVectors(C.R, C.F).normalize();
    if (!this.camInit) { this.prevCam.copy(base); this.camInit = true; }
    C.camVel.subVectors(base, this.prevCam).divideScalar(Math.max(dt, 1e-3));
    this.prevCam.copy(base);
    C.camPos.copy(base);
    // the view leans gently toward where the brush is (less while striking, so targets stay put)
    const ax = (this.rx / this.W) * 2 - 1, ay = -((this.ry / this.H) * 2 - 1);
    const lean = this.state === 'play' ? (this.holding ? 0.25 : 0.6) : 1;
    this.aimX += (ax * lean - this.aimX) * Math.min(1, dt * 4); this.aimY += (ay * lean - this.aimY) * Math.min(1, dt * 4);
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.4);
    const sa = this.shakeAmt * this.shakeAmt * 0.6, tt = this.time * 40;
    this.shakeV.set(Math.sin(tt * 1.3) * sa, Math.sin(tt * 1.7 + 1) * sa, 0);
    const cam = this.camera;
    this.titleBlend = (this.titleBlend || 0) + (((this.state === 'title') ? 1 : 0) - (this.titleBlend || 0)) * Math.min(1, dt * 2.5 + (dt === 0 ? 1 : 0));
    const tanH0 = Math.tan(THREE.MathUtils.degToRad(this.baseFov) / 2);
    const tshift = (C.aspect < 1 ? 0.56 : 0.4) * 12 * tanH0 * C.aspect * this.titleBlend;
    cam.position.copy(base).addScaledVector(C.R, this.shakeV.x + tshift).addScaledVector(C.U, this.shakeV.y);
    const tgt = look.addScaledVector(C.R, this.aimX * 3.2 + tshift).addScaledVector(C.U, this.aimY * 2.2);
    cam.up.copy(C.U).applyAxisAngle(C.F, Math.sin(tt * 0.9) * sa * 0.01);
    cam.lookAt(tgt);
    this.fovKick += (0 - this.fovKick) * Math.min(1, dt * 1.6);
    const fov = this.baseFov + this.fovKick + (this.odActive ? 5 : 0);
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
    cam.getWorldDirection(C.camFwd);
    const tanH = Math.tan(THREE.MathUtils.degToRad(this.baseFov) / 2);
    C.kx = tanH * C.aspect * 0.86; C.ky = tanH * 0.86;
    C.ds = clamp(0.6 + 0.3 * C.aspect, 0.74, 1.0);
    C.pxUnit = (this.H / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    this.fx.setPx(C.pxUnit * this.dpr);
  }

  debugJump(bar) {
    const a = this.audio;
    this.tutor = null; this.learned = true;
    a.playSong('game', 0.05, bar);
    const st = bar >= 72 ? 3 : bar >= 48 ? 2 : bar >= 24 ? 1 : 0;
    if (st < 3) this.stageCard(st); else this.preBoss();
    this.palette.set(STAGES[st].key, 0.01);
    this.bar = bar - 1;
  }

  // ------------------------------------------------------------------ loop
  frame(now) {
    requestAnimationFrame(t => this.frame(t));
    const raw = Math.min(this.dtMax || 0.05, Math.max(0, (now - this.last) / 1000)); this.last = now;
    this.adaptQuality(raw);
    if (this.wipeTarget !== undefined && this.wipeT < this.wipeDur) {
      this.wipeT += raw; const k = Math.min(1, this.wipeT / this.wipeDur); const e = k * k * (3 - 2 * k);
      this.wipe = this.wipeFrom + (this.wipeTarget - this.wipeFrom) * e;
      if (k >= 1 && this.wipeCb) { const cb = this.wipeCb; this.wipeCb = null; cb(); }
    }
    this.post.u.uWipe.value = this.wipe;
    if (this.state === 'paused' || this.state === 'loading') { this.post.render(0); return; }
    this.timeScale += (this.tsTarget - this.timeScale) * Math.min(1, raw * 2.2);
    if (this.state === 'ending' && this.endT > 1.4) this.tsTarget = 1;
    const dt = raw * this.timeScale;
    this.time += dt;
    U.uTime.value = this.time;
    this.C.time = this.time;
    this.palette.update(raw);
    this.s += SPEED * this.speedMul * dt;
    this.updateCamera(dt);
    // music
    if (this.pendingSong && this.audio.now() >= this.pendingSong.at - 0.12) {
      const p = this.pendingSong; this.pendingSong = null;
      this.audio.playSong(p.name, Math.max(0.01, p.at - this.audio.now()), p.bar);
    }
    this.audio.watch(now, this.state === 'play' || this.state === 'ending');
    this.audio.drain(ev => this.onStep(ev));
    // sword
    const FS = Rail.frame(this.s, this.FS);
    const ax = this.aimX, ay = this.aimY;
    const swordPos = this._v.copy(FS.p).addScaledVector(FS.r, ax * 1.3).addScaledVector(FS.u, -1.25 + ay * 0.6);
    const aimPt = this._w.copy(this.FT.p).addScaledVector(this.FT.r, ax * 14).addScaledVector(this.FT.u, 2 + ay * 9);
    const dir = aimPt.sub(swordPos).normalize();
    const lat = (ax - this.prevAimX) / Math.max(raw, 1e-3); this.prevAimX = ax;
    this.player.glow = this.state === 'play' || this.state === 'ending' ? 0.55 + (this.hp || 5) * 0.09 : 0.8;
    this.player.update(dt, this.time, swordPos, dir, this.C.R, this.C.U, lat);
    this.worldToNorm(this.player.center, this.C.playerN);
    if (this.state === 'title') this.titleDrift(raw);
    // gameplay
    if (this.boss.active) this.boss.update(dt, this.C, this.time);
    // in play, spirits move on the music's clock: a dropped frame never leaves a note out of place
    const ah = this.audio.heard();
    const edt = this.state === 'play' && this.lastHeard !== undefined ? clamp(ah - this.lastHeard, 0, 0.5) : dt;
    this.lastHeard = this.state === 'play' ? ah : undefined;
    this.enemies.update(edt, this.C, this);
    if (this.state === 'play') {
      this.updateTutorial(dt);
      this.updateHits();
      this.processQueue();
      this.invuln = Math.max(0, this.invuln - dt);
      if (this.odActive) { this.odTime -= dt; if (this.odTime <= 0) { this.odActive = false; this.hud.setOD(this.od, false, this.odRevealed); } }
      if (this.odRevealed && this.od > 0 && !this.odActive && !this.skills.od) {
        this.odHintT = (this.odHintT || 0) - raw;
        if (this.odHintT <= 0) { this.odHintT = 1.6; const [bx, by] = this.hud.center($('btn-od')); this.hud.ripple(bx, by, 50, 140); }
      }
      if (this.boss.active) this.hud.setBoss(this.boss.hpFrac());
      const flick = this.invuln > 0 ? (Math.sin(this.time * 40) > 0 ? 1 : 0.35) : 1;
      for (const o of this.player.orbit) o.m.material.uniforms.uAlpha.value = Math.min(o.m.material.uniforms.uAlpha.value, flick);
    }
    if (this.state === 'ending') {
      this.endT += raw;
      if (this.endT > 3.6 && !this.endPoem1) { this.endPoem1 = true; this.hud.poem(['飞龙在天', '利见大人'], 5.5); }
      if (this.endT > 10 && !this.endPoem2) { this.endPoem2 = true; this.hud.poem(['云从龙', '风从虎'], 5.5); }
      if (this.endT > 16.5) { this.endPoem1 = this.endPoem2 = false; this.boss.hide(); this.showResults(); }
    }
    if (this.state === 'dead') {
      this.deadT += raw;
      this.post.u.uSat.value = Math.max(0.15, this.post.u.uSat.value - raw * 0.8);
      if (this.deadT > 2.6) this.showResults();
    }
    this.updateShots(dt);
    this.fx.update(dt, this.camera, this.time);
    this.world.update(dt, this.camera.position, this.s - SWORD_DEPTH, this.time);
    this.hud.update(raw, {
      rx: this.rx, ry: this.ry, holding: this.holding, showReticle: this.state === 'play' && (this.lastInput !== 'touch' || this.holding), touch: this.lastInput === 'touch',
      enemies: this.enemies.list, time: this.time, atime: this.audio.heard(), night: U.uNight.value > 0.5,
    });
    this.damageFx = Math.max(0, this.damageFx - raw * 0.9);
    this.flashFx = Math.max(0, this.flashFx - raw * 1.8);
    const pu = this.post.u;
    pu.uTime.value = this.time; pu.uDamage.value = this.damageFx; pu.uFlash.value = Math.min(1, this.flashFx);
    pu.uFlashCol.value.setRGB(1, 0.97, 0.9);
    pu.uOD.value += ((this.odActive ? 1 : 0) - pu.uOD.value) * Math.min(1, raw * 4);
    pu.uCA.value = 0.0012 + this.damageFx * 0.008 + pu.uOD.value * 0.003;
    pu.uInkCol.value.copy(U.uInk.value).multiplyScalar(0.8);
    this.post.render(dt);
  }

  titleDrift() {
    const t = this.time;
    this.rx = this.W * (0.5 + Math.sin(t * 0.23) * 0.12); this.ry = this.H * (0.42 + Math.sin(t * 0.17) * 0.05);
  }

  onStep(ev) {
    this.noteBase = ev.t; this.noteBeat = ev.step / 4;
    if (ev.st === 0 && this.resv.length > 64) this.resv = this.resv.filter(t => t > ev.t - 2);
    if (ev.st % 4 === 0) { this.hud.beat = Math.max(this.hud.beat, ev.st === 0 ? 1 : 0.55); this.player.pulse = ev.st === 0 ? 1 : 0.6; }
    if (ev.accent >= 1) this.fovKick = Math.min(this.fovKick + 0.4, 3);
    if (this.state === 'play' && this.audio.songName === 'game') {
      if (this.timers.length) {
        const due = this.timers.filter(k => k.t <= ev.t + 1e-3);
        if (due.length) { this.timers = this.timers.filter(k => k.t > ev.t + 1e-3); for (const k of due) k.fn(ev); }
      }
      if (ev.st === 0 && ev.bar !== this.bar) {
        this.bar = ev.bar;
        this.level.onBar(ev.bar);
        if (!this.boss.active) this.hud.setStage(undefined, Math.min(1, ev.bar / BOSS_BAR));
      }
      if (ev.st % 4 === 0) {
        for (const e of this.enemies.list) {
          if (e.kind !== 'lantern' || !e.alive || !e.onScreen || e.t < 3) continue;
          if (--e.fireCount <= 0) {
            e.fireCount = (this.stage === 0 ? 10 : this.stage === 1 ? 8 : 7) + Math.floor(Math.random() * 3);
            const n = this.worldToNorm(e.pos);
            if (!this.spawnWisp(n.x, n.y - 0.05, n.z, 2.9, 2, false, ev.t, 1.5)) e.fireCount = 2;
          }
        }
      }
      if (this.boss.active) this.boss.onBeat(ev, this.C);
    }
  }

  adaptQuality(dt) {
    if (this.state === 'loading' || this.state === 'paused') return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    let nd = this.dpr;
    if (avg > 0.024 && this.dpr > 0.75) nd = Math.max(0.75, this.dpr - 0.25);
    else if (avg < 0.0135 && this.dpr < this.maxDpr && !this.upgraded) { nd = Math.min(this.maxDpr, this.dpr + 0.25); this.upgraded = true; }
    if (nd !== this.dpr) { this.dpr = nd; this.renderer.setPixelRatio(nd); this.resize(); }
  }
}

const game = new Game();
game.boot();

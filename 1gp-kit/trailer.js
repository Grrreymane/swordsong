// 宣传视频导演脚本：record_game_video（1GP MCP）逐帧录制，root = web/（先 npm run build:web）。
// 不剧透龙：只拍前三关。一条长镜头，用 debugJump 当剪辑点：
//   云海 点斩 → 青绿 按住一笔连斩（长蛇）→ 灯海 万剑爆发 → 片尾。
// 每段开头直接放进关卡里现成的阵型（阵型和节奏不变，只是出场时间由脚本排），第一秒就有得斩。
// 游戏的判定字、连击数、横幅是 DOM，录不进画布：按游戏原样在视频画布上重画。
// 只在脚本里调度，不改游戏代码。REC.arg 含 nocap 时不叠字幕，含 shots 时每半秒存一张帧。
(async () => {
  const FPS = 30, SECONDS = /quick/.test(REC.arg) ? 3 : 15.5;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  while (!(window.__ready && window.__game)) { REC.advance(16); await sleep(10); }
  const g = window.__game, A = g.audio;
  const W = REC.width || 1080, H = REC.height || 1920;
  const noCap = /nocap/.test(REC.arg);

  g.adaptQuality = () => {};
  // lay the game out like a phone (432×768 CSS px) and render it at 2.5x: brush trails, rings and glyphs keep their phone proportions
  const DPR = W / 432;
  Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => 432 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => Math.round(H / DPR) });
  g.maxDpr = DPR; g.dpr = DPR; g.renderer.setPixelRatio(DPR); g.resize();
  REC.log(`layout ${innerWidth}x${innerHeight} g=${g.W}x${g.H} canvas=${g.renderer.domElement.width}x${g.renderer.domElement.height} dpr=${DPR}`);
  g.hurtPlayer = () => {};
  g.learned = true; g.tutor = null;
  A.watch = () => {};                       // the offline clock only moves per frame: never fall back to the JS clock
  try { await document.fonts.load('120px "Ma Shan Zheng"', '每个灵物都是一音符踩着节拍斩按住不放笔连剑万成歌行龙渊之下等你！，·'); } catch (e) { /* system font */ }

  // ----- players: a tapper, and a brush that holds and sweeps through the next spirits on their beats
  let mode = 'tap', nb = 0;
  const brush = { on: false, x: 0, y: 0 };
  const hits = Object.getPrototypeOf(g).updateHits.bind(g);
  g.updateHits = function () {
    if (this.state === 'play') {
      const now = A.heard();
      if (mode === 'tap') {
        for (const e of this.enemies.list) {
          if (!e.alive || !e.lockable || !e.nt || e.ni >= e.nt.length || e.sealTo > e.ni) continue;
          const T = e.nt[e.ni];
          if (T > now + 0.01 || now - T > 2.0) continue;
          if (e.sx < -50 || e.sy < -50 || e.sx > this.W + 50 || e.sy > this.H + 50) continue;
          const id = 'bot' + (nb++); this.ptrDown(id, e.sx, e.sy, Math.max(0, now - T), 'touch'); this.ptrUp(id);
        }
      } else if (brush.on) {
        let best = null, bt = 1e9;
        for (const e of this.enemies.list) {
          if (!e.alive || !e.lockable || !e.nt || e.ni >= e.nt.length || e.sealTo > e.ni) continue;
          const T = e.nt[e.ni];
          if (T < now - 0.06 || T > now + 1.2 || e.sx < 0 || e.sy < 0 || e.sx > this.W || e.sy > this.H) continue;
          if (T < bt) { bt = T; best = e; }
        }
        let tx = this.W * 0.5, ty = this.H * 0.72, k = 0.08;
        if (best) { tx = best.sx; ty = best.sy; k = Math.min(1, (1 / FPS) / Math.max(bt - now - 0.2, 1 / FPS)); }   // arrive a little early: the brush seals it, the sword cuts on the beat
        brush.x += (tx - brush.x) * k; brush.y += (ty - brush.y) * k;
        this.ptrMove('brush', brush.x, brush.y);
      }
    }
    hits();
  };
  const brushDown = () => { brush.on = true; brush.x = g.W * 0.5; brush.y = g.H * 0.72; g.ptrDown('brush', brush.x, brush.y, 0, 'touch'); };
  const brushUp = () => { brush.on = false; g.ptrUp('brush'); };

  // ----- cut to bar J, then bring in some of the level's own formations right away (same shapes and rhythms,
  // entering earlier than the script would have them), so every shot has spirits to cut from its first second
  const inject = (bar, firstAt) => {
    const entry = g.level.script.find(([b]) => b === bar); if (!entry) return;
    const fn = entry[1], beat = A.beatLenAt(A.now()), base = g.noteBeat;
    const nb0 = g.nb, sp0 = g.spawn, sc0 = g.stageCard;
    let min = 1e9;
    g.nb = beats => { min = Math.min(min, Math.round(beats * 2) / 2); return 0; };
    g.spawn = () => null; g.stageCard = () => {};
    try { fn(g); } catch (e) { /* dry run */ }
    const sh = min - firstAt;   // > 0: enters already on its way in
    g.nb = beats => A.beatTime(base + Math.round(beats * 2) / 2 - sh);
    g.spawn = (kind, path, o = {}) => sp0.call(g, kind, path, Object.assign(o, { t0: (o.t0 || 0) + Math.max(0, sh) * beat }));
    try { fn(g); } catch (e) { REC.log('inject ERR ' + e.message); }
    g.nb = nb0; g.spawn = sp0; g.stageCard = sc0;
    REC.log(`inject bar ${bar} at +${firstAt} beats (shift ${sh})`);
  };
  let pending = null;
  const cutTo = (J, list) => { g.debugJump(J); pending = { J, list }; };

  // the game's own hit feedback is DOM (judgement glyphs, combo, banners): redraw it on the video canvas
  const fx = { pops: [], bonus: [], combo: 0, comboT: -9 };
  let now = 0;
  const hud = g.hud, j0 = hud.judge.bind(hud), c0 = hud.setCombo.bind(hud), b0 = hud.bonus.bind(hud);
  hud.judge = (x, y, j) => { fx.pops.push({ x, y, j, t: now }); j0(x, y, j); };
  hud.setCombo = (n, how) => { if (n > fx.combo) fx.comboT = now; fx.combo = n; c0(n, how); };
  hud.bonus = (text, sub) => { fx.bonus.push({ text: text.replace(/\s+/g, ' '), t: now }); b0(text, sub); };

  // ----- captions (drawn over the game's canvas on our own canvas)
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const cx = out.getContext('2d');
  const src = g.renderer.domElement;
  const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
  const pop = x => x <= 0 ? 0 : x < 0.12 ? 1.15 * x / 0.12 : x < 0.25 ? 1.15 - 0.15 * (x - 0.12) / 0.13 : 1;
  const BRUSH = '"Ma Shan Zheng","STKaiti","KaiTi",serif';
  const PAPER = 'rgba(250,244,232,.75)', NIGHT = 'rgba(30,14,6,.55)';
  const CAPS = [
    [0.15, 3.8, ['朱砂圈收紧时', '斩！'], { ink: '#2a2a33', big: '#b8291a', glow: PAPER }],
    [4.1, 8.1, ['按住一路划', '连斩'], { ink: '#2a2a33', big: '#b8291a', glow: PAPER }],
    [8.5, 12.2, ['一剑一音', '万剑成歌'], { ink: '#fff3dc', big: '#ffe08a', glow: NIGHT }],
  ];
  const text = (s, x, y, px, color, alpha, scale, glow) => {
    if (alpha <= 0) return;
    cx.save(); cx.globalAlpha = alpha; cx.translate(x, y); cx.scale(scale, scale);
    cx.font = `${px}px ${BRUSH}`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.shadowColor = glow; cx.shadowBlur = px * 0.3; cx.fillStyle = color; cx.fillText(s, 0, 0); cx.restore();
  };
  const caption = t => {
    for (const [a, b, txt, o] of CAPS) {
      if (t < a || t > b) continue;
      const fade = Math.min(ease((t - a) / 0.25), ease((b - t) / 0.3));
      text(txt[0], W / 2, H * 0.075, 60, o.ink, fade, 1, o.glow);
      text(txt[1], W / 2, H * 0.075 + 125, 140, o.big, Math.min(fade, ease((t - a - 0.17) / 0.1)), pop((t - a - 0.17) / 1.2), o.glow);
    }
    const a = 12.4;
    if (t >= a) {
      const k = ease((t - a) / 0.6);
      cx.save(); cx.globalAlpha = 0.8 * k; const gr = cx.createLinearGradient(0, H * 0.22, 0, H * 0.68);
      gr.addColorStop(0, 'rgba(250,242,226,0)'); gr.addColorStop(0.5, 'rgba(250,242,226,.92)'); gr.addColorStop(1, 'rgba(250,242,226,0)');
      cx.fillStyle = gr; cx.fillRect(0, H * 0.22, W, H * 0.46); cx.restore();
      text('剑歌行', W / 2, H * 0.4, 220, '#16161e', k, pop((t - a) / 1.2), 'rgba(255,240,210,.8)');
      text('Swordsong', W / 2, H * 0.4 + 150, 44, '#5a4a3a', ease((t - a - 0.3) / 0.4), 1, 'transparent');
      text('龙渊之下 · 等你一剑', W / 2, H * 0.4 + 250, 66, '#a8361c', ease((t - a - 0.6) / 0.4), 1, 'rgba(255,240,210,.8)');
    }
  };
  const LATIN = '"Cormorant Garamond","Noto Serif SC",serif';
  const drawFx = t => {
    const sx = W / g.W, sy = H / g.H, night = document.body.classList.contains('night') || g.stage >= 2;
    const hudC = night ? '#efe8da' : '#15181d', glow = night ? 'rgba(21,24,29,.6)' : 'rgba(239,232,218,.75)';
    fx.pops = fx.pops.filter(p => t - p.t < 1);
    for (const p of fx.pops) {
      const k = (t - p.t) / 1, px = 75;
      const a = k < 0.14 ? k / 0.14 : 1 - (k - 0.14) / 0.86;
      const lift = k < 0.14 ? -0.3 - 0.4 * k / 0.14 : -0.7 - 1.2 * (k - 0.14) / 0.86;
      const sc = k < 0.14 ? 0.7 + 0.4 * k / 0.14 : 1.1 - 0.1 * Math.min(1, (k - 0.14) / 0.2);
      text(['', '好', '妙', '绝'][p.j], p.x * sx, p.y * sy + lift * px, px, p.j === 3 ? '#e3b352' : p.j === 2 ? '#c13a25' : hudC, a, sc, glow);
    }
    if (fx.combo >= 5 && t < 12.3) {
      const b = Math.max(0, 1 - (t - fx.comboT) / 0.18), sc = 1 + 0.22 * b;
      cx.save(); cx.translate(W / 2, H * 0.235); cx.scale(sc, sc);
      cx.font = `600 100px ${LATIN}`; cx.textAlign = 'right'; cx.textBaseline = 'alphabetic';
      cx.shadowColor = glow; cx.shadowBlur = 18; cx.fillStyle = hudC; cx.fillText(String(fx.combo), 18, 0);
      cx.font = `44px ${BRUSH}`; cx.textAlign = 'left'; cx.fillStyle = '#c13a25'; cx.fillText('连', 28, 0); cx.restore();
    }
    fx.bonus = fx.bonus.filter(p => t - p.t < 1.5).slice(-1);
    for (const p of fx.bonus) {
      const k = (t - p.t) / 1.5;
      const sc = k < 0.12 ? 1.8 - 0.85 * k / 0.12 : k < 0.22 ? 0.95 + 0.05 * (k - 0.12) / 0.1 : 1;
      const a = k < 0.12 ? k / 0.12 : k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
      text(p.text, W / 2, H * 0.31 - (k > 0.8 ? (k - 0.8) / 0.2 * 0.12 * 130 : 0), 130, '#e3b352', a, sc, 'rgba(255,190,80,.75)');
    }
  };
  const draw = t => { now = t; cx.drawImage(src, 0, 0, src.width, src.height, 0, 0, W, H); drawFx(t); if (!noCap) caption(t); };

  // ----- shot list, by video time
  const cues = [
    [0.0, () => cutTo(14, [[15, 0.8], [13, 3.0]])],                                    // 云海：鱼群 + 符环
    [4.0, () => { cutTo(39, [[38, 1.0], [40, 4.0]]); mode = 'brush'; brushDown(); }],    // 青绿：符雨 + 锦鲤，一笔连斩
    [8.3, () => { brushUp(); mode = 'tap'; cutTo(56, [[55, 0.5], [59, 2.0]]); }],       // 灯海：长蛇 + 红鲤
    [10.4, () => { g.od = 3; g.triggerOD(); }],                                         // 万剑
  ];
  if (/qb/.test(REC.arg)) cues.splice(0, cues.length, [0.0, () => { cutTo(39, [[38, 1.0], [40, 4.0]]); mode = 'brush'; brushDown(); }]);
  let ci = 0;

  await REC.run({
    fps: FPS, seconds: SECONDS, canvas: out, audio: true,
    async setup(ac) {
      A.init(ac); A.setMuted(false); g.muted = false;
      await A.decodeSlot('stage1');
      g.startGame();
      for (let k = 0; k < 120 && g.state !== 'play'; k++) { REC.advance(1000 / FPS); await sleep(5); }
      for (let k = 0; k < 40; k++) { REC.advance(1000 / FPS); await sleep(5); }   // let the wipe finish
      REC.log('state ' + g.state + ' song ' + A.songName + ` g=${g.W}x${g.H} canvas=${src.width}x${src.height}`);
    },
    async step(i, t) {
      if (t >= 7.6 && !A.slots.stage3.buf) await A.decodeSlot('stage3');
      while (ci < cues.length && t >= cues[ci][0]) { cues[ci][1](); ci++; }
      REC.advance(1000 / FPS);
      A.tick();
      if (pending && g.noteBeat >= pending.J * 4 - 0.01) { for (const [b, at] of pending.list) inject(b, at); pending = null; }
      draw(t);
      if (i % 30 === 0) REC.log(`t=${t.toFixed(1)} bar=${g.bar} combo=${g.combo} alive=${g.enemies.list.filter(e => e.alive).length} od=${g.odActive}`);
      if (REC.arg.includes('shots') && i % 15 === 0) await REC.shot('f' + String(i).padStart(3, '0'), out);
    },
  });
})();

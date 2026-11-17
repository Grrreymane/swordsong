// 宣传视频导演脚本：record_game_video（1GP MCP）逐帧录制，root = web/（先 npm run build:web）。
// 一条长镜头，用 debugJump 当剪辑点：云海斩灵物 → 龙破云而出 → 斩封印、碎龙珠 → 金龙升天 → 片尾。
// 只在脚本里调度（跳小节、给 Boss 排更密的音符、自动斩），不改游戏代码。REC.arg 含 nocap 时不叠字幕。
(async () => {
  const FPS = 30, SECONDS = 19;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  while (!(window.__ready && window.__game)) { REC.advance(16); await sleep(10); }
  const g = window.__game, A = g.audio;
  const W = REC.width || 1080, H = REC.height || 1920;
  const noCap = /nocap/.test(REC.arg);

  // render at exactly 1x, no adaptive quality (the virtual clock is steady anyway)
  g.adaptQuality = () => {};
  g.maxDpr = 1; g.dpr = 1; g.renderer.setPixelRatio(1); g.resize();
  g.hurtPlayer = () => {};
  g.learned = true; g.tutor = null;
  A.watch = () => {};                       // the offline clock only moves per frame: never fall back to the JS clock
  try { await document.fonts.load('120px "Ma Shan Zheng"', '剑歌行一音灵物即符积水成渊蛟龙生焉斩封印碎珠飞在天你能气呵吗'); } catch (e) { /* system font */ }

  // tap bot: strikes every spirit on its beat (as a perfect player would)
  let nb = 0;
  const hits = Object.getPrototypeOf(g).updateHits.bind(g);
  g.updateHits = function () {
    if (this.state === 'play') {
      const now = A.heard();
      for (const e of this.enemies.list) {
        if (e.__rush || !e.alive || !e.lockable || !e.nt || e.ni >= e.nt.length || e.sealTo > e.ni) continue;
        const T = e.nt[e.ni];
        if (T > now + 0.01 || now - T > 2.0) continue;
        if (e.sx < -50 || e.sy < -50 || e.sx > this.W + 50 || e.sy > this.H + 50) continue;
        const id = 'bot' + (nb++); this.ptrDown(id, e.sx, e.sy, Math.max(0, now - T), 'touch'); this.ptrUp(id);
      }
    }
    hits();
  };
  // the trailer's quicker boss: give the remaining targets one note each on a fast grid and strike them on it
  const rush = (list, gap, lead) => {
    let T = A.gridAfter(A.now() + lead, 4);
    for (const e of list) {
      e.__rush = true; e.hp = 1; e.nt = [T]; e.ni = 0; e.sealTo = 0; e.lockable = true; g.resv.push(T); T += gap;
    }
  };
  const strikeDue = () => {
    const now = A.now();
    for (const e of g.enemies.list) if (e.__rush && e.alive && e.nt && e.ni < e.nt.length && e.nt[e.ni] <= now + 0.02) g.strike(e, 3, false, e.nt[e.ni]);
  };

  // ----- captions (drawn over the game's canvas on our own canvas)
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const cx = out.getContext('2d');
  const src = g.renderer.domElement;
  const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
  const pop = x => x <= 0 ? 0 : x < 0.12 ? 1.15 * x / 0.12 : x < 0.25 ? 1.15 - 0.15 * (x - 0.12) / 0.13 : 1;
  const BRUSH = '"Ma Shan Zheng","STKaiti","KaiTi",serif';
  const CAPS = [
    // [start, end, kind, text, options]
    [0.25, 2.7, 'title'],
    [2.9, 4.8, 'pair', ['灵物即音符', '一剑一音'], { ink: '#1b1b24', big: '#b8291a', y: 0.075 }],
    [5.5, 8.3, 'pair', ['积水成渊', '蛟龙生焉'], { ink: '#efe6d4', big: '#ffd27a', y: 0.05 }],
    [8.6, 10.9, 'pair', ['斩封印', '碎龙珠'], { ink: '#efe6d4', big: '#ffd27a', y: 0.05 }],
    [14.3, 16.8, 'pair', ['黑龙化金', '飞龙在天'], { ink: '#3a2a18', big: '#a8361c', y: 0.17 }],
    [16.8, 19.1, 'end'],
  ];
  const text = (s, x, y, px, color, alpha, scale = 1, shadow = 'rgba(0,0,0,.35)') => {
    cx.save(); cx.globalAlpha = alpha; cx.translate(x, y); cx.scale(scale, scale);
    cx.font = `${px}px ${BRUSH}`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.shadowColor = shadow; cx.shadowBlur = px * 0.25; cx.fillStyle = color; cx.fillText(s, 0, 0); cx.restore();
  };
  const vtext = (s, x, y0, px, color, alpha, gap = 1.05) => { [...s].forEach((ch, k) => text(ch, x, y0 + k * px * gap, px, color, alpha, 1, 'rgba(244,238,226,.6)')); };
  const caption = t => {
    for (const [a, b, kind, txt, o] of CAPS) {
      if (t < a || t > b) continue;
      const fade = Math.min(ease((t - a) / 0.3), ease((b - t) / 0.35));
      if (kind === 'title') {
        vtext('剑歌行', W * 0.78, H * 0.13, 190, '#16161e', fade);
        text('Swordsong', W * 0.62, H * 0.2, 46, '#2b2b36', fade * 0.85, 1, 'transparent');
      } else if (kind === 'pair') {
        text(txt[0], W / 2, H * o.y, 64, o.ink, fade);
        text(txt[1], W / 2, H * o.y + 130, 150, o.big, Math.min(fade, ease((t - a - 0.17) / 0.12)), pop((t - a - 0.17) / 1.2));
      } else if (kind === 'end') {
        const k = ease((t - a) / 0.5);
        cx.save(); cx.globalAlpha = 0.55 * k; const gr = cx.createLinearGradient(0, H * 0.25, 0, H * 0.7);
        gr.addColorStop(0, 'rgba(250,240,220,0)'); gr.addColorStop(0.5, 'rgba(250,240,220,.85)'); gr.addColorStop(1, 'rgba(250,240,220,0)');
        cx.fillStyle = gr; cx.fillRect(0, H * 0.25, W, H * 0.45); cx.restore();
        text('剑歌行', W / 2, H * 0.43, 210, '#16161e', k, pop((t - a) / 1.2), 'rgba(255,240,210,.7)');
        text('你能一气呵成吗？', W / 2, H * 0.53, 64, '#a8361c', ease((t - a - 0.35) / 0.4), 1, 'rgba(255,240,210,.7)');
      }
    }
  };
  const draw = t => {
    cx.drawImage(src, 0, 0, src.width, src.height, 0, 0, W, H);
    if (!noCap) caption(t);
  };

  // ----- shot list, by video time
  const cues = [
    [0.0, async () => { g.debugJump(13); }],
    [4.0, async () => { await A.decodeSlot('boss'); }],
    [4.8, async () => { g.debugJump(72); }],
    
    [8.5, async () => { await A.decodeSlot('ending'); rush(g.boss.seals.filter(s => s.alive), A.beatLenAt(A.now()) / 4, 0.2); }],
  ];
  let ci = 0, bossSkipped = false, heartRushed = false;

  REC.log('canvas ' + src.width + 'x' + src.height);
  await REC.run({
    fps: FPS, seconds: SECONDS, canvas: out, audio: true,
    async setup(ac) {
      A.init(ac); A.setMuted(false); g.muted = false;
      await A.decodeSlot('stage1');
      g.startGame();
      for (let k = 0; k < 120 && g.state !== 'play'; k++) { REC.advance(1000 / FPS); await sleep(5); }
      for (let k = 0; k < 40; k++) { REC.advance(1000 / FPS); await sleep(5); }   // let the wipe finish
      REC.log('state ' + g.state + ' song ' + A.songName);
    },
    async step(i, t) {
      while (ci < cues.length && t >= cues[ci][0]) { await cues[ci][1](); ci++; }
      // startBoss may land a frame after the jump: skip the empty underwater seconds once it does
      if (!bossSkipped && g.boss.active && t > 4.8) { bossSkipped = true; if (g.boss.t < 4.3) { g.boss.t = 4.3; g.boss.th = 4.3 * 0.58; } }
      // the pearl appears after the last seal: rush it as soon as it is out
      if (!heartRushed && g.boss.phase === 2 && g.boss.heartE && g.boss.heartE.alive && g.boss.t2 > 0.5) { heartRushed = true; rush([g.boss.heartE], 0, 0.1); }
      strikeDue();
      REC.advance(1000 / FPS);
      A.tick();
      draw(t);
      if (i % 30 === 0) REC.log(`t=${t.toFixed(1)} state=${g.state} bar=${g.bar} boss=${g.boss.active ? g.boss.phase : '-'} bt=${(g.boss.t || 0).toFixed(1)} combo=${g.combo}`);
      if (REC.arg.includes('shots') && i % 15 === 0) await REC.shot('f' + String(i).padStart(3, '0'), out);
    },
  });
})();

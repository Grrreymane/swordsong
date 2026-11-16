() => {
  // render the 3D scene into a plain float target now and then, and count NaN/Inf pixels
  const g = __game, r = g.renderer;
  if (window.__nanHook) return 'hooked';
  window.__nanHook = true; window.__nan = { frames: 0, nanFrames: 0, maxNan: 0, samples: [], maxVal: 0 };
  const RT = g.post.composer.renderTarget1.constructor;
  const w = 180, h = 390;
  const rt = new RT(w, h, { type: 1015 });
  const buf = new Float32Array(w * h * 4);
  const orig = g.post.render.bind(g.post);
  let n = 0;
  g.post.render = function (dt) {
    orig(dt);
    if (++n % 5) return;
    const prev = r.getRenderTarget();
    r.setRenderTarget(rt); r.clear(); r.render(g.scene, g.camera); r.setRenderTarget(prev);
    r.readRenderTargetPixels(rt, 0, 0, w, h, buf);
    let bad = 0, mx = 0, bx = 0, by = 0;
    for (let i = 0; i < buf.length; i += 4) { const a = buf[i], b = buf[i + 1], c = buf[i + 2]; if (!(a === a && b === b && c === c) || !isFinite(a + b + c)) { bad++; bx += (i / 4) % w; by += Math.floor(i / 4 / w); } else { const m = Math.max(a, b, c); if (m > mx) mx = m; } }
    const N = window.__nan; N.frames++; N.maxVal = Math.max(N.maxVal, mx);
    if (bad) { N.nanFrames++; N.maxNan = Math.max(N.maxNan, bad); if (N.samples.length < 8) N.samples.push({ t: +g.time.toFixed(1), bar: g.bar, bad, at: [Math.round(bx / bad), h - Math.round(by / bad)] }); }
  };
  return 'nan hook';
}

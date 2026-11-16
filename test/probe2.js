() => {
  const g = __game; window.__noteLog = []; const v = new (g.C.F.constructor)();
  const orig = g.updateHits.bind(g);
  g.updateHits = function () {
    const now = this.audio.heard();
    for (const e of this.enemies.list) {
      if (!e.alive || !e.nt || e.ni >= e.nt.length || !e.path) continue;
      const T = e.nt[e.ni];
      if (now >= T && e.__logged !== T) {
        e.__logged = T;
        const tt = e.t - (now - T); e.path(tt, v);
        const on = Math.abs(v.x) <= 1.12 && v.y <= 1.12 && v.y >= -0.75;
        window.__noteLog.push([e.kind, on ? 1 : 0, +v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(0)]);
      }
    }
    orig();
  };
  return 'probe2';
}

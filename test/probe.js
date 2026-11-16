() => {
  const g = __game; window.__noteLog = [];
  const orig = g.updateHits.bind(g);
  g.updateHits = function () {
    const now = this.audio.heard();
    for (const e of this.enemies.list) {
      if (!e.alive || !e.nt || e.ni >= e.nt.length) continue;
      const T = e.nt[e.ni];
      if (now >= T && e.__logged !== T) { e.__logged = T; window.__noteLog.push([e.kind, e.onScreen ? 1 : 0, Math.round(e.sx), Math.round(e.sy), Math.round(e.depth), +(now - T).toFixed(2), e.lockable ? 1 : 0]); }
    }
    orig();
  };
  return 'probe';
}

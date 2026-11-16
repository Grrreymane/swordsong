() => {
  const g = __game; if (g.__botInstalled) return 'already';
  g.__botInstalled = true; window.__botOn = true;
  const orig = g.updateHits.bind(g);
  g.updateHits = function () {
    if (window.__botOn && this.state === 'play') {
      const now = this.audio.heard();
      let target = null, bd = 1e9;
      for (const e of this.enemies.list) {
        if (!e.alive || !e.onScreen || !e.lockable || !e.nt || e.ni >= e.nt.length) continue;
        const T = e.nt[e.ni]; const d = Math.abs(T - now);
        if (now >= T - 0.2 && d < bd) { bd = d; target = e; }
      }
      if (target) { this.rx = target.sx; this.ry = target.sy; this.prx = this.rx; this.pry = this.ry; this.holding = true; this.downFresh = true; this.contactId++; }
      else this.holding = false;
    }
    orig();
  };
  return 'installed';
}

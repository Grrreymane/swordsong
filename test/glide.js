() => {
  const g = __game; if (g.__botInstalled) return 'already';
  g.__botInstalled = true; let prev = 0;
  const orig = g.updateHits.bind(g);
  g.updateHits = function () {
    if (this.state === 'play') {
      const now = this.audio.heard(); const dt = Math.min(0.1, Math.max(0.001, now - prev)); prev = now;
      if (!this.ptrs.has('glide')) this.ptrDown('glide', this.W / 2, this.H * 0.6, 0, 'touch');
      const p = this.ptrs.get('glide');
      let target = null, bt = 1e9;
      for (const e of this.enemies.list) {
        if (!e.alive || !e.onScreen || !e.lockable || !e.nt || e.ni >= e.nt.length) continue;
        const T = e.nt[e.ni]; if (T < now - 0.1) continue;
        if (T < bt) { bt = T; target = e; }
      }
      if (target && bt - now < 0.45) {
        const dx = target.sx - p.x, dy = target.sy - p.y, L = Math.hypot(dx, dy), v = 2600 * dt;
        if (L > 1) { const k = Math.min(1, v / L); this.ptrMove('glide', p.x + dx * k, p.y + dy * k); }
      }
    }
    orig();
  };
  return 'glide';
}

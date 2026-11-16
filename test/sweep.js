() => {
  // careless sweeping: a held brush racing through every spirit on screen, no regard for the beat
  const g = __game; if (g.__botInstalled) return 'already';
  g.__botInstalled = true; let prev = 0, tgt = null;
  const orig = g.updateHits.bind(g);
  g.updateHits = function () {
    if (this.state === 'play') {
      const now = this.audio.heard(); const dt = Math.min(0.1, Math.max(0.001, now - prev)); prev = now;
      if (!this.ptrs.has('sw')) this.ptrDown('sw', this.W / 2, this.H * 0.6, 0, 'mouse');
      const p = this.ptrs.get('sw');
      const cand = this.enemies.list.filter(e => e.alive && e.onScreen && e.lockable && e.nt && e.ni < e.nt.length && !(e.sealTo > e.ni));
      if (!tgt || !cand.includes(tgt)) { cand.sort((a, b) => a.nt[a.ni] - b.nt[b.ni]); tgt = cand[0] || null; }
      if (tgt) {
        const dx = tgt.sx - p.x, dy = tgt.sy - p.y, L = Math.hypot(dx, dy), v = 2200 * dt;
        const k = L > 1 ? Math.min(1, v / L) : 0; this.ptrMove('sw', p.x + dx * k, p.y + dy * k);
      } else { this.ptrMove('sw', this.W / 2 + Math.sin(now * 3) * 120, this.H * 0.45 + Math.cos(now * 2.2) * 90); }
    }
    orig();
  };
  return 'sweep';
}

() => {
  const g = __game; if (g.__botInstalled) return 'already';
  g.__botInstalled = true; window.__botOn = true; let prev = 0, n = 0;
  const orig = g.updateHits.bind(g);
  g.updateHits = function () {
    if (window.__botOn && this.state === 'play') {
      const now = this.audio.heard(); const dt = Math.min(0.5, Math.max(0.008, now - prev)); prev = now;
      let target = null, bd = 1e9;
      for (const e of this.enemies.list) {
        if (!e.alive || !e.onScreen || !e.lockable || !e.nt || e.ni >= e.nt.length || e.sealTo > e.ni) continue;
        const T = e.nt[e.ni]; const d = Math.abs(T - now);
        if (now >= T - dt * 0.5 && d < bd) { bd = d; target = e; }
      }
      // a quick tap on the frame closest to the note
      if (target) { const id = 'bot' + (n++); this.ptrDown(id, target.sx, target.sy, 0, 'touch'); this.ptrUp(id); }
    }
    orig();
  };
  return 'tap-bot';
}

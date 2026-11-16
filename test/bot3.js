() => {
  // timestamped tap bot: taps every spirit whose beat has come, stamping the tap with the beat's time
  // (as real input events carry their own timestamps), so a slow frame rate doesn't skew the judging
  const g = __game; if (g.__botInstalled) return 'already';
  g.__botInstalled = true; window.__botOn = true; let n = 0;
  const orig = g.updateHits.bind(g);
  g.updateHits = function () {
    if (window.__botOn && this.state === 'play') {
      const now = this.audio.heard();
      for (const e of this.enemies.list) {
        if (!e.alive || !e.lockable || !e.nt || e.ni >= e.nt.length || e.sealTo > e.ni) continue;
        const T = e.nt[e.ni];
        if (T > now + 0.01 || now - T > 2.0) continue;
        if (e.sx < -50 || e.sy < -50 || e.sx > this.W + 50 || e.sy > this.H + 50) continue;
        const id = 'bot' + (n++); this.ptrDown(id, e.sx, e.sy, Math.max(0, now - T), 'touch'); this.ptrUp(id);
      }
    }
    orig();
  };
  return 'stamp-bot';
}

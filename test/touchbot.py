# Real-touch bot: reads upcoming notes from the page, dispatches CDP touch events at note time.
import asyncio, json, sys, time
from playwright.async_api import async_playwright

W, H = int(sys.argv[1]), int(sys.argv[2])
DUR = float(sys.argv[3]) if len(sys.argv) > 3 else 60
FRESH = len(sys.argv) > 4 and sys.argv[4] == 'fresh'

NEXT = '''() => { const g = __game; const now = g.audio.heard(); let best = null;
  for (const e of g.enemies.list) { if (!e.alive || !e.onScreen || !e.lockable || !e.nt || e.ni >= e.nt.length) continue;
    const T = e.nt[e.ni]; if (T < now - 0.15) continue;
    if (!best || T < best.T) { let sx = e.sx, sy = e.sy;
      if (e.path) { const v = new (g.C.F.constructor)(); if (e.path(e.t + (T - now), v)) { sx = (v.x * 0.86 * 0.5 + 0.5) * g.W; sy = (-v.y * 0.86 * 0.5 + 0.5) * g.H; } }
      best = {T, sx, sy, k: e.kind, id: e.id, cx: e.sx, cy: e.sy}; } }
  return {now, best, state: g.state, tutor: !!g.tutor, gate: g.tutor ? g.tutor.step : -1, st: g.stats, combo: g.combo, calib: g.calib, learned: g.learned, song: g.audio.songName, mode: g.audio.curSeg && g.audio.curSeg.mode}; }'''

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1, has_touch=True, is_mobile=True)
        pg = await ctx.new_page()
        logs = []
        pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
        pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text and '404' not in m.text else None)
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function('window.__ready === true', timeout=90000)
        if FRESH: await pg.evaluate('() => { localStorage.clear(); }'); await pg.reload(); await pg.wait_for_function('window.__ready === true', timeout=90000)
        await pg.wait_for_timeout(1500)
        try:
            await pg.tap('#btn-start', timeout=4000)
        except Exception:
            await pg.evaluate("document.getElementById('btn-start').click()")
        await pg.wait_for_function('__game.state === "play"', timeout=60000)
        await pg.evaluate('() => { __game.hurtPlayer = () => {}; __game.dtMax = 0.25; window.__errLog = []; }')
        cdp = await ctx.new_cdp_session(pg)
        t_end = time.time() + DUR; taps = 0; last_gate = None; done_T = set()
        while time.time() < t_end:
            q = await pg.evaluate(NEXT)
            if q['gate'] != last_gate:
                logs.append(f"gate {q['gate']} tutor={q['tutor']} song={q['song']} st={json.dumps(q['st'])}"); last_gate = q['gate']
            bst = q['best']
            if not bst or round(bst['T'], 3) in done_T: await asyncio.sleep(0.05); continue
            wait = bst['T'] - q['now']
            if wait > 0.6: await asyncio.sleep(min(wait - 0.5, 0.3)); continue
            if wait > 0: await asyncio.sleep(wait)
            done_T.add(round(bst['T'], 3))
            x, y = max(1, min(W - 1, bst['sx'])), max(1, min(H - 1, bst['sy']))
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y, 'id': 1}]})
            await asyncio.sleep(0.06)
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            taps += 1
            if taps <= 14: logs.append(f"tap#{taps} T={bst['T']:.3f} id={bst['id']} k={bst['k']} at=({x:.0f},{y:.0f}) cur=({bst['cx']:.0f},{bst['cy']:.0f}) wait={wait:.3f} now0={q['now']:.3f}")
        q = await pg.evaluate(NEXT)
        logs.append(f"mode={q.get('mode')} end taps={taps} gate={q['gate']} tutor={q['tutor']} learned={q['learned']} song={q['song']} calib={q['calib']:.3f} st={json.dumps(q['st'])} combo={q['combo']}")
        errs = await pg.evaluate('() => window.__errLog')
        logs.append('errs ' + json.dumps(errs))
        await pg.screenshot(path='test/tb_end.png')
        await b.close()
        print('\n'.join(logs[-40:]))

asyncio.run(main())
